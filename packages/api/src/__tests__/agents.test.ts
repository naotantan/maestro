/**
 * 単体テスト: /api/agents
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

// generateApiKey のみモック（bcrypt の非同期ハッシュをテストで回避）
vi.mock('../utils/crypto.js', () => ({
  generateApiKey: vi.fn().mockResolvedValue({
    rawKey: 'agt_live_mockedrawkey',
    keyHash: 'hashed',
    prefix: 'agt_live_',
  }),
  encrypt: vi.fn().mockReturnValue('encrypted-api-key'),
  decrypt: vi.fn().mockReturnValue('plain-api-key'),
  hashApiKey: vi.fn().mockResolvedValue('hashed'),
}));

const MOCK_AGENT = {
  id: 'agent-001',
  company_id: 'company-test-001',
  name: 'Test Agent',
  type: 'claude_local',
  description: null,
  config: {},
  enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function makeDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_AGENT]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };
}

// -----------------------------------------------------------------------
// GET /api/agents
// -----------------------------------------------------------------------
describe('GET /api/agents', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-01: 200 と data 配列・meta を返す', async () => {
    const db = makeDb();
    // 1回目 .where(): count クエリ（Promise として解決）
    // 2回目 .where(): rows クエリ（チェーンを続ける）
    let whereCall = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCall++;
      if (whereCall === 1) {
        // count: select({ total }).from().where() → Promise<[{total}]>
        return Promise.resolve([{ total: 2 }]);
      }
      // rows: .where().orderBy().limit().offset()
      return db;
    });
    db.orderBy = vi.fn().mockReturnThis();
    db.limit = vi.fn().mockReturnThis();
    db.offset = vi.fn().mockResolvedValue([MOCK_AGENT]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('offset');
  });
});

// -----------------------------------------------------------------------
// POST /api/agents
// -----------------------------------------------------------------------
describe('POST /api/agents', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-02: 正常作成で201とdata・agentApiKeyを返す', async () => {
    const db = makeDb();
    db.returning
      .mockResolvedValueOnce([MOCK_AGENT])  // agents.insert
      .mockResolvedValue([]);               // agent_api_keys.insert（不使用だがフォールバック）
    db.values = vi.fn().mockReturnThis();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'New Agent', type: 'claude_local' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.agentApiKey).toBe('agt_live_mockedrawkey');
  });

  it('UT-AG-03: name 欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ type: 'claude_local' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-AG-04: type 欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Agent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-AG-05: 無効な type で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Agent', type: 'invalid_type' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-AG-06: claude_api + apiKey 欠落で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Claude Agent', type: 'claude_api' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-AG-07: claude_api + apiKey 付きで201（暗号化コードパス）', async () => {
    // encrypt は vi.mock でモック済み
    const db = makeDb();
    db.returning
      .mockResolvedValueOnce([{ ...MOCK_AGENT, type: 'claude_api', config: { apiKey: 'encrypted-api-key' } }])
      .mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Claude API Agent', type: 'claude_api', config: { apiKey: 'sk-ant-real-key' } });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.agentApiKey).toBe('agt_live_mockedrawkey');
  });
});

// -----------------------------------------------------------------------
// GET /api/agents/:agentId
// -----------------------------------------------------------------------
describe('GET /api/agents/:agentId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-08: 存在するIDで200とdataを返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_AGENT]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/agents/agent-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('agent-001');
  });

  it('UT-AG-09: 存在しないIDで404 not_found', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/agents/nonexistent')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// -----------------------------------------------------------------------
// PATCH /api/agents/:agentId
// -----------------------------------------------------------------------
describe('PATCH /api/agents/:agentId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-10: 正常更新で200とdataを返す', async () => {
    const updated = { ...MOCK_AGENT, name: 'Updated Agent' };
    const db = makeDb();
    db.returning.mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/agents/agent-001')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Updated Agent' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Agent');
  });

  it('UT-AG-11: 存在しないIDで404 not_found', async () => {
    const db = makeDb();
    db.returning.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/agents/nonexistent')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// -----------------------------------------------------------------------
// DELETE /api/agents/:agentId
// -----------------------------------------------------------------------
describe('DELETE /api/agents/:agentId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-12: 正常削除で200と success:true を返す', async () => {
    const db = makeDb();
    // delete().where() が Promise を返すようにする
    db.where = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/agents/agent-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// -----------------------------------------------------------------------
// POST /api/agents/:agentId/heartbeat
// -----------------------------------------------------------------------
describe('POST /api/agents/:agentId/heartbeat', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-13: 正常で200と timestamp を返す', async () => {
    const db = makeDb();
    // 1回目: select().from().where().limit() → existing config
    db.limit.mockResolvedValue([{ config: { working_directory: '/old' } }]);
    // execute() → heartbeat 更新
    db.execute = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/agents/agent-001/heartbeat')
      .set('Authorization', 'Bearer test-key')
      .send({ working_directory: '/home/user', model: 'claude-3-5' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// GET /api/agents/:agentId/runs
// -----------------------------------------------------------------------
describe('GET /api/agents/:agentId/runs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-AG-14: 存在するagentで200とdata配列を返す', async () => {
    const db = makeDb();
    const MOCK_RUN = { id: 'run-001', agent_id: 'agent-001', started_at: new Date().toISOString() };
    // 1回目 .limit(): agentCheck → [agent]
    // 2回目 .limit(): runs → [run]
    db.limit
      .mockResolvedValueOnce([{ id: 'agent-001' }])  // agentCheck
      .mockResolvedValueOnce([MOCK_RUN]);             // runs query
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/agents/agent-001/runs')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-AG-15: 存在しないagentで404 not_found', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // agentCheck → empty
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/agents/nonexistent/runs')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
