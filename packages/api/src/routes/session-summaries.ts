import { Router, type Router as RouterType } from 'express';
import { getDb, session_summaries, issues, plugins, activity_log } from '@maestro/db';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const sessionSummariesRouter: RouterType = Router();

/**
 * セッションテキストからスキル使用を検出して usage_count / last_used_at を更新する
 * @param companyId  テナント ID
 * @param textParts  スキャン対象のテキスト断片（summary, tasks, changed_files など）
 * @param explicitSkillNames  明示的に指定されたスキル名（/commit → "commit" 形式）
 */
async function detectAndUpdateSkillUsage(
  companyId: string,
  textParts: (string | null | undefined)[],
  explicitSkillNames?: string[],
): Promise<void> {
  try {
    const db = getDb();
    const enabledPlugins = await db
      .select({ id: plugins.id, name: plugins.name })
      .from(plugins)
      .where(and(eq(plugins.company_id, companyId), eq(plugins.enabled, true)));

    if (enabledPlugins.length === 0) return;

    const usedPluginIds = new Set<string>();

    // 明示的に指定されたスキル名から ID を解決
    if (Array.isArray(explicitSkillNames) && explicitSkillNames.length > 0) {
      const normalizedExplicit = explicitSkillNames.map(s =>
        s.toLowerCase().replace(/^\//, '').trim()
      );
      for (const plugin of enabledPlugins) {
        const pluginName = plugin.name.toLowerCase().replace(/^\//, '').trim();
        if (normalizedExplicit.includes(pluginName)) {
          usedPluginIds.add(plugin.id);
        }
      }
    }

    // テキストスキャンによるスキル検出
    const allText = textParts
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (allText.trim()) {
      for (const plugin of enabledPlugins) {
        if (usedPluginIds.has(plugin.id)) continue; // 既に明示済み
        // スキル名を正規化:
        //   - ハイフン・アンダースコア → 任意の区切り文字（[-_]?）
        //   - スペース → 任意の区切り文字（[-_\s]?）
        // 例: "Claude Code" → claude[-_\s]?code
        const escaped = plugin.name.toLowerCase()
          .replace(/^\//, '')                           // 先頭のスラッシュを除去
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');    // 特殊文字をエスケープ
        const normalized = escaped
          .replace(/[_-]/g, '[-_]?')
          .replace(/\s+/g, '[-_\\s]?');
        // スラッシュコマンド形式（/skill-name）にもマッチ
        const pattern = new RegExp(`(?:^|[^a-z0-9])\\/?${normalized}(?:[^a-z0-9]|$)`);
        if (pattern.test(allText)) {
          usedPluginIds.add(plugin.id);
        }
      }
    }

    if (usedPluginIds.size > 0) {
      await db
        .update(plugins)
        .set({
          usage_count: sql`${plugins.usage_count} + 1`,
          last_used_at: new Date(),
          updated_at: new Date(),
        })
        .where(and(
          inArray(plugins.id, Array.from(usedPluginIds)),
          eq(plugins.company_id, companyId),
        ));
      console.log(`[SessionSummaries] スキル使用を検出・更新: ${usedPluginIds.size}件`);
    }
  } catch (skillErr) {
    console.error('[SessionSummaries] スキル使用検出エラー:', skillErr);
  }
}

// GET /api/session-summaries — 作業記録一覧（新しい順）
sessionSummariesRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const rows = await db
      .select()
      .from(session_summaries)
      .where(eq(session_summaries.company_id, req.companyId!))
      .orderBy(desc(session_summaries.session_ended_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/session-summaries — SessionEnd フックから自動登録
// リクエスト:
// {
//   session_id?: string         // Claude Code のセッション ID
//   agent_id?: string           // エージェント ID（オプション）
//   summary: string             // 作業サマリー本文
//   changed_files?: string[]    // 変更・作成ファイル一覧
//   related_issue_ids?: string[] // 関連 Issue ID
//   session_started_at?: string // セッション開始時刻（ISO 8601）
//   used_skill_names?: string[] // 明示的に使用したスキル名（/skill-name 形式、先頭スラッシュ不要）
// }
sessionSummariesRouter.post('/', async (req, res, next) => {
  try {
    const {
      session_id,
      agent_id,
      summary,
      headline,
      tasks,
      decisions,
      changed_files,
      related_issue_ids,
      session_started_at,
      used_skill_names,
    } = req.body as {
      session_id?: string;
      agent_id?: string;
      summary?: string;
      headline?: string;
      tasks?: string[];
      decisions?: string[];
      changed_files?: string[];
      related_issue_ids?: string[];
      session_started_at?: string;
      used_skill_names?: string[];
    };

    if (!summary || !summary.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'summary は必須です' });
      return;
    }

    const db = getDb();

    // session_id が指定されている場合は upsert（既存なら更新、なければ新規登録）
    if (session_id) {
      const existing = await db
        .select({ id: session_summaries.id })
        .from(session_summaries)
        .where(and(
          eq(session_summaries.company_id, req.companyId!),
          eq(session_summaries.session_id, session_id)
        ))
        .limit(1);

      if (existing.length > 0) {
        // 既存レコードを更新（進行中セッションの上書き）
        const updated = await db
          .update(session_summaries)
          .set({
            summary: summary ? sanitizeString(summary.trim()) : undefined,
            headline: headline ? sanitizeString(headline.trim()).slice(0, 500) : undefined,
            tasks: Array.isArray(tasks) ? tasks.map(t => sanitizeString(t)) : undefined,
            decisions: Array.isArray(decisions) ? decisions.map(d => sanitizeString(d)) : undefined,
            changed_files: Array.isArray(changed_files) ? changed_files : undefined,
            related_issue_ids: Array.isArray(related_issue_ids) ? related_issue_ids : undefined,
            session_ended_at: new Date(),
          })
          .where(and(
            eq(session_summaries.id, existing[0].id),
            eq(session_summaries.company_id, req.companyId!)
          ))
          .returning();

        // activity_log に「セッション更新」を記録
        getDb().insert(activity_log).values({
          company_id: req.companyId!,
          entity_type: 'session',
          entity_id: existing[0].id,
          action: 'update',
          changes: { session_id, headline: headline ?? null },
        }).catch(() => {});

        // スキル使用検出（UPSERTパスでも必ず実行）
        detectAndUpdateSkillUsage(req.companyId!, [
          summary,
          agent_id,
          ...(Array.isArray(tasks) ? tasks : []),
          ...(Array.isArray(decisions) ? decisions : []),
          ...(Array.isArray(changed_files) ? changed_files : []),
        ], used_skill_names).catch(() => {});

        res.status(200).json({ data: updated[0], updated: true });
        return;
      }
    }

    const inserted = await db.insert(session_summaries).values({
      company_id: req.companyId!,
      session_id: session_id ?? null,
      agent_id: agent_id ?? null,
      summary: sanitizeString(summary.trim()),
      headline: headline ? sanitizeString(headline.trim()).slice(0, 500) : null,
      tasks: Array.isArray(tasks) ? tasks.map(t => sanitizeString(t)) : null,
      decisions: Array.isArray(decisions) ? decisions.map(d => sanitizeString(d)) : null,
      changed_files: Array.isArray(changed_files) ? changed_files : null,
      related_issue_ids: Array.isArray(related_issue_ids) ? related_issue_ids : null,
      session_started_at: session_started_at ? new Date(session_started_at) : null,
      session_ended_at: new Date(),
    }).returning();

    // activity_log に「セッション記録」を追記
    getDb().insert(activity_log).values({
      company_id: req.companyId!,
      entity_type: 'session',
      entity_id: inserted[0].id,
      action: 'create',
      changes: { session_id: session_id ?? null, headline: headline ?? null },
    }).catch(() => {});

    // 関連Issue IDが提供されている場合、それらを'done'ステータスに自動更新
    if (Array.isArray(related_issue_ids) && related_issue_ids.length > 0) {
      const resolvedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const summarySnippet = sanitizeString(summary.trim()).slice(0, 300);
      const resolutionNote = `\n\n---\n**対応完了** (${resolvedAt})\nセッション作業にて対応。\n概要: ${summarySnippet}`;
      const issueRows = await db.select({ id: issues.id, description: issues.description })
        .from(issues).where(
          and(
            inArray(issues.id, related_issue_ids),
            eq(issues.company_id, req.companyId!) // 自社Issueのみ対象
          )
        );
      await db.transaction(async (tx) => {
        await Promise.all(issueRows.map(issue =>
          tx.update(issues)
            .set({
              status: 'done',
              description: issue.description?.includes('**対応完了**')
                ? issue.description
                : ((issue.description ?? '') + resolutionNote).trim(),
              updated_at: new Date(),
            })
            .where(eq(issues.id, issue.id))
        ));
      });
      console.log(`[SessionSummaries] ${related_issue_ids.length}件のIssueをdoneに更新（対応内容追記済み）`);
    }

    // スキル使用を自動検出してusage_countをインクリメント（ヘルパー関数に委譲）
    detectAndUpdateSkillUsage(req.companyId!, [
      summary,
      agent_id,
      ...(Array.isArray(tasks) ? tasks : []),
      ...(Array.isArray(decisions) ? decisions : []),
      ...(Array.isArray(changed_files) ? changed_files : []),
    ], used_skill_names).catch(() => {});

    res.status(201).json({ data: inserted[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/session-summaries/:id — 個別取得
sessionSummariesRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(session_summaries)
      .where(and(
        eq(session_summaries.id, req.params.id),
        eq(session_summaries.company_id, req.companyId!) // 他テナントへのアクセス防止
      ))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'セッション記録が見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/session-summaries/:id — サマリー更新（upsert用）
sessionSummariesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { summary, headline, tasks, decisions, changed_files, related_issue_ids } = req.body as {
      summary?: string;
      headline?: string;
      tasks?: string[];
      decisions?: string[];
      changed_files?: string[];
      related_issue_ids?: string[];
    };

    const db = getDb();
    const updateFields: Record<string, unknown> = { session_ended_at: new Date() };
    if (summary !== undefined) updateFields.summary = sanitizeString(summary.trim());
    if (headline !== undefined) updateFields.headline = headline ? sanitizeString(headline.trim()).slice(0, 500) : null;
    if (tasks !== undefined) updateFields.tasks = Array.isArray(tasks) ? tasks.map(t => sanitizeString(t)) : null;
    if (decisions !== undefined) updateFields.decisions = Array.isArray(decisions) ? decisions.map(d => sanitizeString(d)) : null;
    if (changed_files !== undefined) updateFields.changed_files = Array.isArray(changed_files) ? changed_files : null;
    if (related_issue_ids !== undefined) updateFields.related_issue_ids = Array.isArray(related_issue_ids) ? related_issue_ids : null;

    const updated = await db
      .update(session_summaries)
      .set(updateFields)
      .where(and(
        eq(session_summaries.id, req.params.id),
        eq(session_summaries.company_id, req.companyId!) // 他テナントの記録を上書き防止
      ))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'セッション記録が見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});
