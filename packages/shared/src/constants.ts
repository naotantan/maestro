// APIキープレフィックス
export const API_KEY_PREFIXES = {
  BOARD: 'comp_live_',
  AGENT: 'agent_live_',
} as const;

// ロール定義
export const ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// エージェントタイプ
export const AGENT_TYPES = [
  'claude_local',
  'codex_local',
  'cursor',
  'gemini_local',
  'openclaw_gateway',
  'opencode_local',
  'pi_local',
] as const;

// Issue ステータス
export const ISSUE_STATUSES = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  CANCELLED: 'cancelled',
} as const;

// Issue 優先度
export const ISSUE_PRIORITIES = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NO_PRIORITY: 'no_priority',
} as const;

// ページネーションデフォルト
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// サポート言語
export const SUPPORTED_LANGUAGES = ['ja', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// CLI 設定パス
export const CLI_CONFIG_DIR = '.company-cli';
export const CLI_CONFIG_FILE = 'config.json';
