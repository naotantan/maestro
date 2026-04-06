/**
 * 単体テスト: /api/projects
 * ホワイトボックス: generatePrefix 内部関数を含む
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

// ----------------------------------------------------------------
// generatePrefix ホワイトボックステスト
// ルートファイルから export されていないため、HTTP 経由で prefix
// 自動生成の結果を検証する。POST /api/projects でcustomプレフィックス
// なしで送信すると generatePrefix が呼ばれる。
// ----------------------------------------------------------------

const MOCK_PROJECT = {
  id: 'project-001',
  company_id: 'company-test-001',
  name: 'maestro',
  prefix: 'MAE',
  description: null,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_ISSUE = {
  id: 'issue-001',
  company_id: 'company-test-001',
  project_id: 'project-001',
  title: 'テストIssue',
  status: 'open',
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_GOAL = {
  id: 'goal-001',
  company_id: 'company-test-001',
  project_id: 'project-001',
  title: 'テストGoal',
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_WORKSPACE = {
  id: 'ws-001',
  project_id: 'project-001',
  name: 'default',
  created_at: new Date(),
};

/**
 * projects.ts の DB チェーンパターン:
 *   select().from().where().limit(1)           → 配列 (find one)
 *   select().from().where().orderBy().limit().offset() → 配列 (list)
 *   select({ total }).from().where()           → [{ total: N }]  ← sql`count(*)`
 *   insert().values().returning()              → [row]
 *   update().set().where().returning()         → [row]
 *   delete().where()                           → void
 */
function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([MOCK_PROJECT]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_PROJECT]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ----------------------------------------------------------------
// generatePrefix ユニットテスト（HTTP 経由で結果を観察）
// ----------------------------------------------------------------

describe('generatePrefix (whitebox via POST /api/projects)', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('英字3文字以上: "maestro" → prefix は "MAE"', async () => {
    let capturedPrefix: string | undefined;
    const db = makeDb();
    db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedPrefix = vals.prefix as string;
      return db;
    });
    db.returning = vi.fn().mockImplementation(() =>
      Promise.resolve([{ ...MOCK_PROJECT, prefix: capturedPrefix }])
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'maestro' });

    expect(res.status).toBe(201);
    expect(res.body.data.prefix).toBe('MAE');
  });

  it('英字1文字: "a" → prefix は "AXX"', async () => {
    let capturedPrefix: string | undefined;
    const db = makeDb();
    db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedPrefix = vals.prefix as string;
      return db;
    });
    db.returning = vi.fn().mockImplementation(() =>
      Promise.resolve([{ ...MOCK_PROJECT, prefix: capturedPrefix }])
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'a' });

    expect(res.status).toBe(201);
    expect(res.body.data.prefix).toBe('AXX');
  });

  it('英字0文字 (全角のみ): "テスト" → prefix は3文字のアルファベット', async () => {
    let capturedPrefix: string | undefined;
    const db = makeDb();
    db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedPrefix = vals.prefix as string;
      return db;
    });
    db.returning = vi.fn().mockImplementation(() =>
      Promise.resolve([{ ...MOCK_PROJECT, prefix: capturedPrefix }])
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'テスト' });

    expect(res.status).toBe(201);
    // 全角のみの場合: 先頭3文字のコードポイントから生成された3文字アルファベット
    expect(res.body.data.prefix).toMatch(/^[A-Z]{3}$/);
  });

  it('大文字変換: "abc" → prefix は "ABC"', async () => {
    let capturedPrefix: string | undefined;
    const db = makeDb();
    db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedPrefix = vals.prefix as string;
      return db;
    });
    db.returning = vi.fn().mockImplementation(() =>
      Promise.resolve([{ ...MOCK_PROJECT, prefix: capturedPrefix }])
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'abc' });

    expect(res.status).toBe(201);
    expect(res.body.data.prefix).toBe('ABC');
  });
});

// ----------------------------------------------------------------
// GET /api/projects
// DBチェーン: select({total}).from().where() → [{total}]
//             select().from().where().orderBy().limit().offset() → rows
// ----------------------------------------------------------------

describe('GET /api/projects', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-01: 200 と data+meta を返す', async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // count クエリ: .where() が直接 Promise を返す
        return Promise.resolve([{ total: 1 }]);
      }
      // list クエリ: .where().orderBy().limit().offset()
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([MOCK_PROJECT]),
          }),
        }),
      };
    });

    const db = makeDb({ where: mockWhere });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ total: 1 });
  });
});

// ----------------------------------------------------------------
// POST /api/projects
// ----------------------------------------------------------------

describe('POST /api/projects', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-02: name 欠落 → 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ description: '説明のみ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-03: 正常作成 → 201 と prefix 自動生成', async () => {
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([{ ...MOCK_PROJECT, name: 'NewProject', prefix: 'NEW' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'NewProject' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('prefix');
    expect(typeof res.body.data.prefix).toBe('string');
    expect(res.body.data.prefix.length).toBeGreaterThan(0);
  });

  it('UT-04: カスタムprefix指定 → 201 かつそのprefixが使われる', async () => {
    let capturedPrefix: string | undefined;
    const db = makeDb();
    db.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedPrefix = vals.prefix as string;
      return db;
    });
    db.returning = vi.fn().mockImplementation(() =>
      Promise.resolve([{ ...MOCK_PROJECT, prefix: capturedPrefix }])
    );
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'テスト', prefix: 'CUSTOM' });

    expect(res.status).toBe(201);
    expect(res.body.data.prefix).toBe('CUSTOM');
  });
});

// ----------------------------------------------------------------
// GET /api/projects/:projectId
// ----------------------------------------------------------------

describe('GET /api/projects/:projectId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-05: 存在する → 200 と data', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([MOCK_PROJECT]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/project-001');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('project-001');
  });

  it('UT-06: 存在しない → 404 not_found', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ----------------------------------------------------------------
// PATCH /api/projects/:projectId
// ----------------------------------------------------------------

describe('PATCH /api/projects/:projectId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-07: 正常更新 → 200 と updated data', async () => {
    const updated = { ...MOCK_PROJECT, name: '更新後' };
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/projects/project-001')
      .send({ name: '更新後' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('更新後');
  });

  it('UT-08: 存在しない → 404 not_found', async () => {
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/projects/nonexistent')
      .send({ name: '更新' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ----------------------------------------------------------------
// DELETE /api/projects/:projectId
// ----------------------------------------------------------------

describe('DELETE /api/projects/:projectId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-09: 200 と success:true を返す', async () => {
    const db = makeDb();
    // delete().where() は void
    db.where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/projects/project-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ----------------------------------------------------------------
// GET /api/projects/:projectId/issues
// DBチェーン:
//   1回目 where().limit(1)          → projectCheck
//   2回目 where()                   → [{total}]  (count)
//   3回目 where().orderBy().limit().offset() → issues
// ----------------------------------------------------------------

describe('GET /api/projects/:projectId/issues', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-10: project not found → 404', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]); // project が見つからない
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/nonexistent/issues');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-11: 正常 → 200 と data+meta', async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // projectCheck: .where().limit(1)
        return { limit: vi.fn().mockResolvedValue([{ id: 'project-001' }]) };
      }
      if (callCount === 2) {
        // count クエリ
        return Promise.resolve([{ total: 1 }]);
      }
      // issues list: .where().orderBy().limit().offset()
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([MOCK_ISSUE]),
          }),
        }),
      };
    });

    const db = makeDb({ where: mockWhere });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/project-001/issues');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ total: 1 });
  });
});

// ----------------------------------------------------------------
// GET /api/projects/:projectId/goals
// DBチェーン: projectCheck → count → goals list
// ----------------------------------------------------------------

describe('GET /api/projects/:projectId/goals', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-12: 正常 → 200 と data+meta', async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { limit: vi.fn().mockResolvedValue([{ id: 'project-001' }]) };
      }
      if (callCount === 2) {
        return Promise.resolve([{ total: 1 }]);
      }
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([MOCK_GOAL]),
          }),
        }),
      };
    });

    const db = makeDb({ where: mockWhere });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/project-001/goals');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ total: 1 });
  });
});

// ----------------------------------------------------------------
// POST /api/projects/:projectId/goals
// DBチェーン: projectCheck → goalCheck → update().set().where().returning()
// ----------------------------------------------------------------

describe('POST /api/projects/:projectId/goals', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-13: goal_id 欠落 → 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/projects/project-001/goals')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-14: project not found → 404', async () => {
    // projectCheck が空を返す
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects/nonexistent/goals')
      .send({ goal_id: 'goal-001' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-15: goal not found → 404', async () => {
    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ id: 'project-001' }]); // project found
      return Promise.resolve([]); // goal not found
    });

    const db = makeDb({ limit: mockLimit });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects/project-001/goals')
      .send({ goal_id: 'nonexistent-goal' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-16: 正常 → 200 と updated goal', async () => {
    const updatedGoal = { ...MOCK_GOAL, project_id: 'project-001' };
    let limitCallCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      limitCallCount++;
      if (limitCallCount === 1) return Promise.resolve([{ id: 'project-001' }]); // project
      return Promise.resolve([{ id: 'goal-001' }]); // goal
    });

    const db = makeDb({ limit: mockLimit });
    db.returning = vi.fn().mockResolvedValue([updatedGoal]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/projects/project-001/goals')
      .send({ goal_id: 'goal-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('goal-001');
  });
});

// ----------------------------------------------------------------
// GET /api/projects/:projectId/workspaces
// DBチェーン: projectCheck.limit(1) → workspaces.where()
// ----------------------------------------------------------------

describe('GET /api/projects/:projectId/workspaces', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-17: project not found → 404', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/nonexistent/workspaces');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-18: 正常 → 200 と data 配列', async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // projectCheck: .where().limit(1)
        return { limit: vi.fn().mockResolvedValue([{ id: 'project-001' }]) };
      }
      // workspaces: .where() → Promise (limit なし)
      return Promise.resolve([MOCK_WORKSPACE]);
    });

    const db = makeDb({ where: mockWhere });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/projects/project-001/workspaces');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
