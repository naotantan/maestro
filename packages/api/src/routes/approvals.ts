import { Router, type Router as RouterType } from 'express';
import { getDb, approvals, issues } from '@maestro/db';
import { eq, desc, and } from 'drizzle-orm';

export const approvalsRouter: RouterType = Router();

approvalsRouter.get('/', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const db = getDb();
    // approvals は issue 経由で company_id を特定する
    const rows = await db
      .select({
        id: approvals.id,
        issue_id: approvals.issue_id,
        approver_id: approvals.approver_id,
        status: approvals.status,
        created_at: approvals.created_at,
        decided_at: approvals.decided_at,
      })
      .from(approvals)
      .innerJoin(issues, eq(approvals.issue_id, issues.id))
      .where(
        and(
          eq(issues.company_id, req.companyId!),
          status ? eq(approvals.status, status) : undefined,
        )
      )
      .orderBy(desc(approvals.created_at))
      .limit(50);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** 自社の承認レコードか確認するヘルパー */
async function findOwnedApproval(
  db: ReturnType<typeof getDb>,
  companyId: string,
  approvalId: string,
) {
  const rows = await db
    .select({ id: approvals.id })
    .from(approvals)
    .innerJoin(issues, eq(approvals.issue_id, issues.id))
    .where(and(eq(approvals.id, approvalId), eq(issues.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

approvalsRouter.post('/:approvalId/approve', async (req, res, next) => {
  try {
    const db = getDb();
    // 自社の承認レコードか確認
    if (!(await findOwnedApproval(db, req.companyId!, req.params.approvalId))) {
      res.status(404).json({ error: 'not_found', message: '承認レコードが見つかりません' });
      return;
    }
    const updated = await db
      .update(approvals)
      .set({ status: 'approved', decided_at: new Date() })
      .where(eq(approvals.id, req.params.approvalId))
      .returning();
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:approvalId/reject', async (req, res, next) => {
  try {
    const db = getDb();
    // 自社の承認レコードか確認
    if (!(await findOwnedApproval(db, req.companyId!, req.params.approvalId))) {
      res.status(404).json({ error: 'not_found', message: '承認レコードが見つかりません' });
      return;
    }
    const updated = await db
      .update(approvals)
      .set({ status: 'rejected', decided_at: new Date() })
      .where(eq(approvals.id, req.params.approvalId))
      .returning();
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});
