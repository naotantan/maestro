import { Router, type Router as RouterType } from 'express';
import { getDb, artifacts } from '@maestro/db';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const artifactsRouter: RouterType = Router();

// GET /api/artifacts — 成果物一覧
artifactsRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const { type, q } = req.query as { type?: string; q?: string };
    const db = getDb();

    let query = db
      .select()
      .from(artifacts)
      .where(
        and(
          eq(artifacts.company_id, req.companyId!),
          type && type !== 'all' ? eq(artifacts.type, type) : undefined,
          q ? or(
            ilike(artifacts.title, `%${q}%`),
            ilike(artifacts.description, `%${q}%`),
            ilike(artifacts.url, `%${q}%`),
            ilike(artifacts.file_path, `%${q}%`),
          ) : undefined,
        )
      )
      .orderBy(desc(artifacts.created_at))
      .limit(limit)
      .offset(offset);

    const rows = await query;
    res.json({ data: rows, meta: { limit, offset, total: rows.length } });
  } catch (err) {
    next(err);
  }
});

// POST /api/artifacts — 成果物を登録（fswatch・Stopフックから自動登録）
// {
//   session_id?: string   — Claude Code セッションID
//   type: string          — 'url' | 'file' | 'report' | 'image' | 'other'
//   title: string         — 成果物タイトル
//   description?: string  — 概要
//   prompt?: string       — 作成のきっかけとなった指示文
//   url?: string          — WebアーティファクトのURL
//   file_path?: string    — ファイルパス
//   tags?: string[]
//   meta?: object
// }
artifactsRouter.post('/', async (req, res, next) => {
  try {
    const { session_id, type, title, description, prompt, content, url, file_path, tags, meta } = req.body as {
      session_id?: string;
      type?: string;
      title?: string;
      description?: string;
      prompt?: string;
      content?: string;
      url?: string;
      file_path?: string;
      tags?: string[];
      meta?: Record<string, unknown>;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'title は必須です' });
      return;
    }

    const db = getDb();

    // url または file_path が既に登録済みの場合は重複スキップ（冪等性）
    if (url || file_path) {
      const existing = await db
        .select({ id: artifacts.id })
        .from(artifacts)
        .where(
          and(
            eq(artifacts.company_id, req.companyId!),
            session_id ? eq(artifacts.session_id, session_id) : undefined,
            url ? eq(artifacts.url, url) : eq(artifacts.file_path, file_path!),
          )
        )
        .limit(1);
      if (existing.length > 0) {
        res.status(200).json({ data: existing[0], duplicate: true });
        return;
      }
    }

    const [inserted] = await db.insert(artifacts).values({
      company_id: req.companyId!,
      session_id: session_id ?? null,
      type: type ?? 'file',
      title: sanitizeString(title.trim()).slice(0, 500),
      description: description ? sanitizeString(description.trim()) : null,
      prompt: prompt ? sanitizeString(prompt.trim()) : null,
      content: content ?? null,
      url: url ?? null,
      file_path: file_path ?? null,
      tags: Array.isArray(tags) ? tags.map(t => sanitizeString(t)) : null,
      meta: meta ?? null,
    }).returning();

    res.status(201).json({ data: inserted });
  } catch (err) {
    next(err);
  }
});

// GET /api/artifacts/:id — 個別取得
artifactsRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.id, req.params.id), eq(artifacts.company_id, req.companyId!)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: 'not_found', message: '成果物が見つかりません' });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/artifacts/:id — 更新
artifactsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { title, description, prompt, content, tags, meta } = req.body as {
      title?: string;
      description?: string;
      prompt?: string;
      content?: string;
      tags?: string[];
      meta?: Record<string, unknown>;
    };

    const db = getDb();
    const fields: Record<string, unknown> = { updated_at: new Date() };
    if (title !== undefined) fields.title = sanitizeString(title.trim()).slice(0, 500);
    if (description !== undefined) fields.description = description ? sanitizeString(description.trim()) : null;
    if (prompt !== undefined) fields.prompt = prompt ? sanitizeString(prompt.trim()) : null;
    if (content !== undefined) fields.content = content ?? null;
    if (tags !== undefined) fields.tags = Array.isArray(tags) ? tags.map(t => sanitizeString(t)) : null;
    if (meta !== undefined) fields.meta = meta;

    const [updated] = await db
      .update(artifacts)
      .set(fields)
      .where(and(eq(artifacts.id, req.params.id), eq(artifacts.company_id, req.companyId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: '成果物が見つかりません' });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/artifacts/:id — 削除
artifactsRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(artifacts)
      .where(and(eq(artifacts.id, req.params.id), eq(artifacts.company_id, req.companyId!)))
      .returning({ id: artifacts.id });

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: '成果物が見つかりません' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
