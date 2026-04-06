/**
 * ホワイトボックステスト: /api/webhooks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: unknown, _res: unknown, next: () => void) => {
    (req as Record<string, unknown>).companyId = 'company-test-001';
    next();
  },
}));

vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// fetch をグローバルにモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_WEBHOOK = {
  id: 'wh-001',
  company_id: 'company-test-001',
  name: 'テストWebhook',
  url: 'https://example.com/hook',
  events: ['task.completed'],
  secret: null,
  enabled: true,
  last_triggered_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function buildMockDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([MOCK_WEBHOOK]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_WEBHOOK]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/webhooks
// ──────────────────────────────────────────────────────────────
describe('GET /api/webhooks', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-WH01: 200と一覧を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/webhooks')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/webhooks
// ──────────────────────────────────────────────────────────────
describe('POST /api/webhooks', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-WH02: 正常登録で201を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({
        name: 'テストWebhook',
        url: 'https://example.com/hook',
        events: ['task.completed'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('UT-WH03: name 欠落で400', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({ url: 'https://example.com', events: ['task.completed'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-WH04: url 欠落で400', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'test', events: ['task.completed'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-WH05: events が空配列で400', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'test', url: 'https://example.com', events: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-WH06: events が配列でない場合400', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'test', url: 'https://example.com', events: 'task.completed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-WH07: enabled のデフォルトは true', async () => {
    const capturedValues: unknown[] = [];
    const mockDb = buildMockDb();
    mockDb.values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues.push(v);
      return mockDb;
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await request(app)
      .post('/api/webhooks')
      .set('Authorization', 'Bearer test-key')
      .send({ name: 'test', url: 'https://example.com', events: ['task.done'] });

    expect(capturedValues.length).toBeGreaterThan(0);
    const inserted = capturedValues[0] as Record<string, unknown>;
    expect(inserted.enabled).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// PUT /api/webhooks/:id
// ──────────────────────────────────────────────────────────────
describe('PUT /api/webhooks/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-WH08: 更新成功で200', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([{ ...MOCK_WEBHOOK, name: '更新済み' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .put('/api/webhooks/wh-001')
      .set('Authorization', 'Bearer test-key')
      .send({ name: '更新済み' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('UT-WH09: フィールドなしで400', async () => {
    const res = await request(app)
      .put('/api/webhooks/wh-001')
      .set('Authorization', 'Bearer test-key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-WH10: 存在しない Webhook で404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .put('/api/webhooks/nonexistent')
      .set('Authorization', 'Bearer test-key')
      .send({ name: '更新' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/webhooks/:id
// ──────────────────────────────────────────────────────────────
describe('DELETE /api/webhooks/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-WH11: 削除成功で success:true', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([MOCK_WEBHOOK]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/webhooks/wh-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('UT-WH12: 存在しない Webhook 削除は404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/webhooks/nonexistent')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/webhooks/:id/test
// ──────────────────────────────────────────────────────────────
describe('POST /api/webhooks/:id/test', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('UT-WH13: テスト送信成功で success:true とステータスコードを返す', async () => {
    const mockDb = buildMockDb();
    // limit(1) のチェーンを差し替え
    mockDb.limit = vi.fn().mockResolvedValue([MOCK_WEBHOOK]);
    // update チェーン
    mockDb.set = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    const res = await request(app)
      .post('/api/webhooks/wh-001/test')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status_code).toBe(200);
  });

  it('UT-WH14: テスト送信でfetch失敗時 success:false とエラーメッセージ', async () => {
    const mockDb = buildMockDb();
    mockDb.limit = vi.fn().mockResolvedValue([MOCK_WEBHOOK]);
    mockDb.set = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .post('/api/webhooks/wh-001/test')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Connection refused');
  });

  it('UT-WH15: 存在しない Webhook のテスト送信は404', async () => {
    const mockDb = buildMockDb();
    mockDb.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/webhooks/nonexistent/test')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-WH16: fetch が 4xx を返す場合 success:false', async () => {
    const mockDb = buildMockDb();
    mockDb.limit = vi.fn().mockResolvedValue([MOCK_WEBHOOK]);
    mockDb.set = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    mockFetch.mockResolvedValue({ status: 404, ok: false });

    const res = await request(app)
      .post('/api/webhooks/wh-001/test')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.status_code).toBe(404);
  });
});
