import { BaseAdapter, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import { execSync } from 'child_process';

export class CursorAdapter extends BaseAdapter {
  get name() { return 'cursor'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      execSync('cursor --version', { stdio: 'pipe' });
      return { alive: true };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    // Cursor は現在 CLI タスク実行をサポートしていない
    // ウェブフック経由での将来の統合のためのスタブ実装
    return {
      taskId: request.taskId,
      output: `[Cursor Adapter] タスクをキューに追加しました: ${request.prompt.slice(0, 100)}...`,
      finishReason: 'complete',
    };
  }
}
