/**
 * 単体テスト: /api/handoffs
 * テスト仕様書 docs/handoff/04-test-spec.md に対応
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@company/db';

// 認証ミドルウェアをモック（companyId を注入）
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    next();
  },
}));

// activityLogger をモック（DB書き込み不要）
vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const VALID_BODY = {
  from_agent_id: 'agent-aaa-000',
  to_agent_id: 'agent-bbb-111',
  prompt: 'テスト用プロンプト',
};

// テナント所有確認のモックエージェント
const MOCK_FROM_AGENT = { id: 'agent-aaa-000', type: 'claude_local', config: {}, enabled: true };
const MOCK_TO_AGENT   = { id: 'agent-bbb-111', type: 'codex_local',  config: {}, enabled: true };

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    $dynamic: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'handoff-001', status: 'pending', ...VALID_BODY, created_at: new Date() }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('POST /api/handoffs', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-01: 正常登録（必須項目のみ）
  it('UT-01: 正常登録で201とpendingステータスを返す', async () => {
    const db = makeDb();
    // findOwnedAgent: from_agent → [MOCK_FROM_AGENT], to_agent → [MOCK_TO_AGENT]
    db.limit
      .mockResolvedValueOnce([MOCK_FROM_AGENT])  // from_agent 確認
      .mockResolvedValueOnce([MOCK_TO_AGENT]);   // to_agent 確認
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  // UT-02: issue_id 付き正常登録
  it('UT-02: issue_id 付きで正常登録できる', async () => {
    const db = makeDb();
    db.limit
      .mockResolvedValueOnce([MOCK_FROM_AGENT])
      .mockResolvedValueOnce([MOCK_TO_AGENT]);
    db.returning.mockResolvedValue([{ id: 'handoff-002', status: 'pending', issue_id: 'issue-001', ...VALID_BODY }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send({ ...VALID_BODY, issue_id: 'issue-001' });

    expect(res.status).toBe(201);
    expect(res.body.data.issue_id).toBe('issue-001');
  });

  // UT-03: from_agent_id 欠落
  it('UT-03: from_agent_id がないと400', async () => {
    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send({ to_agent_id: 'agent-bbb-111', prompt: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-04: to_agent_id 欠落
  it('UT-04: to_agent_id がないと400', async () => {
    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send({ from_agent_id: 'agent-aaa-000', prompt: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-05: prompt 欠落
  it('UT-05: prompt がないと400', async () => {
    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send({ from_agent_id: 'agent-aaa-000', to_agent_id: 'agent-bbb-111' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-06: 自己引き継ぎ禁止
  it('UT-06: from_agent_id === to_agent_id で400', async () => {
    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send({ from_agent_id: 'agent-aaa-000', to_agent_id: 'agent-aaa-000', prompt: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // UT-07: 別テナントのエージェント
  it('UT-07: 別テナントのエージェントを指定すると400', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // エージェントが見つからない → 別テナント扱い
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/handoffs')
      .set('X-API-Key', 'test-key')
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });
});

describe('GET /api/handoffs', () => {
  const app = createApp();

  // UT-08: 一覧取得
  it('UT-08: 一覧取得で200とdata配列を返す', async () => {
    const db = makeDb();
    // limit().offset() チェーンをモック
    db.limit = vi.fn().mockReturnValue({
      offset: vi.fn().mockResolvedValue([
        { id: 'handoff-001', status: 'pending', company_id: 'company-test-001' },
      ]),
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/handoffs')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // UT-09: status フィルタ
  it('UT-09: status クエリパラメータを渡せる（400にならない）', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockReturnValue({
      offset: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/handoffs?status=pending')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(200);
  });
});

describe('GET /api/handoffs/:id', () => {
  const app = createApp();

  // UT-10: 存在するID
  it('UT-10: 存在するIDで200を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([{ id: 'handoff-001', status: 'pending', company_id: 'company-test-001' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/handoffs/handoff-001')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('handoff-001');
  });

  // UT-11: 存在しないID
  it('UT-11: 存在しないIDで404を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/handoffs/nonexistent')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(404);
  });

  // UT-12: 別テナントのID（見つからない扱い）
  it('UT-12: 別テナントのIDで404を返す（テナント分離）', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // company_id フィルタで除外される
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/handoffs/other-tenant-handoff')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/handoffs/:id/cancel', () => {
  const app = createApp();

  // UT-13: pending のキャンセル
  it('UT-13: pending のキャンセルで200とcancelledを返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([{ id: 'handoff-001', status: 'pending' }]);
    db.returning.mockResolvedValue([{ id: 'handoff-001', status: 'cancelled' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/handoffs/handoff-001/cancel')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  // UT-14: running のキャンセル → 409
  it('UT-14: running 状態のキャンセルで409を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([{ id: 'handoff-001', status: 'running' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/handoffs/handoff-001/cancel')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_state');
  });

  // UT-15: completed のキャンセル → 409
  it('UT-15: completed 状態のキャンセルで409を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([{ id: 'handoff-001', status: 'completed' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/handoffs/handoff-001/cancel')
      .set('X-API-Key', 'test-key');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_state');
  });
});
