/**
 * Heartbeatエンジン
 * - 有効なエージェントを定期的に起動し、ハートビート実行を記録する
 * - @maestro/adapters の createAdapter でエージェントタイプに応じたアダプターを生成
 * - クラッシュ時はcrash-recoveryモジュールと連携して自動回復する
 */

import { getDb, agents, heartbeat_runs, heartbeat_run_events, agent_runtime_state, agent_handoffs, agent_task_sessions } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
import type { AgentType } from '@maestro/shared';

// @maestro/adapters は ESM のため CJS コンテキストから static import できない。
// dynamic import で使用する。AdapterConfig は @maestro/adapters/base.ts と
// 同一形状を維持する必要がある（乖離防止のため型コメントで出典を明記）。
// 出典: packages/adapters/src/base.ts AdapterConfig
type AdapterConfig = {
  apiKey?: string;   // APIキー
  baseUrl?: string;  // エンドポイントURL上書き
  model?: string;    // モデル名
  timeout?: number;  // タイムアウト秒
};

// ハートビート間隔（デフォルト30秒）
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);

// エンジン稼働フラグ
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 1エージェントのハートビートを実行する
 */
async function runAgentHeartbeat(
  agentId: string,
  companyId: string,
  agentType: AgentType,
  agentConfig: AdapterConfig,
): Promise<void> {
  const db = getDb();

  // 実行ログをDBに記録（開始）
  const runRecord = await db.insert(heartbeat_runs).values({
    agent_id: agentId,
    status: 'running',
  }).returning();
  const runId = runRecord[0].id;

  try {
    // agent_runtime_stateに実行中を記録
    await db.insert(agent_runtime_state).values({
      agent_id: agentId,
      state: { status: 'running', run_id: runId },
    }).onConflictDoUpdate({
      target: agent_runtime_state.agent_id,
      set: {
        state: { status: 'running', run_id: runId },
        last_error: null,
        updated_at: new Date(),
      },
    });

    // アダプターを生成してハートビートを確認
    // @maestro/adapters は ESM のため dynamic import で読み込む
    const { createAdapter } = await import('@maestro/adapters');
    const adapter = createAdapter(agentType, agentConfig);
    const heartbeatResult = await adapter.heartbeat();

    // ハートビートが alive でなければエラー扱い
    if (!heartbeatResult.alive) {
      throw new Error(`エージェント (${agentType}) が応答しません`);
    }

    // last_heartbeat_at を更新
    await db.update(agents)
      .set({ last_heartbeat_at: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)));

    // 実行完了を記録
    await db.update(heartbeat_runs).set({
      status: 'completed',
      ended_at: new Date(),
      result_summary: { success: true, alive: true, version: heartbeatResult.version },
    }).where(eq(heartbeat_runs.id, runId));

    // ランタイム状態を完了に更新
    await db.update(agent_runtime_state).set({
      state: { status: 'idle', last_run_id: runId },
      updated_at: new Date(),
    }).where(eq(agent_runtime_state.agent_id, agentId));

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // 失敗を記録
    await db.update(heartbeat_runs).set({
      status: 'failed',
      ended_at: new Date(),
      result_summary: { success: false, error: errorMessage },
    }).where(eq(heartbeat_runs.id, runId));

    // agent_runtime_stateにエラーを記録（クラッシュ回復用）
    await db.update(agent_runtime_state).set({
      state: { status: 'crashed', last_run_id: runId },
      last_error: errorMessage,
      updated_at: new Date(),
    }).where(eq(agent_runtime_state.agent_id, agentId));

    // イベントログ
    await db.insert(heartbeat_run_events).values({
      heartbeat_run_id: runId,
      event_type: 'error',
      log: `エージェント実行エラー: ${errorMessage}`,
    });
  }
}

/**
 * 全有効エージェントのハートビートを実行する
 */
async function runAllHeartbeats(): Promise<void> {
  try {
    const db = getDb();
    // type と config も取得してアダプター生成に使用する
    const activeAgents = await db.select({
      id: agents.id,
      company_id: agents.company_id,
      type: agents.type,
      config: agents.config,
    }).from(agents).where(eq(agents.enabled, true));

    if (activeAgents.length === 0) return;

    // 最大3並列でハートビートを実行
    const MAX_PARALLEL = 3;
    for (let i = 0; i < activeAgents.length; i += MAX_PARALLEL) {
      const batch = activeAgents.slice(i, i + MAX_PARALLEL);
      await Promise.allSettled(
        batch.map(a => runAgentHeartbeat(
          a.id,
          a.company_id,
          a.type as AgentType,
          (a.config as AdapterConfig) ?? {},
        ))
      );
    }
    // 引き継ぎ処理（ハートビートとは独立して実行）
    await processHandoffs();
  } catch (err) {
    console.error('[HeartbeatEngine] スキャン中にエラー:', err);
  }
}

/**
 * pending 状態の引き継ぎを自動実行する（既存のハートビート処理とは独立）
 * runAllHeartbeats() の末尾から呼ばれる
 */
async function processHandoffs(): Promise<void> {
  try {
    const db = getDb();

    // pending の引き継ぎを最大2件取得（並列処理の上限）
    const pending = await db
      .select()
      .from(agent_handoffs)
      .where(eq(agent_handoffs.status, 'pending'))
      .limit(2);

    if (pending.length === 0) return;

    await Promise.allSettled(pending.map(async (handoff) => {
      // running に更新
      await db.update(agent_handoffs)
        .set({ status: 'running', started_at: new Date() })
        .where(eq(agent_handoffs.id, handoff.id));

      try {
        // from_agent の最新セッション結果を context として取得
        const lastSession = await db
          .select({ result: agent_task_sessions.result })
          .from(agent_task_sessions)
          .where(eq(agent_task_sessions.agent_id, handoff.from_agent_id))
          .orderBy(desc(agent_task_sessions.started_at))
          .limit(1);
        const context = lastSession[0]?.result ?? undefined;

        // to_agent の情報を取得
        const toAgentRows = await db
          .select({ type: agents.type, config: agents.config })
          .from(agents)
          .where(eq(agents.id, handoff.to_agent_id))
          .limit(1);
        if (!toAgentRows[0]) throw new Error('to_agent が見つかりません');

        const toAgent = toAgentRows[0];

        // アダプター経由でタスク実行
        const { createAdapter } = await import('@maestro/adapters');
        const adapter = createAdapter(toAgent.type as AgentType, (toAgent.config as AdapterConfig) ?? {});
        const response = await adapter.runTask({
          taskId: handoff.id,
          prompt: handoff.prompt,
          context: context ?? undefined,
        });

        const finalStatus = response.finishReason === 'error' ? 'failed' : 'completed';
        const finalResult = response.output || null;

        // 成功: completed に更新
        await db.update(agent_handoffs)
          .set({
            status: finalStatus,
            result: finalResult,
            context: context ?? null,
            error: response.error ?? null,
            completed_at: new Date(),
          })
          .where(eq(agent_handoffs.id, handoff.id));

        // チェーン: completed かつ next_agent_id がある場合は次 handoff を自動生成
        if (finalStatus === 'completed' && handoff.next_agent_id) {
          await db.insert(agent_handoffs).values({
            company_id: handoff.company_id,
            from_agent_id: handoff.to_agent_id,          // 前の to が次の from
            to_agent_id: handoff.next_agent_id,
            issue_id: handoff.issue_id ?? null,
            status: 'pending',
            prompt: handoff.next_prompt ?? handoff.prompt, // next_prompt 優先
            context: finalResult,                          // 前の result を context に
            chain_id: handoff.chain_id ?? handoff.id,     // 連鎖グループID引き継ぎ
          });
          console.log(`[HeartbeatEngine] チェーン handoff 生成: ${handoff.to_agent_id} → ${handoff.next_agent_id}`);
        }

      } catch (err) {
        // 失敗: failed に更新
        await db.update(agent_handoffs)
          .set({
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            completed_at: new Date(),
          })
          .where(eq(agent_handoffs.id, handoff.id));
      }
    }));
  } catch (err) {
    console.error('[HeartbeatEngine] processHandoffs エラー:', err);
  }
}

/**
 * ハートビートエンジンを起動する
 */
export function startHeartbeatEngine(): void {
  if (heartbeatTimer) return; // 二重起動防止

  console.log(`[HeartbeatEngine] 起動 (間隔: ${HEARTBEAT_INTERVAL_MS}ms)`);

  // 起動直後に一度実行
  runAllHeartbeats().catch(console.error);

  heartbeatTimer = setInterval(() => {
    runAllHeartbeats().catch(console.error);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * ハートビートエンジンを停止する
 */
export function stopHeartbeatEngine(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[HeartbeatEngine] 停止');
  }
}
