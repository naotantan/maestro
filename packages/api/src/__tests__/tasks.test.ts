/**
 * 単体テスト: /api/tasks
 * テスト仕様書 docs/tasks/03-detail-design.md に対応
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@company/db';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    next();
  },
}));

vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// @company/adapters の dynamic import をモック
vi.mock('@company/adapters', () => ({
  createAdapter: vi.fn(() => ({
    runTask: vi.fn().mockResolvedValue({
      taskId: 'task-001',
      output: 'モックの回答',
      finishReason: 'complete',
    }),
    heartbeat: vi.fn().mockResolvedValue({ alive: true }),
  })),
}));

const MOCK_AGENT = {
  id: 'agent-001',
  company_id: 'company-test-001',
  type: 'codex_local',
  config: {},
  enabled: true,
  name: 'Test Agent',
};

function makeDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([MOCK_AGENT]),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

describe('POST /api/tasks', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // UT-01: 正常実行
  it('UT-01: 正常実行で200とoutputを返す', async () => {
    const db = makeDb();
    // agent存在確認 → [MOCK_AGENT], insert/update は void
    db.limit.mockResolvedValue([MOCK_AGENT]);
    db.values.mockReturnThis();
    db.returning.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', prompt: 'テストプロンプト' });

    expect(res.status).toBe(200);
    expect(res.body.data.output).toBe('モックの回答');
    expect(res.body.data.finish_reason).toBe('complete');
  });

  // UT-02: agent_id 欠落
  it('UT-02: agent_id がないと400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ prompt: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-03: prompt 欠落
  it('UT-03: prompt がないと400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-04: 別テナントエージェント（見つからない）
  it('UT-04: 別テナントのエージェントは400', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // 見つからない
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'other-agent', prompt: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-05: disabled エージェント
  it('UT-05: disabled エージェントは400 agent_disabled', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([{ ...MOCK_AGENT, enabled: false }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', prompt: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('agent_disabled');
  });

  // UT-06: アダプター実行失敗
  it('UT-06: アダプターがerrorを返すとfinish_reason=error', async () => {
    const { createAdapter } = await import('@company/adapters');
    vi.mocked(createAdapter).mockReturnValueOnce({
      runTask: vi.fn().mockResolvedValue({
        taskId: 'task-001',
        output: '',
        finishReason: 'error',
        error: 'codex failed',
      }),
      heartbeat: vi.fn().mockResolvedValue({ alive: true }),
      name: 'codex_local',
      config: {},
    } as unknown as ReturnType<typeof createAdapter>);

    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_AGENT]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', prompt: 'テスト' });

    expect(res.status).toBe(200);
    expect(res.body.data.finish_reason).toBe('error');
    expect(res.body.data.error).toBe('codex failed');
  });
});

describe('GET /api/tasks', () => {
  const app = createApp();

  // UT-07: 一覧取得
  it('UT-07: 一覧取得で200とdata配列を返す', async () => {
    const db = makeDb();
    // 1回目の limit: ownedAgents 取得 → [MOCK_AGENT]
    // 2回目の limit: sessions → limit().offset() チェーン
    db.limit
      .mockResolvedValueOnce([MOCK_AGENT])
      .mockReturnValueOnce({
        offset: vi.fn().mockResolvedValue([
          { id: 'session-001', agent_id: 'agent-001', status: 'completed' },
        ]),
      });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
