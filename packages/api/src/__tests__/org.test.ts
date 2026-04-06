/**
 * ホワイトボックステスト: /api/org
 * org.ts の全ルートを検証する
 *
 * org.ts の DB アクセスパターン:
 *   GET /api/org          : select().from().where().limit(1) → rows
 *   PATCH /api/org        : update().set().where().returning() → updated
 *   GET /api/org/members  : select().from().where().limit().offset() → members
 *   DELETE /members/:id   : delete().where() → void
 *   GET /join-requests    : select().from().where() → requests
 *   POST approve/:id      : select().from().where().limit(1) → rows, then transaction(tx => ...)
 *   POST deny/:id         : select().from().where().limit(1) → existing, then update().set().where() → void
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

// --- フィクスチャ ---

const MOCK_COMPANY = {
  id: 'company-test-001',
  name: 'テスト株式会社',
  description: 'テスト用企業',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_MEMBER = {
  id: 'membership-001',
  company_id: 'company-test-001',
  user_id: 'user-001',
  role: 'member',
  created_at: new Date().toISOString(),
};

const MOCK_JOIN_REQUEST = {
  id: 'req-001',
  company_id: 'company-test-001',
  user_id: 'user-002',
  status: 'pending',
  reviewed_at: null,
  created_at: new Date().toISOString(),
};

// --- DB モック生成ヘルパー ---

/**
 * 汎用 DB モックを返す。
 * テストごとに必要なメソッドを上書きして使う。
 */
function makeDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return fn(tx);
      }
    ),
  };
}

// =============================================================================
// GET /api/org
// =============================================================================
describe('GET /api/org', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-01: company 存在 → 200 + data
  it('WT-ORG-01: company が見つかれば 200 と組織情報を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_COMPANY]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/org')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('company-test-001');
    expect(res.body.data.name).toBe('テスト株式会社');
  });

  // WT-ORG-02: company not found → 404
  it('WT-ORG-02: company が見つからなければ 404 を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // 0 件
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/org')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// =============================================================================
// PATCH /api/org
// =============================================================================
describe('PATCH /api/org', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-03: name 更新 → 200 + data
  it('WT-ORG-03: name を更新すると 200 と更新後データを返す', async () => {
    const updated = { ...MOCK_COMPANY, name: '新会社名' };
    const db = makeDb();
    db.returning.mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/org')
      .set('Authorization', 'Bearer test-key')
      .send({ name: '新会社名' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新会社名');
  });
});

// =============================================================================
// GET /api/org/members
// =============================================================================
describe('GET /api/org/members', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-04: 200 + data + meta
  it('WT-ORG-04: 200 と data 配列および meta を返す', async () => {
    const db = makeDb();
    // select().from().where().limit().offset() のチェーン
    // makeDb では where().limit() → [] なので offset も接続する必要がある
    const mockOffset = vi.fn().mockResolvedValue([MOCK_MEMBER]);
    const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    db.where = mockWhere;
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/org/members')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(typeof res.body.meta.limit).toBe('number');
    expect(typeof res.body.meta.offset).toBe('number');
  });
});

// =============================================================================
// DELETE /api/org/members/:userId
// =============================================================================
describe('DELETE /api/org/members/:userId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-05: 正常削除 → 200 + success:true
  it('WT-ORG-05: 正常削除で 200 と success:true を返す', async () => {
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/org/members/user-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// =============================================================================
// GET /api/org/join-requests
// =============================================================================
describe('GET /api/org/join-requests', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-06: 200 + data 配列
  it('WT-ORG-06: 200 と join-requests の配列を返す', async () => {
    const db = makeDb();
    // select().from().where() → join_requests（where() が Promise を返す）
    db.where = vi.fn().mockResolvedValue([MOCK_JOIN_REQUEST]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/org/join-requests')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].id).toBe('req-001');
  });
});

// =============================================================================
// POST /api/org/join-requests/:id/approve
// =============================================================================
describe('POST /api/org/join-requests/:id/approve', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-07: role='admin' → 400 validation_failed
  it('WT-ORG-07: role=admin を指定すると 400 validation_failed を返す', async () => {
    const res = await request(app)
      .post('/api/org/join-requests/req-001/approve')
      .set('Authorization', 'Bearer test-key')
      .send({ role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // WT-ORG-08: request not found → 404
  it('WT-ORG-08: join request が見つからなければ 404 を返す', async () => {
    const db = makeDb();
    // select().from().where().limit(1) → [] (not found)
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/org/join-requests/nonexistent/approve')
      .set('Authorization', 'Bearer test-key')
      .send({ role: 'member' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  // WT-ORG-09: 正常承認 → 200 + status='approved'
  it('WT-ORG-09: 正常承認で 200 と status=approved を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_JOIN_REQUEST]);
    // transaction mock: tx.update().set().where() と tx.insert().values() を解決する
    db.transaction = vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return fn(tx);
      }
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/org/join-requests/req-001/approve')
      .set('Authorization', 'Bearer test-key')
      .send({ role: 'member' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('req-001');
    expect(res.body.status).toBe('approved');
  });
});

// =============================================================================
// POST /api/org/join-requests/:id/deny
// =============================================================================
describe('POST /api/org/join-requests/:id/deny', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ORG-10: request not found → 404
  it('WT-ORG-10: join request が見つからなければ 404 を返す', async () => {
    const db = makeDb();
    // deny は select().from().where().limit(1) で existing を取得
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/org/join-requests/nonexistent/deny')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  // WT-ORG-11: 正常拒否 → 200 + status='denied'
  it('WT-ORG-11: 正常拒否で 200 と status=denied を返す', async () => {
    // deny ルートのクエリフロー:
    //   1. select().from().where().limit(1) → existing check
    //   2. update().set().where()           → status を denied に更新
    //
    // where() の呼び出し回数で分岐:
    //   1回目 (select チェーン): チェーンを継続 → limit() が終端
    //   2回目 (update チェーン): Promise を返す（終端）
    let whereCallCount = 0;

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'req-001' }]);
    const mockWhereForSelect = { limit: mockLimit };

    const db = makeDb();
    db.where = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        // select チェーン: where() → { limit: ... }
        return mockWhereForSelect;
      }
      // update チェーン: where() は Promise を返す（終端）
      return Promise.resolve(undefined);
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/org/join-requests/req-001/deny')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('req-001');
    expect(res.body.status).toBe('denied');
  });
});
