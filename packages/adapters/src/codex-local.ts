import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import fetch from 'node-fetch';

export class CodexLocalAdapter extends BaseAdapter {
  private get apiUrl() {
    return this.config.baseUrl || 'http://localhost:11434'; // Ollama default
  }

  get name() { return 'codex_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      const res = await fetch(`${this.apiUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return { alive: true };
      }
      return { alive: false };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    const model = this.config.model || 'codellama';
    const prompt = request.context
      ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
      : request.prompt;

    try {
      const res = await fetch(`${this.apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: AbortSignal.timeout((this.config.timeout || 120) * 1000),
      });

      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status}`);
      }

      const data = await res.json() as { response: string; done: boolean };
      return {
        taskId: request.taskId,
        output: data.response,
        finishReason: 'complete',
      };
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
