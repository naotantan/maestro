/**
 * クラッシュ回復エンジン
 * - agent_runtime_stateテーブルを参照してクラッシュしたエージェントを検出する
 * - クラッシュ状態のエージェントを自動的に再起動する
 * - 再起動回数を追跡して無限ループを防止する
 */

import { getDb, agents, agent_runtime_state, heartbeat_run_events } from '@company/db';
import { eq, and } from 'drizzle-orm';

// クラッシュ回復チェック間隔（デフォルト60秒）
const RECOVERY_INTERVAL_MS = parseInt(process.env.RECOVERY_INTERVAL_MS || '60000', 10);
// 最大再起動回数（この回数を超えたら無効化）
const MAX_RESTART_COUNT = 3;

let recoveryTimer: ReturnType<typeof setInterval> | null = null;

interface RuntimeState {
  status: string;
  restart_count?: number;
  last_run_id?: string;
}

/**
 * クラッシュしたエージェントを検出して回復する
 */
async function recoverCrashedAgents(): Promise<void> {
  const db = getDb();

  try {
    // クラッシュ状態のエージェントを全取得
    const crashedStates = await db
      .select()
      .from(agent_runtime_state);

    for (const runtimeState of crashedStates) {
      const state = runtimeState.state as RuntimeState;
      if (state?.status !== 'crashed') continue;

      const restartCount = state.restart_count ?? 0;

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

      // エージェントが有効かチェック
      const agentRows = await db.select({ id: agents.id, enabled: agents.enabled })
        .from(agents)
        .where(and(eq(agents.id, runtimeState.agent_id), eq(agents.enabled, true)));

      if (!agentRows.length) continue;

      // 再起動カウントを更新して回復中状態に設定
      const newRestartCount = restartCount + 1;
      await db.update(agent_runtime_state).set({
        state: { status: 'recovering', restart_count: newRestartCount },
        last_error: runtimeState.last_error,
        updated_at: new Date(),
      }).where(eq(agent_runtime_state.agent_id, runtimeState.agent_id));

      console.log(`[CrashRecovery] エージェント ${runtimeState.agent_id} を回復中 (試行: ${newRestartCount}/${MAX_RESTART_COUNT})`);

      // heartbeat_run_eventsに回復ログを記録
      // 最後の実行IDがある場合のみ記録
      if (state.last_run_id) {
        await db.insert(heartbeat_run_events).values({
          heartbeat_run_id: state.last_run_id,
          event_type: 'recovery',
          log: `クラッシュ回復を試行 (${newRestartCount}回目)`,
          metadata: { restart_count: newRestartCount, previous_error: runtimeState.last_error },
        }).catch(() => { /* 古いrun_idは存在しないことがある */ });
      }

      // idle状態に戻してheartbeatエンジンに次の実行を任せる
      await db.update(agent_runtime_state).set({
        state: { status: 'idle', restart_count: newRestartCount },
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
