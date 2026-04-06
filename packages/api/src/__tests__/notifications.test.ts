/**
 * ホワイトボックステスト: /api/notifications
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

const MOCK_NOTIFICATION = {
  id: 'notif-001',
  company_id: 'company-test-001',
  title: 'テスト通知',
  message: 'テストメッセージ',
  type: 'info',
  read: false,
  created_at: new Date().toISOString(),
};

function buildMockDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([MOCK_NOTIFICATION]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_NOTIFICATION]),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/notifications
// ──────────────────────────────────────────────────────────────
describe('GET /api/notifications', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-N01: 200と通知一覧を返す', async () => {
    // Promise.all で countResult と rows の2クエリ
    const selectFn = vi.fn()
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
                offset: vi.fn().mockResolvedValue([MOCK_NOTIFICATION]),
              }),
            }),
          }),
        }),
      });

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });

  it('UT-N02: read=false フィルター付きで200', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ cnt: 2 }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([MOCK_NOTIFICATION]),
              }),
            }),
          }),
        }),
      });

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/notifications?read=false')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
  });

  it('UT-N03: read=true フィルター付きで200', async () => {
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
      .get('/api/notifications?read=true')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/notifications/unread-count
// ──────────────────────────────────────────────────────────────
describe('GET /api/notifications/unread-count', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-N04: 未読数を200で返す', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ cnt: 5 }]),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(5);
  });

  it('UT-N05: 未読なしの場合 count:0', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ cnt: 0 }]),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('UT-N06: DB が空配列の場合 count:0 にフォールバック', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/notifications/:id/read
// ──────────────────────────────────────────────────────────────
describe('POST /api/notifications/:id/read', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-N07: 既読成功で200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([{ ...MOCK_NOTIFICATION, read: true }]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/notifications/notif-001/read')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('UT-N08: 存在しない通知は404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/notifications/nonexistent/read')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/notifications/read-all
// ──────────────────────────────────────────────────────────────
describe('POST /api/notifications/read-all', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-N09: 全既読で success:true を返す', async () => {
    const mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// ──────────────────────────────────────────────────────────────
describe('DELETE /api/notifications/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-N10: 削除成功で success:true', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([MOCK_NOTIFICATION]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/notifications/notif-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('UT-N11: 存在しない通知削除は404', async () => {
    const mockDb = buildMockDb();
    mockDb.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/notifications/nonexistent')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
