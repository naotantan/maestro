/**
 * 単体テスト: /api/recipes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

// 認証ミドルウェアをモック
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    next();
  },
}));

// activityLogger をモック
vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const MOCK_RECIPE = {
  id: 'recipe-001',
  company_id: 'company-test-001',
  name: 'テストレシピ',
  description: 'テスト用レシピ',
  category: '開発',
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_STEPS = [
  {
    id: 'step-001',
    recipe_id: 'recipe-001',
    order: 1,
    phase_label: 'Phase 0: 調査',
    skill: 'github',
    instruction: '既存実装を検索する',
    note: null,
    created_at: new Date(),
  },
];

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([MOCK_RECIPE]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_RECIPE]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

vi.mock('@maestro/db', async () => {
  const actual = await vi.importActual('@maestro/db');
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

import { getDb } from '@maestro/db';

describe('GET /api/recipes', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-01: レシピ一覧を返す', async () => {
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('POST /api/recipes', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-02: nameなしで400を返す', async () => {
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/recipes')
      .send({ description: '説明だけ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-03: 正常登録で201を返す', async () => {
    const db = makeDb({
      returning: vi.fn().mockResolvedValue([MOCK_RECIPE]),
    });
    // recipe_steps.insert後のselect
    let callCount = 0;
    db.orderBy = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? [MOCK_RECIPE] : MOCK_STEPS);
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'テストレシピ',
        category: '開発',
        steps: [
          { order: 1, phase_label: 'Phase 0', instruction: '調査する' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('name', 'テストレシピ');
  });
});

describe('DELETE /api/recipes/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-04: 存在しないIDで404を返す', async () => {
    const db = makeDb({
      returning: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/recipes/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-05: 正常削除で200を返す', async () => {
    const db = makeDb({
      returning: vi.fn().mockResolvedValue([MOCK_RECIPE]),
    });
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app).delete(`/api/recipes/${MOCK_RECIPE.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', MOCK_RECIPE.id);
  });
});

describe('GET /api/recipes/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-06: 存在しないIDで404を返す', async () => {
    // select().from().where() chain: the route destructures first element of array
    // Return empty array → recipe not found
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
    vi.mocked(getDb).mockReturnValue(db as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/recipes/nonexistent');
    expect(res.status).toBe(404);
  });
});
