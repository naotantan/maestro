import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export class ClaudeLocalAdapter extends BaseAdapter {
  get name() { return 'claude_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      execSync('claude --version', { stdio: 'pipe' });
      return { alive: true };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    // 一時ファイルにプロンプトを書き出し、claude -p で実行
    const tmpFile = join(tmpdir(), `company-task-${request.taskId}.txt`);
    try {
      const prompt = request.context
        ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
        : request.prompt;
      writeFileSync(tmpFile, prompt, 'utf8');

      const { stdout } = await execAsync(
        `claude -p --allowedTools "none" < "${tmpFile}"`,
        { timeout: (this.config.timeout || 120) * 1000 }
      );

      return {
        taskId: request.taskId,
        output: stdout.trim(),
        finishReason: 'complete',
      };
    } catch (err) {
      return {
        taskId: request.taskId,
        output: '',
        finishReason: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
