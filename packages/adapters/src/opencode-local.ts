import { BaseAdapter, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class OpencodeLocalAdapter extends BaseAdapter {
  get name() { return 'opencode_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      execSync('opencode --version', { stdio: 'pipe' });
      return { alive: true };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    const prompt = request.context
      ? `${request.context}\n\n${request.prompt}`
      : request.prompt;

    try {
      const { stdout } = await execAsync(
        `echo ${JSON.stringify(prompt)} | opencode run -`,
        { timeout: (this.config.timeout || 120) * 1000 }
      );
      return { taskId: request.taskId, output: stdout.trim(), finishReason: 'complete' };
    } catch (err) {
      return {
        taskId: request.taskId,
        output: '',
        finishReason: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
