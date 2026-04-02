import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import fetch from 'node-fetch';

export class GeminiLocalAdapter extends BaseAdapter {
  private get apiUrl() {
    return this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  get name() { return 'gemini_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    if (!this.config.apiKey) return { alive: false };
    try {
      const res = await fetch(
        `${this.apiUrl}/models?key=${this.config.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return { alive: res.ok };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    if (!this.config.apiKey) {
      return { taskId: request.taskId, output: '', finishReason: 'error', error: 'API key not configured' };
    }

    const model = this.config.model || 'gemini-pro';
    const prompt = request.context
      ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
      : request.prompt;

    try {
      const res = await fetch(
        `${this.apiUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: AbortSignal.timeout((this.config.timeout || 60) * 1000),
        }
      );

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status}`);
      }

      const data = await res.json() as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      };
      const output = data.candidates[0]?.content?.parts[0]?.text || '';

      return { taskId: request.taskId, output, finishReason: 'complete' };
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
