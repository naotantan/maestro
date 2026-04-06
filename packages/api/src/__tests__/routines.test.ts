/**
 * 単体テスト: /api/routines
 * ホワイトボックス: isValidCronExpression 内部関数を含む
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

vi.mock('@maestro/db', async () => {
  const actual = await vi.importActual('@maestro/db');
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

const MOCK_ROUTINE = {
  id: 'routine-001',
  company_id: 'company-test-001',
  number: 1,
  name: 'テストルーティン',
  description: null,
  prompt: null,
  cron_expression: '0 9 * * 1',
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_RUN = {
  id: 'run-001',
  routine_id: 'routine-001',
  status: 'success',
  result: null,
  error_message: null,
  executed_at: new Date(),
};

/**
 * routines.ts の DB チェーンパターン:
 *   select().from().where().orderBy()         → 配列 (GET / 一覧)
 *   select({max}).from().where()              → [{max: N}]  (POST / number採番)
 *   insert().values().returning()             → [row]
 *   select().from().where().limit(1)          → 配列 (find one / ownership check)
 *   delete().where()                          → void
 *   select().from().where().orderBy().limit() → 配列 (runs 一覧)
 */
function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([MOCK_ROUTINE]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([MOCK_ROUTINE]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_ROUTINE]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ----------------------------------------------------------------
// isValidCronExpression ホワイトボックステスト
// HTTP 経由: POST /api/routines に cron_expression を送ると
// isValidCronExpression で検証される。invalid → 400 / valid → 201。
// ----------------------------------------------------------------

describe('isValidCronExpression (whitebox via POST /api/routines)', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('"0 9 * * 1" (5フィールド) → valid → 201', async () => {
    const db = makeDb();
    // number 採番: select({max}).from().where() → [{max: 0}]
    db.where = vi.fn().mockResolvedValue([{ max: 0 }]);
    db.returning = vi.fn().mockResolvedValue([MOCK_ROUTINE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '0 9 * * 1' });

    expect(res.status).toBe(201);
  });

  it('"*/5 * * * *" (5フィールド) → valid → 201', async () => {
    const db = makeDb();
    db.where = vi.fn().mockResolvedValue([{ max: 0 }]);
    db.returning = vi.fn().mockResolvedValue([MOCK_ROUTINE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '*/5 * * * *' });

    expect(res.status).toBe(201);
  });

  it('"0 9 * * * *" (6フィールド) → valid → 201', async () => {
    const db = makeDb();
    db.where = vi.fn().mockResolvedValue([{ max: 0 }]);
    db.returning = vi.fn().mockResolvedValue([MOCK_ROUTINE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '0 9 * * * *' });

    expect(res.status).toBe(201);
  });

  it('"0 9 * *" (4フィールド) → invalid → 400', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '0 9 * *' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('"0 9 * * abc" (無効文字) → invalid → 400', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '0 9 * * abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('"" (空文字) → invalid → 400 (cron_expression 必須バリデーション)', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });
});

// ----------------------------------------------------------------
// GET /api/routines
// DBチェーン: select().from().where().orderBy() → 配列
// ----------------------------------------------------------------

describe('GET /api/routines', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-01: 200 と data 配列を返す', async () => {
    const db = makeDb();
    db.orderBy = vi.fn().mockResolvedValue([MOCK_ROUTINE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/routines');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ----------------------------------------------------------------
// POST /api/routines
// ----------------------------------------------------------------

describe('POST /api/routines', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-02: name 欠落 → 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ cron_expression: '0 9 * * 1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-03: cron_expression 欠落 → 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-04: 無効 cron_expression → 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'テスト', cron_expression: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-05: 正常作成 → 201 と number 採番', async () => {
    const db = makeDb();
    // select({max}).from().where() → [{max: 2}] なので number は 3
    db.where = vi.fn().mockResolvedValue([{ max: 2 }]);
    db.returning = vi.fn().mockResolvedValue([{ ...MOCK_ROUTINE, number: 3 }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines')
      .send({ name: '新しいルーティン', cron_expression: '0 9 * * 1' });

    expect(res.status).toBe(201);
    expect(res.body.data.number).toBe(3);
  });
});

// ----------------------------------------------------------------
// GET /api/routines/:routineId
// ----------------------------------------------------------------

describe('GET /api/routines/:routineId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-06: 存在する → 200 と data', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([MOCK_ROUTINE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/routines/routine-001');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('routine-001');
  });

  it('UT-07: 存在しない → 404 not_found', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/routines/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ----------------------------------------------------------------
// DELETE /api/routines/:routineId
// ----------------------------------------------------------------

describe('DELETE /api/routines/:routineId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-08: 200 と success:true を返す', async () => {
    const db = makeDb();
    db.where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/routines/routine-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ----------------------------------------------------------------
// GET /api/routines/:routineId/runs
// DBチェーン:
//   1回目: select().from().where().limit(1) → routineCheck
//   2回目: select().from().where().orderBy().limit() → runs
// ----------------------------------------------------------------

describe('GET /api/routines/:routineId/runs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-09: routine not found → 404', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/routines/nonexistent/runs');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-10: 正常 → 200 と data 配列', async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // routineCheck: .where().limit(1)
        return { limit: vi.fn().mockResolvedValue([{ id: 'routine-001' }]) };
      }
      // runs: .where().orderBy().limit()
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_RUN]),
        }),
      };
    });

    const db = makeDb({ where: mockWhere });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/routines/routine-001/runs');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ----------------------------------------------------------------
// POST /api/routines/:routineId/run
// DBチェーン: routineCheck → insert().values().returning()
// ----------------------------------------------------------------

describe('POST /api/routines/:routineId/run', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-11: routine not found → 404', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines/nonexistent/run')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-12: 正常 → 201 と status=success', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([{ id: 'routine-001' }]);
    db.returning = vi.fn().mockResolvedValue([MOCK_RUN]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/routines/routine-001/run')
      .send({ result: '実行完了', status: 'success' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('success');
  });
});
