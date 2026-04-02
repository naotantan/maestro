import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import fetch from 'node-fetch';

export class OpenclawGatewayAdapter extends BaseAdapter {
  private get gatewayUrl() {
    return this.config.baseUrl || 'http://localhost:8080';
  }

  get name() { return 'openclaw_gateway'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      const res = await fetch(`${this.gatewayUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return { alive: res.ok };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    try {
      const res = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-opus-20240229',
          messages: [
            ...(request.context ? [{ role: 'system', content: request.context }] : []),
            { role: 'user', content: request.prompt },
          ],
          max_tokens: request.maxTokens || 4096,
        }),
        signal: AbortSignal.timeout((this.config.timeout || 120) * 1000),
      });

      if (!res.ok) {
        throw new Error(`Gateway error: ${res.status}`);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        usage?: { total_tokens: number };
      };

      return {
        taskId: request.taskId,
        output: data.choices[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens,
        finishReason: data.choices[0]?.finish_reason === 'stop' ? 'complete' : 'max_tokens',
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
