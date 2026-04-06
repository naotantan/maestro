import { getDb, issues, goals, agents, approvals } from '@maestro/db';
import { eq, and } from 'drizzle-orm';

type Db = ReturnType<typeof getDb>;

/**
 * 指定 Issue が自社所有かを確認する
 * @returns `{ id }` or `null`
 */
export async function findOwnedIssue(
  db: Db,
  companyId: string,
  issueId: string,
) {
  const rows = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), eq(issues.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 Goal が自社所有かを確認する
 * @returns `{ id }` or `null`
 */
export async function findOwnedGoal(
  db: Db,
  companyId: string,
  goalId: string,
) {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 Agent が自社所有かを確認する（ID のみ返す軽量版）
 * @returns `{ id }` or `null`
 */
export async function findOwnedAgent(
  db: Db,
  companyId: string,
  agentId: string,
) {
  const rows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 Agent が自社所有かを確認する（詳細情報付き）
 * handoffs ルートなど、type/config/enabled も必要なケースで使用
 * @returns `{ id, type, config, enabled }` or `null`
 */
export async function findOwnedAgentWithDetails(
  db: Db,
  companyId: string,
  agentId: string,
) {
  const rows = await db
    .select({ id: agents.id, type: agents.type, config: agents.config, enabled: agents.enabled })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 自社の承認レコードか確認する（issue 経由で company_id を特定）
 * @returns `{ id, issue_id }` or `null`
 */
export async function findOwnedApproval(
  db: Db,
  companyId: string,
  approvalId: string,
) {
  const rows = await db
    .select({ id: approvals.id, issue_id: approvals.issue_id })
    .from(approvals)
    .innerJoin(issues, eq(approvals.issue_id, issues.id))
    .where(and(eq(approvals.id, approvalId), eq(issues.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}
