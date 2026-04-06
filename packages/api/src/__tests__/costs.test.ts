/**
 * 単体テスト: /api/costs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    next();
  },
}));
vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const MOCK_AGENT = {
  id: 'agent-001',
  company_id: 'company-test-001',
  name: 'Test Agent',
};

const MOCK_COST_EVENT = {
  id: 'cost-001',
  agent_id: 'agent-001',
  model: 'claude-sonnet-4-6',
  input_tokens: 1000,
  output_tokens: 500,
  cost_usd: '0.001500',
  created_at: new Date().toISOString(),
};

const MOCK_BUDGET_POLICY = {
  id: 'budget-001',
  company_id: 'company-test-001',
  limit_amount_usd: '100.00',
  period: 'month',
  alert_threshold: '0.80',
  created_at: new Date().toISOString(),
};

function buildMockDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([MOCK_COST_EVENT]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_COST_EVENT]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/costs
// ──────────────────────────────────────────────────────────────
describe('GET /api/costs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-C01: period省略でmonthデフォルト・200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('month');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-C02: period=dayで200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs?period=day')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('day');
  });

  it('UT-C03: period=weekで200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs?period=week')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('week');
  });

  it('UT-C04: period=yearで200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs?period=year')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('year');
  });

  it('UT-C05: 無効なperiodで400 validation_failed', async () => {
    const res = await request(app)
      .get('/api/costs?period=invalid')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('period');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/costs
// ──────────────────────────────────────────────────────────────
describe('POST /api/costs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-C06: 正常登録で201とデータを返す', async () => {
    const mockDb = buildMockDb();
    // agent存在確認
    mockDb.limit.mockResolvedValueOnce([MOCK_AGENT]);
    // insert
    mockDb.returning.mockResolvedValueOnce([MOCK_COST_EVENT]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({
        agent_id: 'agent-001',
        model: 'claude-sonnet-4-6',
        input_tokens: 1000,
        output_tokens: 500,
        cost_usd: 0.0015,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe('cost-001');
  });

  it('UT-C07: agent_id欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ model: 'claude-sonnet-4-6', cost_usd: 0.001 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C08: model欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', cost_usd: 0.001 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C09: cost_usd欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', model: 'claude-sonnet-4-6' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C10: 別テナントのagentで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([]); // エージェント見つからない
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'other-agent', model: 'claude-sonnet-4-6', cost_usd: 0.001 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-C11: cost_usdがNaNで400 validation_failed', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([MOCK_AGENT]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', model: 'claude-sonnet-4-6', cost_usd: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('cost_usd');
  });

  it('UT-C12: input_tokens省略時はデフォルト0として登録される', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([MOCK_AGENT]);
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_COST_EVENT, input_tokens: 0 }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs')
      .set('Authorization', 'Bearer test-key')
      .send({ agent_id: 'agent-001', model: 'claude-sonnet-4-6', cost_usd: 0.001 });

    expect(res.status).toBe(201);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/costs/budget
// ──────────────────────────────────────────────────────────────
describe('GET /api/costs/budget', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-C13: 予算ポリシー一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    // select().from().where() → ポリシー配列
    mockDb.where.mockResolvedValueOnce([MOCK_BUDGET_POLICY]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs/budget')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-C14: ポリシーが0件でも空配列200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/costs/budget')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/costs/budget
// ──────────────────────────────────────────────────────────────
describe('POST /api/costs/budget', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-C15: 正常登録で201とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([MOCK_BUDGET_POLICY]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 100, period: 'month', alert_threshold: 0.8 });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });

  it('UT-C16: limit_amount_usd欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ period: 'month' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('limit_amount_usd');
  });

  it('UT-C17: limit_amount_usdが0以下で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C18: limit_amount_usdが負数で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C19: alert_threshold=0.5 (0〜1) で正常登録', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_BUDGET_POLICY, alert_threshold: '0.50' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 100, alert_threshold: 0.5 });

    expect(res.status).toBe(201);
  });

  it('UT-C20: alert_threshold=80 (0〜100) で正規化されて登録', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_BUDGET_POLICY, alert_threshold: '0.80' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 100, alert_threshold: 80 });

    expect(res.status).toBe(201);
  });

  it('UT-C21: alert_thresholdが範囲外で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 100, alert_threshold: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('alert_threshold');
  });

  it('UT-C22: alert_thresholdがNaNで400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 100, alert_threshold: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-C23: alert_threshold省略でも正常登録', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([MOCK_BUDGET_POLICY]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/costs/budget')
      .set('Authorization', 'Bearer test-key')
      .send({ limit_amount_usd: 50 });

    expect(res.status).toBe(201);
  });
});
