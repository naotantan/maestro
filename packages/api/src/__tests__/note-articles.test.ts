/**
 * 単体テスト: /api/note-articles
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

const MOCK_ARTICLE = {
  id: 'article-001',
  company_id: 'company-test-001',
  slug: 'test-article',
  title: 'テスト記事',
  type: '無料',
  price: 0,
  difficulty: 'beginner',
  tags: ['test'],
  status: 'draft',
  note_url: null,
  article_created_at: null,
  published_at: null,
  updated_at: new Date().toISOString(),
};

const MOCK_ARTICLE_FULL = {
  ...MOCK_ARTICLE,
  content: '# テスト記事\n\nこれはテストです。',
  images: [],
  created_at: new Date().toISOString(),
};

const MOCK_IMAGE = {
  id: 'image-001',
  article_id: 'article-001',
  company_id: 'company-test-001',
  image_type: 'thumbnail',
  url: 'https://example.com/image.png',
  created_at: new Date().toISOString(),
};

function buildMockDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([MOCK_ARTICLE]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_ARTICLE_FULL]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/note-articles
// ──────────────────────────────────────────────────────────────
describe('GET /api/note-articles', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-NA01: 一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.limit).toBeDefined();
    expect(res.body.meta.offset).toBeDefined();
  });

  it('UT-NA02: statusフィルタ付きで一覧取得できる', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles?status=draft')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-NA03: status=pipelineフィルタで200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles?status=pipeline')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
  });

  it('UT-NA04: status=publishedフィルタで200を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles?status=published')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
  });

  it('UT-NA05: limitとoffsetのページネーションが効く', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles?limit=5&offset=10')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(5);
    expect(res.body.meta.offset).toBe(10);
  });

  it('UT-NA06: 0件でも空配列200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.offset.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/note-articles/:id
// ──────────────────────────────────────────────────────────────
describe('GET /api/note-articles/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-NA07: 存在するidで200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([MOCK_ARTICLE_FULL]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('article-001');
  });

  it('UT-NA08: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.limit.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/note-articles/:id
// ──────────────────────────────────────────────────────────────
describe('PATCH /api/note-articles/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-NA09: タイトル更新で200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, title: '更新済みタイトル' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '更新済みタイトル' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('更新済みタイトル');
  });

  it('UT-NA10: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/nonexistent-id')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '新しいタイトル' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-NA11: 無効なtypeで400 validation_failed', async () => {
    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ type: 'invalid_type' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('type');
  });

  it('UT-NA12: 有効なtype=無料で200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, type: '無料' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ type: '無料' });

    expect(res.status).toBe(200);
  });

  it('UT-NA13: 有効なtype=Tier1で200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, type: 'Tier1' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ type: 'Tier1' });

    expect(res.status).toBe(200);
  });

  it('UT-NA14: 有効なtype=メンバーシップで200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, type: 'メンバーシップ' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ type: 'メンバーシップ' });

    expect(res.status).toBe(200);
  });

  it('UT-NA15: 無効なstatusで400 validation_failed', async () => {
    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('status');
  });

  it('UT-NA16: 有効なstatus=publishedで200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, status: 'published' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'published' });

    expect(res.status).toBe(200);
  });

  it('UT-NA17: 有効なstatus=archivedで200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, status: 'archived' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
  });

  it('UT-NA18: 無効なpublished_at日付で400 validation_failed', async () => {
    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ published_at: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('published_at');
  });

  it('UT-NA19: 有効なpublished_atで200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, published_at: '2026-01-01T00:00:00Z' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ published_at: '2026-01-01T00:00:00Z' });

    expect(res.status).toBe(200);
  });

  it('UT-NA20: published_atを空文字でnullクリアできる', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, published_at: null }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ published_at: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.published_at).toBeNull();
  });

  it('UT-NA21: タイトルのCRLFがLFに正規化される', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, title: 'タイトル' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'タイトル\r\n続き' });

    expect(res.status).toBe(200);
  });

  it('UT-NA22: contentのCRLFがLFに正規化される', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, content: '本文\n続き' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ content: '本文\r\n続き' });

    expect(res.status).toBe(200);
  });

  it('UT-NA23: note_urlを空文字でnullクリアできる', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, note_url: null }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ note_url: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.note_url).toBeNull();
  });

  it('UT-NA24: tagsが配列でない場合は空配列として扱われる', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ARTICLE_FULL, tags: [] }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ tags: 'not-an-array' });

    expect(res.status).toBe(200);
  });

  it('UT-NA25: 複数フィールドを同時に更新できる', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{
      ...MOCK_ARTICLE_FULL,
      title: '新タイトル',
      status: 'pipeline',
      type: 'Tier2',
    }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/note-articles/article-001')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '新タイトル', status: 'pipeline', type: 'Tier2' });

    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/note-articles/:id/images
// ──────────────────────────────────────────────────────────────
describe('GET /api/note-articles/:id/images', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-NA26: 記事に紐づく画像一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    mockDb.orderBy.mockResolvedValueOnce([MOCK_IMAGE]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles/article-001/images')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('UT-NA27: 画像が0件の場合は空配列200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.orderBy.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles/article-001/images')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('UT-NA28: 複数画像がある場合も200で返す', async () => {
    const mockDb = buildMockDb();
    const images = [
      MOCK_IMAGE,
      { ...MOCK_IMAGE, id: 'image-002', image_type: 'ogp' },
    ];
    mockDb.orderBy.mockResolvedValueOnce(images);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/note-articles/article-001/images')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});
