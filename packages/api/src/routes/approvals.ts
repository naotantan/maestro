import { Router, type Router as RouterType } from 'express';
import { getDb, approvals } from '@company/db';
import { eq, desc } from 'drizzle-orm';

export const approvalsRouter: RouterType = Router();

approvalsRouter.get('/', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const db = getDb();
    // approvals は issue に紐づくため company_id 直接フィルターなし（issue 経由で制御）
    const rows = await db
      .select()
      .from(approvals)
      .where(status ? eq(approvals.status, status) : undefined)
      .orderBy(desc(approvals.created_at))
      .limit(50);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:approvalId/approve', async (req, res, next) => {
  try {
    const db = getDb();
    const updated = await db
      .update(approvals)
      .set({ status: 'approved', decided_at: new Date() })
      .where(eq(approvals.id, req.params.approvalId))
      .returning();
    if (!updated.length) {
      res.status(404).json({
        error: 'not_found',
        message: '承認レコードが見つかりません',
      });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:approvalId/reject', async (req, res, next) => {
  try {
    const db = getDb();
    const updated = await db
      .update(approvals)
      .set({ status: 'rejected', decided_at: new Date() })
      .where(eq(approvals.id, req.params.approvalId))
      .returning();
    if (!updated.length) {
      res.status(404).json({
        error: 'not_found',
        message: '承認レコードが見つかりません',
      });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});
