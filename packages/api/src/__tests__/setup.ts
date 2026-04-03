import { vi } from 'vitest';

// DB をモック（統合テストはDB不要）
vi.mock('@company/db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    })),
    execute: vi.fn().mockResolvedValue([]),
  })),
  closeDb: vi.fn(),
  companies: {},
  users: {},
  company_memberships: {},
  board_api_keys: {},
  agent_api_keys: {},
  agents: {},
  issues: {},
  issue_comments: {},
  goals: {},
  projects: {},
  cost_events: {},
  budget_policies: {},
  routines: {},
  approvals: {},
  approval_comments: {},
  activity_log: {},
  plugins: {},
  plugin_config: {},
  agent_handoffs: {},
  agent_task_sessions: {},
}));
