import { Router, type Router as RouterType } from 'express';
import { getDb, companies, company_memberships, join_requests } from '@company/db';
import { eq, and } from 'drizzle-orm';
import { sanitizePagination } from '../middleware/validate';

export const orgRouter: RouterType = Router();

// GET /api/org — 組織情報取得
orgRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select().from(companies).where(eq(companies.id, req.companyId!)).limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: '組織が見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/org — 組織情報更新
orgRouter.patch('/', async (req, res, next) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    const db = getDb();
    const updated = await db
      .update(companies)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        updated_at: new Date(),
      })
      .where(eq(companies.id, req.companyId!))
      .returning();
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/org/members
orgRouter.get('/members', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const members = await db
      .select()
      .from(company_memberships)
      .where(eq(company_memberships.company_id, req.companyId!))
      .limit(limit)
      .offset(offset);
    res.json({ data: members, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/org/members/:userId
orgRouter.delete('/members/:userId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(company_memberships)
      .where(
        and(
          eq(company_memberships.company_id, req.companyId!),
          eq(company_memberships.user_id, req.params.userId)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/org/join-requests
orgRouter.get('/join-requests', async (req, res, next) => {
  try {
    const db = getDb();
    const requests = await db
      .select()
      .from(join_requests)
      .where(eq(join_requests.company_id, req.companyId!));
    res.json({ data: requests });
  } catch (err) {
    next(err);
  }
});

// POST /api/org/join-requests/:id/approve
orgRouter.post('/join-requests/:id/approve', async (req, res, next) => {
  try {
    const { role = 'member' } = req.body as { role?: string };
    const db = getDb();
    const rows = await db
      .select()
      .from(join_requests)
      .where(
        and(
          eq(join_requests.id, req.params.id),
          eq(join_requests.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'リクエストが見つかりません' });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(join_requests)
        .set({ status: 'approved', reviewed_at: new Date() })
        .where(eq(join_requests.id, req.params.id));
      await tx.insert(company_memberships).values({
        company_id: req.companyId!,
        user_id: rows[0].user_id,
        role,
      });
    });
    res.json({ id: req.params.id, status: 'approved' });
  } catch (err) {
    next(err);
  }
});

// POST /api/org/join-requests/:id/deny
orgRouter.post('/join-requests/:id/deny', async (req, res, next) => {
  try {
    const db = getDb();
    // 自社のリクエストのみ操作可能（アクセス制御）
    const existing = await db
      .select({ id: join_requests.id })
      .from(join_requests)
      .where(
        and(
          eq(join_requests.id, req.params.id),
          eq(join_requests.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: 'not_found', message: 'リクエストが見つかりません' });
      return;
    }
    await db
      .update(join_requests)
      .set({ status: 'denied', reviewed_at: new Date() })
      .where(eq(join_requests.id, req.params.id));
    res.json({ id: req.params.id, status: 'denied' });
  } catch (err) {
    next(err);
  }
});
