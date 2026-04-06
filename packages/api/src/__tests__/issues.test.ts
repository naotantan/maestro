/**
 * ホワイトボックステスト: /api/issues
 * issues.ts の全分岐をカバーする
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';
import { findOwnedIssue, findOwnedGoal, findOwnedAgent } from '../utils/ownership.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string; userId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    req.userId = 'user-001';
    next();
  },
}));

vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../utils/ownership.js', () => ({
  findOwnedIssue: vi.fn(),
  findOwnedGoal: vi.fn(),
  findOwnedAgent: vi.fn(),
}));

const MOCK_ISSUE = {
  id: 'issue-001',
  company_id: 'company-test-001',
  project_id: null,
  identifier: 'TODO-001',
  title: 'テストIssue',
  description: null,
  status: 'todo',
  priority: 2,
  assigned_to: null,
  created_by: 'user-001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
};

/**
 * issues.ts の POST はトランザクション内で select → insert を行う。
 * db.transaction(async (tx) => { ... }) を解決するため、
 * makeDb() は transaction を「渡されたコールバックに tx（= db 自身）を渡して実行する」実装にする。
 */
function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_ISSUE]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  // transaction は渡されたコールバックを db 自身（= tx として機能）で呼び出す
  db.transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb(db);
  });
  return db;
}

// -----------------------------------------------------------------------
// GET /api/issues
// -----------------------------------------------------------------------
describe('GET /api/issues', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('200 と data 配列を返す', async () => {
    const db = makeDb();
    // GET /api/issues チェーン: select.from.leftJoin.where.orderBy.limit.offset → Promise
    // limit() が offset() を持つオブジェクトを返す必要がある
    db.limit = vi.fn().mockReturnValue({
      offset: vi.fn().mockResolvedValue([MOCK_ISSUE]),
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// POST /api/issues
// -----------------------------------------------------------------------
describe('POST /api/issues', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('title 欠落で 400', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ description: '説明のみ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/title/);
  });

  it('無効な status で 400', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'テスト', status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/status/);
  });

  it('priority が範囲外 (6) で 400', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'テスト', priority: 6 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/priority/);
  });

  it('無効な project_id で 400', async () => {
    const db = makeDb();
    // project_id 検証クエリ → 見つからない
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'テスト', project_id: 'nonexistent-project' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/project_id/);
  });

  it('正常作成 (project_id なし) → 201, identifier=TODO-001', async () => {
    const db = makeDb();
    // project_id なし → agents 自動アサイン候補クエリ → []
    // transaction 内: maxResult → [], insert.returning → [MOCK_ISSUE]
    let limitCallCount = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCallCount++;
      if (limitCallCount === 1) {
        // assigned_to なし → availableAgents クエリ → []（アサイン不要）
        return Promise.resolve([]);
      }
      // transaction 内 maxResult
      return Promise.resolve([{ max_id: null }]);
    });
    db.returning = vi.fn().mockResolvedValue([MOCK_ISSUE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'テストIssue' });

    expect(res.status).toBe(201);
    expect(res.body.data.identifier).toBe('TODO-001');
  });

  it('無効な assigned_to で 400', async () => {
    // findOwnedAgent → null（存在しないエージェント）
    vi.mocked(findOwnedAgent).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'テスト', assigned_to: 'nonexistent-agent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/assigned_to/);
  });
});

// -----------------------------------------------------------------------
// GET /api/issues/:issueId
// -----------------------------------------------------------------------
describe('GET /api/issues/:issueId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('存在する Issue → 200', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([MOCK_ISSUE]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/issue-001');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('issue-001');
  });

  it('存在しない Issue → 404', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// -----------------------------------------------------------------------
// PATCH /api/issues/:issueId
// -----------------------------------------------------------------------
describe('PATCH /api/issues/:issueId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('無効な status で 400', async () => {
    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it("status='done' で対応完了が description に追記される", async () => {
    const updatedIssue = {
      ...MOCK_ISSUE,
      status: 'done',
      description: 'もとの説明\n\n---\n**対応完了**',
      completed_at: new Date().toISOString(),
    };
    const db = makeDb();
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    // PATCH status=done の DB 呼び出し順序:
    // 1. db.select().from().where().limit(1) → currentIssue [{ description }]
    // 2. db.update().set().where().returning() → [updatedIssue]
    // 3. db.select().from().where() → linkedGoals [] (issue_goals)
    // where() をカウントベースで制御する
    let whereCallCount = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        // currentIssue: .where().limit(1) チェーン
        return { limit: vi.fn().mockResolvedValue([{ description: 'もとの説明' }]) };
      }
      if (whereCallCount === 2) {
        // update().set().where().returning()
        return { returning: vi.fn().mockResolvedValue([updatedIssue]) };
      }
      // issue_goals .where() → 直接 Promise（linkedGoals）
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');
    expect(res.body.data.description).toContain('**対応完了**');
  });

  it('存在しない Issue → 404', async () => {
    const db = makeDb();
    // assigned_to / project_id チェックなし
    // currentIssue 取得（done でないので呼ばれない）
    // update.returning → []
    db.limit = vi.fn().mockResolvedValue([{ description: '' }]);
    db.returning = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/issues/nonexistent')
      .send({ title: '新タイトル' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// -----------------------------------------------------------------------
// DELETE /api/issues/:issueId
// -----------------------------------------------------------------------
describe('DELETE /api/issues/:issueId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('200 と success:true を返す', async () => {
    const db = makeDb();
    // delete().where() → void（Promise.resolve()）
    db.where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/issues/issue-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// -----------------------------------------------------------------------
// GET /api/issues/:issueId/comments
// -----------------------------------------------------------------------
describe('GET /api/issues/:issueId/comments', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('Issue が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/nonexistent/comments');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('Issue が存在する → 200 と data 配列', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    const db = makeDb();
    // GET comments の DB 呼び出し順序:
    // 1. count: select().from().where() → [{ total: '0' }]  ← where() が直接 Promise を返す
    // 2. comments: select().from().where().orderBy().limit().offset() → []
    let whereCallCount = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        // count クエリ: .where() が直接解決
        return Promise.resolve([{ total: '0' }]);
      }
      // comments クエリ: .where().orderBy().limit().offset() チェーン
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/issue-001/comments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// POST /api/issues/:issueId/comments
// -----------------------------------------------------------------------
describe('POST /api/issues/:issueId/comments', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('body 欠落 → 400', async () => {
    const res = await request(app)
      .post('/api/issues/issue-001/comments')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/body/);
  });

  it('userId 未設定 → 403', async () => {
    // このテストだけ userId なしの auth ミドルウェアが必要なため、
    // auth.js モックを userId なしに再設定してから createApp() する
    vi.doMock('../middleware/auth.js', () => ({
      authMiddleware: (req: { companyId?: string; userId?: string }, _res: unknown, next: () => void) => {
        req.companyId = 'company-test-001';
        // userId を設定しない
        next();
      },
    }));

    // モジュールキャッシュをリセットして新しい app を生成
    vi.resetModules();
    const { createApp: createFreshApp } = await import('../server.js');
    const appNoUser = createFreshApp();

    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(appNoUser)
      .post('/api/issues/issue-001/comments')
      .send({ body: 'コメントです' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('正常なコメント投稿 → 201', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    const MOCK_COMMENT = {
      id: 'comment-001',
      issue_id: 'issue-001',
      author_id: 'user-001',
      body: 'コメントです',
      created_at: new Date().toISOString(),
    };
    const db = makeDb();
    // @メンションなし → agents クエリ不要
    // insert.returning → [MOCK_COMMENT]
    db.returning = vi.fn().mockResolvedValue([MOCK_COMMENT]);
    // agents クエリ (mention 処理): select().from().where() → []
    db.where = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/issue-001/comments')
      .send({ body: 'コメントです' });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe('コメントです');
  });
});

// -----------------------------------------------------------------------
// GET /api/issues/:issueId/goals
// -----------------------------------------------------------------------
describe('GET /api/issues/:issueId/goals', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('Issue が存在する → 200 と data 配列', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    const db = makeDb();
    db.where = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/issue-001/goals');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Issue が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/issues/nonexistent/goals');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// -----------------------------------------------------------------------
// POST /api/issues/:issueId/goals
// -----------------------------------------------------------------------
describe('POST /api/issues/:issueId/goals', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('goal_id 欠落 → 400', async () => {
    const res = await request(app)
      .post('/api/issues/issue-001/goals')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/goal_id/);
  });

  it('Issue が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/nonexistent/goals')
      .send({ goal_id: 'goal-001' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('Goal が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    vi.mocked(findOwnedGoal).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/issue-001/goals')
      .send({ goal_id: 'nonexistent-goal' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('正常な紐付け → 201', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    vi.mocked(findOwnedGoal).mockResolvedValue({ id: 'goal-001' });
    const MOCK_LINK = { issue_id: 'issue-001', goal_id: 'goal-001' };
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([MOCK_LINK]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/issue-001/goals')
      .send({ goal_id: 'goal-001' });

    expect(res.status).toBe(201);
    expect(res.body.data.goal_id).toBe('goal-001');
  });

  it('重複紐付け (23505) → 409', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    vi.mocked(findOwnedGoal).mockResolvedValue({ id: 'goal-001' });
    const db = makeDb();
    const duplicateError = Object.assign(new Error('duplicate key'), { code: '23505' });
    db.returning = vi.fn().mockRejectedValue(duplicateError);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/issue-001/goals')
      .send({ goal_id: 'goal-001' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('conflict');
  });
});

// -----------------------------------------------------------------------
// DELETE /api/issues/:issueId/goals/:goalId
// -----------------------------------------------------------------------
describe('DELETE /api/issues/:issueId/goals/:goalId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('Issue が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/issues/nonexistent/goals/goal-001');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('Goal が見つからない → 404', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    vi.mocked(findOwnedGoal).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/issues/issue-001/goals/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('正常な紐付け解除 → 200 success:true', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    vi.mocked(findOwnedGoal).mockResolvedValue({ id: 'goal-001' });
    const db = makeDb();
    db.where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).delete('/api/issues/issue-001/goals/goal-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// -----------------------------------------------------------------------
// 追加分岐カバレッジ: POST /api/issues (project_id あり / identifier インクリメント)
// -----------------------------------------------------------------------
describe('POST /api/issues - 追加分岐', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('project_id あり + 既存 identifier あり → prefix 付き連番で 201', async () => {
    const issueWithProject = { ...MOCK_ISSUE, project_id: 'project-001', identifier: 'PROJ-002' };
    const db = makeDb();
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    // DB 呼び出し順序（project_id あり）:
    // 1. project 存在確認: select.from.where.limit → [{ id: 'project-001' }]
    // 2. availableAgents: select.from.where.limit → []
    // transaction 内:
    // 3. prefix 取得: tx.select.from.where.limit → [{ prefix: 'PROJ' }]
    // 4. maxIdentifier: tx.select.from.where → [{ max_id: 'PROJ-001' }]
    // 5. insert.values.returning → [issueWithProject]
    let limitCallCount = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCallCount++;
      if (limitCallCount === 1) return Promise.resolve([{ id: 'project-001' }]); // project 検証
      if (limitCallCount === 2) return Promise.resolve([]);                        // availableAgents
      if (limitCallCount === 3) return Promise.resolve([{ prefix: 'PROJ' }]);     // prefix 取得
      return Promise.resolve([{ max_id: 'PROJ-001' }]);                           // maxIdentifier
    });
    db.returning = vi.fn().mockResolvedValue([issueWithProject]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'プロジェクト付きIssue', project_id: 'project-001' });

    expect(res.status).toBe(201);
    expect(res.body.data.project_id).toBe('project-001');
    expect(res.body.data.identifier).toBe('PROJ-002');
  });

  it('assigned_to が有効なエージェント → 201 で assigned_to が設定される', async () => {
    const issueWithAgent = { ...MOCK_ISSUE, assigned_to: 'agent-001' };
    vi.mocked(findOwnedAgent).mockResolvedValue({ id: 'agent-001' });
    const db = makeDb();
    let limitCallCount = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCallCount++;
      // transaction 内 maxIdentifier
      return Promise.resolve([{ max_id: null }]);
    });
    db.returning = vi.fn().mockResolvedValue([issueWithAgent]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'エージェントアサインIssue', assigned_to: 'agent-001' });

    expect(res.status).toBe(201);
    expect(res.body.data.assigned_to).toBe('agent-001');
  });
});

// -----------------------------------------------------------------------
// 追加分岐カバレッジ: PATCH /api/issues/:issueId
// -----------------------------------------------------------------------
describe('PATCH /api/issues/:issueId - 追加分岐', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('priority 範囲外 (priority=-1) → 400', async () => {
    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ priority: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/priority/);
  });

  it('assigned_to が無効なエージェント → 400', async () => {
    vi.mocked(findOwnedAgent).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ assigned_to: 'nonexistent-agent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/assigned_to/);
  });

  it('無効な project_id → 400', async () => {
    vi.mocked(findOwnedAgent).mockResolvedValue(null);
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]); // project 見つからない
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ project_id: 'nonexistent-project' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toMatch(/project_id/);
  });

  it('status=done で description が既に **対応完了** を含む → 追記しない', async () => {
    const existingDesc = 'もとの説明\n\n---\n**対応完了** (2026-04-01 12:00)\n手動で完了マークされました。';
    const updatedIssue = { ...MOCK_ISSUE, status: 'done', description: existingDesc };
    const db = makeDb();
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    let whereCallCount = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        return { limit: vi.fn().mockResolvedValue([{ description: existingDesc }]) };
      }
      if (whereCallCount === 2) {
        return { returning: vi.fn().mockResolvedValue([updatedIssue]) };
      }
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    // 2回目の **対応完了** が追記されていないことを確認
    const descLines = res.body.data.description.split('**対応完了**').length - 1;
    expect(descLines).toBe(1);
  });

  it('status=done + description 付き → description が resolution note に含まれる', async () => {
    const updatedIssue = {
      ...MOCK_ISSUE,
      status: 'done',
      description: 'もとの説明\n\n---\n**対応完了**\n修正しました',
    };
    const db = makeDb();
    vi.mocked(findOwnedAgent).mockResolvedValue(null);

    let whereCallCount = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        return { limit: vi.fn().mockResolvedValue([{ description: 'もとの説明' }]) };
      }
      if (whereCallCount === 2) {
        return { returning: vi.fn().mockResolvedValue([updatedIssue]) };
      }
      return Promise.resolve([]);
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/issues/issue-001')
      .send({ status: 'done', description: '修正しました' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toContain('**対応完了**');
  });
});

// -----------------------------------------------------------------------
// 追加分岐カバレッジ: POST /api/issues/:issueId/comments (@メンション)
// -----------------------------------------------------------------------
describe('POST /api/issues/:issueId/comments - @メンション', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('@エージェント名メンションがある → agent_handoffs が生成される', async () => {
    vi.mocked(findOwnedIssue).mockResolvedValue({ id: 'issue-001' });
    const MOCK_COMMENT = {
      id: 'comment-002',
      issue_id: 'issue-001',
      author_id: 'user-001',
      body: '@testbot 確認してください',
      created_at: new Date().toISOString(),
    };
    const db = makeDb();

    // DB 呼び出し順序:
    // 1. insert comment.returning → [MOCK_COMMENT]
    // 2. select agents .where() → [{ id: 'agent-001', name: 'testbot' }]
    // 3. insert agent_handoffs.returning → []
    let insertCallCount = 0;
    db.insert = vi.fn().mockReturnThis();
    db.values = vi.fn().mockReturnThis();
    db.returning = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) return Promise.resolve([MOCK_COMMENT]); // comment
      return Promise.resolve([]); // agent_handoffs
    });
    // agents クエリ: select.from.where → [{ id, name }]
    db.where = vi.fn().mockResolvedValue([{ id: 'agent-001', name: 'testbot' }]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/issues/issue-001/comments')
      .send({ body: '@testbot 確認してください' });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe('@testbot 確認してください');
  });
});
