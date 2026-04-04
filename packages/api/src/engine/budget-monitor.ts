import { getDb, budget_policies, cost_events, agents, budget_incidents } from '@maestro/db';
import { eq, and, gte, sql } from 'drizzle-orm';

const BUDGET_CHECK_INTERVAL_MS = parseInt(process.env.BUDGET_CHECK_INTERVAL_MS || '60000', 10); // 1分

let timer: NodeJS.Timeout | null = null;

/**
 * 予算超過チェックを全社に対して実行する。
 * 超過した場合: 全エージェントを disabled にして budget_incidents に記録する。
 */
async function checkBudgets(): Promise<void> {
  const db = getDb();

  // 全社の予算ポリシーを取得
  const policies = await db.select().from(budget_policies);

  for (const policy of policies) {
    try {
      // 当月の集計期間を計算（月次のみ対応）
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 当月のコスト集計（agents 経由で company_id を絞る）
      const costResult = await db
        .select({ total: sql<string>`COALESCE(SUM(ce.cost_usd), 0)` })
        .from(cost_events)
        .innerJoin(agents, eq(cost_events.agent_id, agents.id))
        .where(and(
          eq(agents.company_id, policy.company_id),  // プリペアドステートメントで安全に絞り込み
          gte(cost_events.created_at, periodStart)
        ));

      const totalCost = parseFloat(costResult[0]?.total ?? '0');
      const limitAmount = parseFloat(policy.limit_amount_usd as string);

      if (totalCost >= limitAmount) {
        // 予算超過: 全エージェントを自動停止
        const enabledAgents = await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.company_id, policy.company_id));

        for (const agent of enabledAgents) {
          await db.update(agents)
            .set({ enabled: false, updated_at: new Date() })
            .where(eq(agents.id, agent.id));

          await db.insert(budget_incidents).values({
            agent_id: agent.id,
            amount_usd: String(totalCost),
            auto_stopped: true,
          });
        }

        console.log(
          `[BudgetMonitor] company=${policy.company_id} 予算超過 ` +
          `$${totalCost.toFixed(4)} >= $${limitAmount.toFixed(2)} → ${enabledAgents.length}件停止`
        );
      }
    } catch (err) {
      console.error(`[BudgetMonitor] policy=${policy.id} チェックエラー:`, err);
    }
  }
}

export function startBudgetMonitor(): void {
  if (timer) return;
  // 起動直後に1回実行してから定期実行
  checkBudgets().catch(console.error);
  timer = setInterval(() => {
    checkBudgets().catch(console.error);
  }, BUDGET_CHECK_INTERVAL_MS);
  console.log(`[BudgetMonitor] 起動（間隔: ${BUDGET_CHECK_INTERVAL_MS}ms）`);
}

export function stopBudgetMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[BudgetMonitor] 停止');
  }
}
