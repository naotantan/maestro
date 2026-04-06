/**
 * 単体テスト: /api/artifacts
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

const MOCK_ARTIFACT = {
  id: 'artifact-001',
  company_id: 'company-test-001',
  session_id: null,
  type: 'file',
  title: 'テスト成果物',
  description: null,
  prompt: null,
  url: null,
  file_path: '/tmp/test.ts',
  tags: [],
  meta: null,
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
    offset: vi.fn().mockResolvedValue([MOCK_ARTIFACT]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_ARTIFACT]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/artifacts
// ──────────────────────────────────────────────────────────────
describe('GET /api/artifacts', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A01: 一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.limit).toBeDefined();
    expect(res.body.meta.offset).toBeDefined();
  });

  it('UT-A02: typeフィルタ付きで一覧取得できる', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts?type=file')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-A03: 検索クエリ付きで一覧取得できる', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts?q=test')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-A04: type=all でフィルタなし一覧取得できる', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts?type=all')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-A05: limitとoffsetのページネーションが効く', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts?limit=5&offset=10')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(5);
    expect(res.body.meta.offset).toBe(10);
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/artifacts
// ──────────────────────────────────────────────────────────────
describe('POST /api/artifacts', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A06: 正常登録で201とデータを返す', async () => {
    const mockDb = buildMockDb();
    // 重複チェック: limit → [] (重複なし)
    mockDb.limit.mockResolvedValueOnce([]);
    // insert returning
    mockDb.returning.mockResolvedValueOnce([MOCK_ARTIFACT]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト成果物', type: 'file', file_path: '/tmp/test.ts' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe('artifact-001');
  });

  it('UT-A07: titleなしで400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ type: 'file', file_path: '/tmp/test.ts' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-A08: title空文字で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '   ', type: 'file' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-A09: url重複時は200でduplicate:trueを返す', async () => {
    const mockDb = buildMockDb();
    // 重複チェック: limit → 既存あり
    mockDb.limit.mockResolvedValueOnce([{ id: 'artifact-001' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト成果物', url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.data.id).toBe('artifact-001');
  });

  it('UT-A10: file_path重複時は200でduplicate:trueを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([{ id: 'artifact-001' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト成果物', file_path: '/tmp/test.ts' });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it('UT-A11: session_idなし・url/file_pathなしは重複チェックをスキップして201', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTIFACT, url: null, file_path: null }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'タイトルのみ', type: 'report' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });

  it('UT-A12: tagsが配列として保存される', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTIFACT, tags: ['tag1', 'tag2'] }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'タグ付き', tags: ['tag1', 'tag2'] });

    expect(res.status).toBe(201);
  });

  it('UT-A13: metaオブジェクトが保存される', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTIFACT, meta: { key: 'value' } }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/artifacts')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'メタ付き', meta: { key: 'value' } });

    expect(res.status).toBe(201);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/artifacts/:id
// ──────────────────────────────────────────────────────────────
describe('GET /api/artifacts/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A14: 存在するidで200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([MOCK_ARTIFACT]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts/artifact-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('artifact-001');
  });

  it('UT-A15: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/artifacts/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/artifacts/:id
// ──────────────────────────────────────────────────────────────
describe('PATCH /api/artifacts/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A16: 正常更新で200とデータを返す', async () => {
    const updated = { ...MOCK_ARTIFACT, title: '更新済みタイトル' };
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([updated]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/artifacts/artifact-001')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '更新済みタイトル' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('更新済みタイトル');
  });

  it('UT-A17: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/artifacts/nonexistent-id')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '新しいタイトル' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-A18: description・prompt・tags・metaも更新できる', async () => {
    const updated = { ...MOCK_ARTIFACT, description: '新しい説明', tags: ['new-tag'] };
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([updated]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/artifacts/artifact-001')
      .set('Authorization', 'Bearer test-key')
      .send({ description: '新しい説明', tags: ['new-tag'], meta: { foo: 'bar' } });

    expect(res.status).toBe(200);
  });

  it('UT-A19: descriptionをnullにクリアできる', async () => {
    const updated = { ...MOCK_ARTIFACT, description: null };
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([updated]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/artifacts/artifact-001')
      .set('Authorization', 'Bearer test-key')
      .send({ description: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/artifacts/:id
// ──────────────────────────────────────────────────────────────
describe('DELETE /api/artifacts/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A20: 正常削除で204を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ id: 'artifact-001' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/artifacts/artifact-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(204);
  });

  it('UT-A21: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/artifacts/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
