import { Router, type Router as RouterType } from 'express';
import { getDb, notifications } from '@maestro/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const notificationsRouter: RouterType = Router();

// GET /api/notifications — 一覧（read フィルター・ページネーション）
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const readFilter = req.query.read;

    const conditions = [eq(notifications.company_id, req.companyId!)];
    if (readFilter === 'true') {
      conditions.push(eq(notifications.read, true));
    } else if (readFilter === 'false') {
      conditions.push(eq(notifications.read, false));
    }

    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      db.select({ cnt: sql<number>`count(*)::int` }).from(notifications).where(whereClause),
      db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.created_at))
        .limit(limit)
        .offset(offset),
    ]);

    res.json({
      data: rows,
      meta: { total: countResult[0]?.cnt ?? 0, limit, offset },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count — 未読数
notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const db = getDb();
    const [result] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.company_id, req.companyId!), eq(notifications.read, false)));

    res.json({ data: { count: result?.cnt ?? 0 } });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read — 既読
notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const db = getDb();
    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.company_id, req.companyId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: '通知が見つかりません' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all — 全既読
notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.company_id, req.companyId!), eq(notifications.read, false)));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notifications/:id — 削除
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, req.params.id), eq(notifications.company_id, req.companyId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: '通知が見つかりません' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
