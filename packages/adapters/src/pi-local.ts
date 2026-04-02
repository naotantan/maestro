import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import fetch from 'node-fetch';

export class PiLocalAdapter extends BaseAdapter {
  private get piUrl() {
    return this.config.baseUrl || 'http://raspberrypi.local:8080';
  }

  get name() { return 'pi_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      const res = await fetch(`${this.piUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return { alive: res.ok };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    const prompt = request.context
      ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
      : request.prompt;

    try {
      const res = await fetch(`${this.piUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'X-API-Key': this.config.apiKey } : {}),
        },
        body: JSON.stringify({
          prompt,
          max_tokens: request.maxTokens || 2048,
        }),
        signal: AbortSignal.timeout((this.config.timeout || 180) * 1000),
      });

      if (!res.ok) {
        throw new Error(`Pi API error: ${res.status}`);
      }

      const data = await res.json() as { text: string; tokens?: number };
      return {
        taskId: request.taskId,
        output: data.text,
        tokensUsed: data.tokens,
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
