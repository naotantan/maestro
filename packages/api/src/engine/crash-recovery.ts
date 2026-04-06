/**
 * クラッシュ回復エンジン
 * - agent_runtime_stateテーブルを参照してクラッシュしたエージェントを検出する
 * - クラッシュ状態のエージェントを自動的に再起動する
 * - 再起動回数を追跡して無限ループを防止する
 */

import { getDb, agents, agent_runtime_state, heartbeat_runs, heartbeat_run_events } from '@maestro/db';
import { eq, and, count, gte } from 'drizzle-orm';

// クラッシュ回復チェック間隔（デフォルト60秒）
const RECOVERY_INTERVAL_MS = parseInt(process.env.RECOVERY_INTERVAL_MS || '60000', 10);
// 最大再起動回数（この回数を超えたら無効化）
const MAX_RESTART_COUNT = 3;

let recoveryTimer: ReturnType<typeof setInterval> | null = null;

interface RuntimeState {
  status: string;
  last_run_id?: string;
}

/**
 * クラッシュしたエージェントを検出して回復する
 */
async function recoverCrashedAgents(): Promise<void> {
  const db = getDb();

  try {
    // クラッシュ状態かつ有効なエージェントのみ取得（全件スキャンを回避）
    const crashedStates = await db
      .select({
        agent_id: agent_runtime_state.agent_id,
        state: agent_runtime_state.state,
        last_error: agent_runtime_state.last_error,
      })
      .from(agent_runtime_state)
      .innerJoin(agents, eq(agent_runtime_state.agent_id, agents.id))
      .where(eq(agents.enabled, true));

    for (const runtimeState of crashedStates) {
      const state = runtimeState.state as RuntimeState;
      if (state?.status !== 'crashed') continue;

      // restart_count は state JSON ではなく heartbeat_runs テーブルから取得する。
      // heartbeat-engine.ts が state を上書きするため、state に持たせても消えてしまう。
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedResult = await db
        .select({ cnt: count() })
        .from(heartbeat_runs)
        .where(and(
          eq(heartbeat_runs.agent_id, runtimeState.agent_id),
          eq(heartbeat_runs.status, 'failed'),
          gte(heartbeat_runs.started_at, twentyFourHoursAgo),
        ));
      const restartCount = failedResult[0]?.cnt ?? 0;

      if (restartCount >= MAX_RESTART_COUNT) {
        // 再起動上限に達した場合はエージェントを無効化
        await db.update(agents)
          .set({ enabled: false, updated_at: new Date() })
          .where(eq(agents.id, runtimeState.agent_id));

        await db.update(agent_runtime_state).set({
          state: { status: 'disabled', reason: '最大再起動回数超過', restart_count: restartCount },
          updated_at: new Date(),
        }).where(eq(agent_runtime_state.agent_id, runtimeState.agent_id));

        console.warn(`[CrashRecovery] エージェント ${runtimeState.agent_id} が最大再起動回数(${MAX_RESTART_COUNT})に達したため無効化`);
        continue;
      }

      const nextAttempt = restartCount + 1;
      console.log(`[CrashRecovery] エージェント ${runtimeState.agent_id} を回復中 (試行: ${nextAttempt}/${MAX_RESTART_COUNT})`);

      // heartbeat_run_eventsに回復ログを記録（最後の実行IDがある場合のみ）
      if (state.last_run_id) {
        await db.insert(heartbeat_run_events).values({
          heartbeat_run_id: state.last_run_id,
          event_type: 'recovery',
          log: `クラッシュ回復を試行 (${nextAttempt}回目)`,
          metadata: { attempt: nextAttempt, previous_error: runtimeState.last_error },
        }).catch(() => { /* 古いrun_idは存在しないことがある */ });
      }

      // idle状態に戻してheartbeatエンジンに次の実行を任せる
      // recovering の中間状態は設けない（heartbeat-engine と競合するため）
      await db.update(agent_runtime_state).set({
        state: { status: 'idle' },
        updated_at: new Date(),
      }).where(eq(agent_runtime_state.agent_id, runtimeState.agent_id));
    }
  } catch (err) {
    console.error('[CrashRecovery] 回復処理中にエラー:', err);
  }
}

/**
 * クラッシュ回復エンジンを起動する
 */
export function startCrashRecovery(): void {
  if (recoveryTimer) return; // 二重起動防止

  console.log(`[CrashRecovery] 起動 (間隔: ${RECOVERY_INTERVAL_MS}ms)`);

  recoveryTimer = setInterval(() => {
    recoverCrashedAgents().catch(console.error);
  }, RECOVERY_INTERVAL_MS);
}

/**
 * クラッシュ回復エンジンを停止する
 */
export function stopCrashRecovery(): void {
  if (recoveryTimer) {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
    console.log('[CrashRecovery] 停止');
  }
}
