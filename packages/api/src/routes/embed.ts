/**
 * 埋め込み管理 API
 * GET  /api/embed/status   — インデックス状況確認
 * POST /api/embed/reindex  — 全レコードのembeddingを再生成（非同期・並列処理）
 * GET  /api/embed/search   — セマンティック検索（memories / session_summaries / artifacts）
 */
import { Router, type Router as RouterType } from 'express';
import { sql } from 'drizzle-orm';
import { getDb, plugins, memories, session_summaries, artifacts } from '@maestro/db';
import {
  embedPassage,
  embedQuery,
  buildPluginEmbedText,
  buildMemoryEmbedText,
  buildSessionEmbedText,
  buildArtifactEmbedText,
} from '../services/embedding.js';

export const embedRouter: RouterType = Router();

/** 同時実行数の上限（embedding はCPU負荷が高いため絞る） */
const REINDEX_CONCURRENCY = 3;

/** 再インデックス中フラグ（company単位） */
const reindexRunning = new Set<string>();

/** 並列数を制限しながら配列を処理するユーティリティ */
async function runConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** インデックス状況 */
embedRouter.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;
    const [p, m, s, a] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM plugins WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM memories WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM session_summaries WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM artifacts WHERE company_id = ${cid}`),
    ]);
    res.json({
      data: {
        running: reindexRunning.has(cid),
        plugins:           { total: Number(p.rows[0].total), indexed: Number(p.rows[0].indexed) },
        memories:          { total: Number(m.rows[0].total), indexed: Number(m.rows[0].indexed) },
        session_summaries: { total: Number(s.rows[0].total), indexed: Number(s.rows[0].indexed) },
        artifacts:         { total: Number(a.rows[0].total), indexed: Number(a.rows[0].indexed) },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** 全レコード再インデックス（非同期・並列処理・多重起動防止） */
embedRouter.post('/reindex', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;

    if (reindexRunning.has(cid)) {
      res.status(409).json({ error: '再インデックスは既に実行中です' });
      return;
    }

    reindexRunning.add(cid);
    res.json({ data: { message: '再インデックスを開始しました（バックグラウンドで実行中）' } });

    (async () => {
      try {
        // plugins
        const allPlugins = await db.select().from(plugins).where(sql`company_id = ${cid}`);
        await runConcurrent(allPlugins, async (plugin) => {
          try {
            const vec = await embedPassage(buildPluginEmbedText(plugin));
            await db.execute(sql`UPDATE plugins SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${plugin.id}`);
          } catch { /* skip */ }
        }, REINDEX_CONCURRENCY);
        console.log(`[embed] plugins: ${allPlugins.length}件完了`);

        // memories
        const allMemories = await db.select().from(memories).where(sql`company_id = ${cid}`);
        await runConcurrent(allMemories, async (mem) => {
          try {
            const vec = await embedPassage(buildMemoryEmbedText(mem));
            await db.execute(sql`UPDATE memories SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${mem.id}`);
          } catch { /* skip */ }
        }, REINDEX_CONCURRENCY);
        console.log(`[embed] memories: ${allMemories.length}件完了`);

        // session_summaries
        const allSessions = await db.select().from(session_summaries).where(sql`company_id = ${cid}`);
        await runConcurrent(allSessions, async (sess) => {
          try {
            const vec = await embedPassage(buildSessionEmbedText(sess));
            await db.execute(sql`UPDATE session_summaries SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${sess.id}`);
          } catch { /* skip */ }
        }, REINDEX_CONCURRENCY);
        console.log(`[embed] sessions: ${allSessions.length}件完了`);

        // artifacts
        const allArtifacts = await db.select().from(artifacts).where(sql`company_id = ${cid}`);
        await runConcurrent(allArtifacts, async (art) => {
          try {
            const vec = await embedPassage(buildArtifactEmbedText(art));
            await db.execute(sql`UPDATE artifacts SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${art.id}`);
          } catch { /* skip */ }
        }, REINDEX_CONCURRENCY);
        console.log(`[embed] artifacts: ${allArtifacts.length}件完了`);

        console.log(`[embed] 再インデックス完了 company=${cid}`);
      } finally {
        reindexRunning.delete(cid);
      }
    })().catch((err) => {
      console.error('[embed] 再インデックスエラー:', err);
      reindexRunning.delete(cid);
    });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/embed/search?q=text&type=memories|sessions|artifacts&limit=10&min_similarity=0.5
 * memories / session_summaries / artifacts のセマンティック検索
 */
embedRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'クエリが必要です' });
      return;
    }

    const type = String(req.query.type ?? 'memories');
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const minSimilarity = Math.max(0, Math.min(1, Number(req.query.min_similarity ?? 0.5)));
    const cid = req.companyId!;
    const db = getDb();

    const vec = await embedQuery(q);
    const vecStr = `[${vec.join(',')}]`;

    let rows: unknown[];

    if (type === 'sessions') {
      const result = await db.execute(sql`
        SELECT id, headline, summary, created_at,
               1 - (embedding <=> ${vecStr}::vector) AS similarity
        FROM session_summaries
        WHERE company_id = ${cid}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${vecStr}::vector
        LIMIT ${limit}
      `);
      rows = result.rows;
    } else if (type === 'artifacts') {
      const result = await db.execute(sql`
        SELECT id, title, description, artifact_type, created_at,
               1 - (embedding <=> ${vecStr}::vector) AS similarity
        FROM artifacts
        WHERE company_id = ${cid}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${vecStr}::vector
        LIMIT ${limit}
      `);
      rows = result.rows;
    } else {
      // memories (default)
      const result = await db.execute(sql`
        SELECT id, title, content, type, created_at,
               1 - (embedding <=> ${vecStr}::vector) AS similarity
        FROM memories
        WHERE company_id = ${cid}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${vecStr}::vector
        LIMIT ${limit}
      `);
      rows = result.rows;
    }

    res.json({ data: rows, meta: { type, min_similarity: minSimilarity } });
  } catch (err) {
    next(err);
  }
});
