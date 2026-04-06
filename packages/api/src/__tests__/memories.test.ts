/**
 * ホワイトボックステスト: /api/memories
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

const MOCK_MEMORY = {
  id: 'mem-001',
  company_id: 'company-test-001',
  title: 'テスト記憶',
  content: 'テストの内容です',
  type: 'session',
  tags: [],
  session_id: null,
  project_path: null,
  importance: 3,
  recall_count: 0,
  last_recalled_at: null,
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
    offset: vi.fn().mockResolvedValue([MOCK_MEMORY]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_MEMORY]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/memories
// ──────────────────────────────────────────────────────────────
describe('GET /api/memories', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-M01: 一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    // Promise.all で countResult と rows の2クエリが走る
    mockDb.where
      .mockReturnValueOnce({
        // countクエリ
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ cnt: 1 }]),
      })
      .mockResolvedValueOnce([{ cnt: 1 }]);

    // Promise.all をモックするため、select チェーン全体を差し替え
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ cnt: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([MOCK_MEMORY]),
                }),
              }),
            }),
          }),
        }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/memories')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBe(1);
  });

  it('UT-M02: type フィルターが機能する', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ cnt: 0 }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/memories?type=project')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/memories/recall
// ──────────────────────────────────────────────────────────────
describe('GET /api/memories/recall', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-M03: q なしで400 validation_failed', async () => {
    const res = await request(app)
      .get('/api/memories/recall')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-M04: q ありで200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([MOCK_MEMORY]),
      }),
    });
    const updateMock = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue({
      ...mockDb,
      ...updateMock,
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/memories/recall')
      .query({ q: 'テスト' })
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta.query).toBe('テスト');
  });

  it('UT-M05: 結果なしの場合 recall_count 更新しない', async () => {
    const updateMock = vi.fn();
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: updateMock,
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/memories/recall')
      .query({ q: '存在しないキーワード' })
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(res.body.meta.count).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/memories
// ──────────────────────────────────────────────────────────────
describe('POST /api/memories', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-M06: 正常登録で201を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト記憶', content: 'テストの内容' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });

  it('UT-M07: title 欠落で400', async () => {
    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ content: 'テスト内容' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-M08: content 欠落で400', async () => {
    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-M09: 無効な type は session にフォールバック', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト', content: '内容', type: 'invalid_type' });

    expect(res.status).toBe(201);
    // DB insert が呼ばれていること
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('UT-M10: importance が1未満は1にクランプされる', async () => {
    const capturedValues: unknown[] = [];
    const mockDb = buildMockDb();
    mockDb.values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues.push(v);
      return mockDb;
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト', content: '内容', importance: -5 });

    expect(capturedValues.length).toBeGreaterThan(0);
    const inserted = capturedValues[0] as Record<string, unknown>;
    expect(inserted.importance).toBe(1);
  });

  it('UT-M11: importance が5超は5にクランプされる', async () => {
    const capturedValues: unknown[] = [];
    const mockDb = buildMockDb();
    mockDb.values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues.push(v);
      return mockDb;
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await request(app)
      .post('/api/memories')
      .set('Authorization', 'Bearer test-key')
      .send({ title: 'テスト', content: '内容', importance: 10 });

    expect(capturedValues.length).toBeGreaterThan(0);
    const inserted = capturedValues[0] as Record<string, unknown>;
    expect(inserted.importance).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/memories/:id
// ──────────────────────────────────────────────────────────────
describe('PATCH /api/memories/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-M12: 更新成功で200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([{ ...MOCK_MEMORY, title: '更新済み' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/memories/mem-001')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '更新済み' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('UT-M13: 存在しない記憶は404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/memories/nonexistent')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '更新' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/memories/:id
// ──────────────────────────────────────────────────────────────
describe('DELETE /api/memories/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-M14: 削除成功で200を返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([MOCK_MEMORY]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/memories/mem-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('UT-M15: 存在しない記憶削除は404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/memories/nonexistent')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
