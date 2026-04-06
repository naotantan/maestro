import { Router, type Router as RouterType } from 'express';
import { getDb, approvals, issues, companies } from '@maestro/db';
import { eq, desc, and } from 'drizzle-orm';

import { findOwnedApproval } from '../utils/ownership';

export const approvalsRouter: RouterType = Router();

/** 自動承認設定が有効かどうか確認 */
async function isAutoApproveEnabled(companyId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.select({ settings: companies.settings }).from(companies)
    .where(eq(companies.id, companyId)).limit(1);
  const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>;
  return settings.autoApprove === true;
}

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


// POST /api/approvals/auto-approve — 自動承認設定の切り替え
approvalsRouter.post('/auto-approve', async (req, res, next) => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'validation_failed', message: 'enabled は boolean です' });
      return;
    }
    const db = getDb();
    const rows = await db.select({ settings: companies.settings }).from(companies)
      .where(eq(companies.id, req.companyId!)).limit(1);
    const current = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    await db.update(companies)
      .set({ settings: { ...current, autoApprove: enabled }, updated_at: new Date() })
      .where(eq(companies.id, req.companyId!));

    // 有効化した場合、既存の pending 承認を全て自動承認
    if (enabled) {
      const pendingApprovals = await db
        .select({ id: approvals.id, issue_id: approvals.issue_id })
        .from(approvals)
        .innerJoin(issues, eq(approvals.issue_id, issues.id))
        .where(and(eq(issues.company_id, req.companyId!), eq(approvals.status, 'pending')));

      if (pendingApprovals.length > 0) {
        await db.update(approvals)
          .set({ status: 'approved', decided_at: new Date() })
          .where(eq(approvals.status, 'pending'));
      }
      res.json({ data: { enabled, auto_approved: pendingApprovals.length } });
    } else {
      res.json({ data: { enabled, auto_approved: 0 } });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/approvals/auto-approve — 自動承認設定状態取得
approvalsRouter.get('/auto-approve', async (req, res, next) => {
  try {
    const enabled = await isAutoApproveEnabled(req.companyId!);
    res.json({ data: { enabled } });
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post('/:approvalId/approve', async (req, res, next) => {
  try {
    const db = getDb();
    // 自社の承認レコードか確認
    const ownedApproval = await findOwnedApproval(db, req.companyId!, req.params.approvalId);
    if (!ownedApproval) {
      res.status(404).json({ error: 'not_found', message: '承認レコードが見つかりません' });
      return;
    }
    const updated = await db
      .update(approvals)
      .set({ status: 'approved', decided_at: new Date() })
      .where(and(eq(approvals.id, req.params.approvalId), eq(approvals.issue_id, ownedApproval.issue_id)))
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
    const ownedApproval = await findOwnedApproval(db, req.companyId!, req.params.approvalId);
    if (!ownedApproval) {
      res.status(404).json({ error: 'not_found', message: '承認レコードが見つかりません' });
      return;
    }
    const updated = await db
      .update(approvals)
      .set({ status: 'rejected', decided_at: new Date() })
      .where(and(eq(approvals.id, req.params.approvalId), eq(approvals.issue_id, ownedApproval.issue_id)))
      .returning();
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});
