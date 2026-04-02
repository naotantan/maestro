// エージェントアダプターの基底インターフェース
export interface AdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface TaskRequest {
  taskId: string;
  prompt: string;
  context?: string;
  maxTokens?: number;
}

export interface TaskResponse {
  taskId: string;
  output: string;
  tokensUsed?: number;
  costUsd?: number;
  finishReason: 'complete' | 'max_tokens' | 'error';
  error?: string;
}

export interface HeartbeatResponse {
  alive: boolean;
  version?: string;
  model?: string;
}

// 全アダプターが実装する基底クラス
export abstract class BaseAdapter {
  protected config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  // タスク実行
  abstract runTask(request: TaskRequest): Promise<TaskResponse>;

  // ハートビート確認
  abstract heartbeat(): Promise<HeartbeatResponse>;

  // アダプター名
  abstract get name(): string;
}
