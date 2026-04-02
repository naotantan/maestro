// APIレスポンス共通型
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string[]>;
}

// ページネーション
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// CLI 設定型
export interface CliConfig {
  installMode: 'docker' | 'native';
  apiUrl: string;
  apiKey?: string;
  language: 'ja' | 'en';
  version: string;
  createdAt: string;
}

// ロール型
export type Role = 'admin' | 'member' | 'viewer';

// エージェントタイプ型
export type AgentType =
  | 'claude_local'
  | 'codex_local'
  | 'cursor'
  | 'gemini_local'
  | 'openclaw_gateway'
  | 'opencode_local'
  | 'pi_local';

// エンティティ型（DB レコードに対応）
export interface Company {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  type: AgentType;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  lastHeartbeatAt?: Date | null;
}
