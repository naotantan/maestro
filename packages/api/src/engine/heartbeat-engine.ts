/**
 * Heartbeatエンジン
 * - 有効なエージェントを定期的に起動し、ハートビート実行を記録する
 * - child_processを使いエージェントアダプターを呼び出す
 * - クラッシュ時はcrash-recoveryモジュールと連携して自動回復する
 */

import { spawn } from 'child_process';
import { getDb, agents, heartbeat_runs, heartbeat_run_events, agent_runtime_state } from '@company/db';
import { eq, and } from 'drizzle-orm';

// ハートビート間隔（デフォルト30秒）
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);

// エンジン稼働フラグ
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 1エージェントのハートビートを実行する
 */
async function runAgentHeartbeat(agentId: string, companyId: string): Promise<void> {
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

    // last_heartbeat_at を更新
    await db.update(agents)
      .set({ last_heartbeat_at: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)));

    // エージェント起動（child_process でアダプターを呼び出す）
    await executeAgentProcess(agentId, runId);

    // 実行完了を記録
    await db.update(heartbeat_runs).set({
      status: 'completed',
      ended_at: new Date(),
      result_summary: { success: true },
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
 * child_processでエージェントプロセスを起動する
 * 実際のアダプター呼び出しをシミュレートする（将来的にadaptersパッケージと統合）
 */
async function executeAgentProcess(agentId: string, runId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // アダプター実行スクリプトを起動
    const proc = spawn('node', [
      '-e',
      `console.log(JSON.stringify({ agent_id: '${agentId}', run_id: '${runId}', status: 'ok' }))`,
    ], {
      timeout: 60000, // 60秒タイムアウト
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    proc.stdout?.on('data', (data: Buffer) => stdout.push(data.toString()));
    proc.stderr?.on('data', (data: Buffer) => stderr.push(data.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`エージェントプロセスが終了コード ${code} で終了: ${stderr.join('')}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`プロセス起動失敗: ${err.message}`));
    });
  });
}

/**
 * 全有効エージェントのハートビートを実行する
 */
async function runAllHeartbeats(): Promise<void> {
  try {
    const db = getDb();
    const activeAgents = await db.select({
      id: agents.id,
      company_id: agents.company_id,
    }).from(agents).where(eq(agents.enabled, true));

    if (activeAgents.length === 0) return;

    // 最大3並列でハートビートを実行
    const MAX_PARALLEL = 3;
    for (let i = 0; i < activeAgents.length; i += MAX_PARALLEL) {
      const batch = activeAgents.slice(i, i + MAX_PARALLEL);
      await Promise.allSettled(
        batch.map(a => runAgentHeartbeat(a.id, a.company_id))
      );
    }
  } catch (err) {
    console.error('[HeartbeatEngine] スキャン中にエラー:', err);
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
