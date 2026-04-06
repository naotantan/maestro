import { Router, type Router as RouterType } from 'express';
import { getDb, webhooks } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const webhooksRouter: RouterType = Router();

// GET /api/webhooks — 一覧
webhooksRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);

    const rows = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.company_id, req.companyId!))
      .orderBy(desc(webhooks.created_at))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks — 新規作成
webhooksRouter.post('/', async (req, res, next) => {
  try {
    const { name, url, events, secret, enabled } = req.body as {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
      enabled?: boolean;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'name は必須です' });
      return;
    }
    if (!url?.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'url は必須です' });
      return;
    }
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'validation_failed', message: 'events は1件以上の配列で指定してください' });
      return;
    }

    const db = getDb();
    const [created] = await db
      .insert(webhooks)
      .values({
        company_id: req.companyId!,
        name: sanitizeString(name.trim()),
        url: url.trim(),
        events: events.map((e) => sanitizeString(String(e))),
        secret: secret ? sanitizeString(secret) : null,
        enabled: enabled !== false,
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// PUT /api/webhooks/:id — 更新
webhooksRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, url, events, secret, enabled } = req.body as {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
      enabled?: boolean;
    };

    const updateFields: Record<string, unknown> = {};
    if (name !== undefined) updateFields.name = sanitizeString(name.trim());
    if (url !== undefined) updateFields.url = url.trim();
    if (events !== undefined) updateFields.events = Array.isArray(events) ? events.map((e) => sanitizeString(String(e))) : [];
    if (secret !== undefined) updateFields.secret = secret ? sanitizeString(secret) : null;
    if (enabled !== undefined) updateFields.enabled = enabled;

    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({ error: 'validation_failed', message: '更新するフィールドがありません' });
      return;
    }

    const db = getDb();
    const [updated] = await db
      .update(webhooks)
      .set(updateFields)
      .where(and(eq(webhooks.id, req.params.id), eq(webhooks.company_id, req.companyId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: 'Webhookが見つかりません' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/webhooks/:id — 削除
webhooksRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, req.params.id), eq(webhooks.company_id, req.companyId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: 'Webhookが見つかりません' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks/:id/test — テスト送信
webhooksRouter.post('/:id/test', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, req.params.id), eq(webhooks.company_id, req.companyId!)))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Webhookが見つかりません' });
      return;
    }

    const webhook = rows[0];
    const payload = { event: 'test', timestamp: new Date().toISOString() };

    let success = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      statusCode = response.status;
      success = response.ok;
    } catch (fetchErr) {
      errorMessage = fetchErr instanceof Error ? fetchErr.message : 'リクエスト失敗';
    }

    // last_triggered_at を更新
    await db
      .update(webhooks)
      .set({ last_triggered_at: new Date() })
      .where(eq(webhooks.id, webhook.id));

    res.json({ success, status_code: statusCode, error: errorMessage });
  } catch (err) {
    next(err);
  }
});
