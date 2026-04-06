/**
 * ホワイトボックステスト: /api/session-summaries
 * session-summaries.ts の変更点（upsert対応・activity_log書き込み追加）をカバー
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';

// 認証をバイパス
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    next();
  },
}));

vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const MOCK_SUMMARY = {
  id: 'summary-001',
  company_id: 'company-test-001',
  session_id: 'session-abc',
  agent_id: null,
  summary: 'テスト作業サマリー',
  headline: 'テスト見出し',
  tasks: ['タスク1'],
  decisions: ['決定1'],
  changed_files: ['src/foo.ts'],
  related_issue_ids: [],
  session_started_at: null,
  session_ended_at: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────
// GET /api/session-summaries
// ─────────────────────────────────────────────────────────────
describe('GET /api/session-summaries', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-01: 一覧を返す（200 + data配列）', async () => {
    // GET は select().from().where().orderBy().limit().offset() チェーン
    const offsetMock = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const db = { select: selectMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .get('/api/session-summaries')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].id).toBe('summary-001');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('offset');
  });

  it('SS-02: 空の一覧でも200を返す', async () => {
    const offsetMock = vi.fn().mockResolvedValue([]);
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const db = { select: selectMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .get('/api/session-summaries')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/session-summaries/:id
// ─────────────────────────────────────────────────────────────
describe('GET /api/session-summaries/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-03: 存在するIDで200とデータを返す', async () => {
    // select().from().where().limit(1) → [MOCK_SUMMARY]
    const limitMock = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const db = { select: selectMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .get('/api/session-summaries/summary-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('summary-001');
  });

  it('SS-04: 存在しないIDで404を返す', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const db = { select: selectMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .get('/api/session-summaries/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — バリデーション
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — バリデーション', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-05: summary欠落で400を返す', async () => {
    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({ session_id: 'sess-001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('SS-06: 空文字のsummaryで400を返す', async () => {
    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({ summary: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — 新規作成（session_idなし）
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — 新規作成', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-07: session_idなし — 201で新規登録', async () => {
    // POST（session_idなし）のDB呼び出し順序:
    //   1. insert(session_summaries).values().returning() → [MOCK_SUMMARY]
    //   2. getDb().insert(activity_log).values().catch()  (fire-and-forget)
    //   3. select(plugins).from().where() → [] (スキル自動検出)

    // plugins スキャン用のselect チェーン
    const pluginsWhere = vi.fn().mockResolvedValue([]);
    const pluginsFrom = vi.fn().mockReturnValue({ where: pluginsWhere });
    const pluginsSelect = vi.fn().mockReturnValue({ from: pluginsFrom });

    // activity_log insert（fire-and-forget）— .catch() が必要
    const activityCatch = vi.fn().mockReturnThis();
    const activityValues = vi.fn().mockReturnValue({ catch: activityCatch });

    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const sessionValues = vi.fn().mockReturnValue({ returning: sessionReturning });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // session_summaries への insert
        return { values: sessionValues };
      }
      // activity_log への insert
      return { values: activityValues };
    });

    let selectCallCount = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      selectCallCount++;
      // plugins 取得
      return { from: pluginsFrom };
    });

    const db = {
      insert: insertMock,
      select: selectMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        summary: 'テスト作業サマリー',
        headline: 'テスト見出し',
        tasks: ['タスク1'],
        decisions: ['決定1'],
        changed_files: ['src/foo.ts'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });

  it('SS-08: session_idあり、既存なし — 201で新規登録', async () => {
    // POST（session_idあり、新規）のDB呼び出し順序:
    //   1. select(session_summaries).from().where().limit(1) → []（存在しない）
    //   2. insert(session_summaries).values().returning() → [MOCK_SUMMARY]
    //   3. getDb().insert(activity_log).values().catch()
    //   4. select(plugins).from().where() → []

    // 重複チェック select
    const dupLimitMock = vi.fn().mockResolvedValue([]);
    const dupWhereMock = vi.fn().mockReturnValue({ limit: dupLimitMock });
    const dupFromMock = vi.fn().mockReturnValue({ where: dupWhereMock });

    // plugins select
    const pluginsWhereMock = vi.fn().mockResolvedValue([]);
    const pluginsFromMock = vi.fn().mockReturnValue({ where: pluginsWhereMock });

    let selectCallCount = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // session_summaries 重複チェック
        return { from: dupFromMock };
      }
      // plugins スキャン
      return { from: pluginsFromMock };
    });

    // activity_log fire-and-forget
    const activityCatch = vi.fn().mockReturnThis();
    const activityValues = vi.fn().mockReturnValue({ catch: activityCatch });

    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const sessionValues = vi.fn().mockReturnValue({ returning: sessionReturning });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: sessionValues };
      }
      return { values: activityValues };
    });

    const db = {
      insert: insertMock,
      select: selectMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        session_id: 'new-session-id',
        summary: '新規セッションサマリー',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — upsert（既存session_idの更新）
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — upsert（既存session_id）', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-09: session_idが既存 — 200でupdated:trueを返す', async () => {
    // DB呼び出し順序:
    //   1. select(session_summaries).from().where().limit(1) → [{ id: 'summary-001' }]（既存あり）
    //   2. update(session_summaries).set().where().returning() → [updated]
    //   3. getDb().insert(activity_log).values().catch()

    const existingLimitMock = vi.fn().mockResolvedValue([{ id: 'summary-001' }]);
    const existingWhereMock = vi.fn().mockReturnValue({ limit: existingLimitMock });
    const existingFromMock = vi.fn().mockReturnValue({ where: existingWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: existingFromMock });

    const updatedSummary = { ...MOCK_SUMMARY, summary: '更新されたサマリー' };
    const updateReturningMock = vi.fn().mockResolvedValue([updatedSummary]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

    const activityCatch = vi.fn().mockReturnThis();
    const activityValues = vi.fn().mockReturnValue({ catch: activityCatch });
    const insertMock = vi.fn().mockReturnValue({ values: activityValues });

    const db = {
      select: selectMock,
      update: updateMock,
      insert: insertMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        session_id: 'session-abc',
        summary: '更新されたサマリー',
        headline: '新しい見出し',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('SS-10: upsert時にactivity_logにupdateアクションが書き込まれる', async () => {
    const existingLimitMock = vi.fn().mockResolvedValue([{ id: 'summary-001' }]);
    const existingWhereMock = vi.fn().mockReturnValue({ limit: existingLimitMock });
    const existingFromMock = vi.fn().mockReturnValue({ where: existingWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: existingFromMock });

    const updatedSummary = { ...MOCK_SUMMARY, summary: '更新されたサマリー' };
    const updateReturningMock = vi.fn().mockResolvedValue([updatedSummary]);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

    const activityCatch = vi.fn().mockReturnThis();
    const activityValuesMock = vi.fn().mockReturnValue({ catch: activityCatch });
    const insertMock = vi.fn().mockReturnValue({ values: activityValuesMock });

    const db = {
      select: selectMock,
      update: updateMock,
      insert: insertMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        session_id: 'session-abc',
        summary: '更新されたサマリー',
      });

    expect(res.status).toBe(200);
    // activity_log への insert が呼ばれたことを確認
    expect(insertMock).toHaveBeenCalled();
    const activityArgs = activityValuesMock.mock.calls[0]?.[0];
    expect(activityArgs).toMatchObject({
      entity_type: 'session',
      action: 'update',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — activity_log（新規作成時）
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — activity_log（新規作成）', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-11: 新規作成時にactivity_logにcreateアクションが書き込まれる', async () => {
    // session_id なし → 重複チェックなし
    // plugins スキャン select
    const pluginsWhereMock = vi.fn().mockResolvedValue([]);
    const pluginsFromMock = vi.fn().mockReturnValue({ where: pluginsWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: pluginsFromMock });

    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const sessionValuesMock = vi.fn().mockReturnValue({ returning: sessionReturning });

    // activity_log insert
    const activityCatch = vi.fn().mockReturnThis();
    const activityValuesMock = vi.fn().mockReturnValue({ catch: activityCatch });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: sessionValuesMock };
      }
      return { values: activityValuesMock };
    });

    const db = {
      insert: insertMock,
      select: selectMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({ summary: '新規セッションサマリー' });

    expect(res.status).toBe(201);
    // 2回以上の insert 呼び出し（session + activity_log）
    expect(insertMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    // activity_log の values に create アクションが含まれること
    const activityArgs = activityValuesMock.mock.calls[0]?.[0];
    expect(activityArgs).toMatchObject({
      entity_type: 'session',
      action: 'create',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/session-summaries/:id
// ─────────────────────────────────────────────────────────────
describe('PATCH /api/session-summaries/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-12: 存在するIDで200と更新データを返す', async () => {
    const updatedSummary = { ...MOCK_SUMMARY, summary: 'PATCHで更新されたサマリー' };
    const returningMock = vi.fn().mockResolvedValue([updatedSummary]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    const db = { update: updateMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .patch('/api/session-summaries/summary-001')
      .set('Authorization', 'Bearer test-key')
      .send({ summary: 'PATCHで更新されたサマリー' });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBe('PATCHで更新されたサマリー');
  });

  it('SS-13: 存在しないIDで404を返す', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    const db = { update: updateMock } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .patch('/api/session-summaries/nonexistent-id')
      .set('Authorization', 'Bearer test-key')
      .send({ summary: '更新' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — related_issue_ids自動完了
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — related_issue_ids自動完了', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('SS-14: related_issue_idsが指定されるとIssueをdoneに更新する', async () => {
    // DB呼び出し順序:
    //   1. insert(session_summaries).values().returning() → [MOCK_SUMMARY]
    //   2. getDb().insert(activity_log).values().catch()
    //   3. select(issues).from().where() → [MOCK_ISSUE]（issues用 inArray+eq）
    //   4. db.transaction(...)
    //   5. select(plugins).from().where() → []

    const MOCK_ISSUE = { id: 'issue-001', description: '既存の説明' };

    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([{ ...MOCK_SUMMARY, related_issue_ids: ['issue-001'] }]);
    const sessionValuesMock = vi.fn().mockReturnValue({ returning: sessionReturning });

    // activity_log insert
    const activityCatch = vi.fn().mockReturnThis();
    const activityValuesMock = vi.fn().mockReturnValue({ catch: activityCatch });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: sessionValuesMock };
      }
      return { values: activityValuesMock };
    });

    // issues select: select().from().where() → [MOCK_ISSUE]
    // plugins select: select().from().where() → []
    let selectCallCount = 0;
    const issuesWhereMock = vi.fn().mockResolvedValue([MOCK_ISSUE]);
    const issuesFromMock = vi.fn().mockReturnValue({ where: issuesWhereMock });
    const pluginsWhereMock = vi.fn().mockResolvedValue([]);
    const pluginsFromMock = vi.fn().mockReturnValue({ where: pluginsWhereMock });

    const selectMock = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // issues 取得
        return { from: issuesFromMock };
      }
      // plugins スキャン
      return { from: pluginsFromMock };
    });

    // transaction
    const txWhereMock = vi.fn().mockResolvedValue([]);
    const txSetMock = vi.fn().mockReturnValue({ where: txWhereMock });
    const txUpdateMock = vi.fn().mockReturnValue({ set: txSetMock });
    const transactionMock = vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({ update: txUpdateMock })
    );

    const db = {
      insert: insertMock,
      select: selectMock,
      transaction: transactionMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        summary: 'Issue解決したサマリー',
        related_issue_ids: ['issue-001'],
      });

    expect(res.status).toBe(201);
    // transaction が呼ばれたことを確認（Issue更新が実行された）
    expect(transactionMock).toHaveBeenCalled();
  });

  it('SS-15: related_issue_idsが空配列の場合はtransactionを呼ばない', async () => {
    // plugins スキャン select
    const pluginsWhereMock = vi.fn().mockResolvedValue([]);
    const pluginsFromMock = vi.fn().mockReturnValue({ where: pluginsWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: pluginsFromMock });

    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const sessionValuesMock = vi.fn().mockReturnValue({ returning: sessionReturning });

    // activity_log fire-and-forget
    const activityCatch = vi.fn().mockReturnThis();
    const activityValuesMock = vi.fn().mockReturnValue({ catch: activityCatch });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: sessionValuesMock };
      }
      return { values: activityValuesMock };
    });

    const transactionMock = vi.fn();

    const db = {
      insert: insertMock,
      select: selectMock,
      transaction: transactionMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send({
        summary: 'Issueなしサマリー',
        related_issue_ids: [],
      });

    expect(res.status).toBe(201);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/session-summaries — スキル使用カウント自動検出
// ─────────────────────────────────────────────────────────────
describe('POST /api/session-summaries — スキル使用カウント自動検出', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  /** ヘルパー: DB モックを組み立てて POST を実行し status と usedPluginIds を返す */
  async function postWithPlugins(
    bodyPayload: Record<string, unknown>,
    mockPlugins: { id: string; name: string }[],
  ) {
    // session_summaries insert
    const sessionReturning = vi.fn().mockResolvedValue([MOCK_SUMMARY]);
    const sessionValuesMock = vi.fn().mockReturnValue({ returning: sessionReturning });

    // activity_log fire-and-forget
    const activityCatch = vi.fn().mockReturnThis();
    const activityValuesMock = vi.fn().mockReturnValue({ catch: activityCatch });

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) return { values: sessionValuesMock };
      return { values: activityValuesMock };
    });

    // plugins select
    const pluginsWhereMock = vi.fn().mockResolvedValue(mockPlugins);
    const pluginsFromMock = vi.fn().mockReturnValue({ where: pluginsWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: pluginsFromMock });

    // plugins update（usage_count インクリメント）
    const capturedWhereArgs: unknown[] = [];
    const updateWhereMock = vi.fn().mockImplementation((...args) => {
      capturedWhereArgs.push(...args);
      return Promise.resolve([]);
    });
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

    const db = {
      insert: insertMock,
      select: selectMock,
      update: updateMock,
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(getDb).mockReturnValue(db);

    const res = await request(app)
      .post('/api/session-summaries')
      .set('Authorization', 'Bearer test-key')
      .send(bodyPayload);

    return { res, updateMock, updateSetMock };
  }

  it('SS-16: ハイフン区切り名（claude-code）がプラグイン「Claude Code」にマッチしてusage_countが増える', async () => {
    const { res, updateMock } = await postWithPlugins(
      {
        summary: 'claude-code を使って作業した',
        changed_files: ['src/index.ts'],
      },
      [{ id: 'plugin-001', name: 'Claude Code' }],
    );

    expect(res.status).toBe(201);
    expect(updateMock).toHaveBeenCalled();
  });

  it('SS-17: アンダースコア区切り名（claude_code）がプラグイン「Claude Code」にマッチする', async () => {
    const { res, updateMock } = await postWithPlugins(
      {
        summary: 'changed_files: claude_code integration',
        changed_files: ['src/claude_code/index.ts'],
      },
      [{ id: 'plugin-001', name: 'Claude Code' }],
    );

    expect(res.status).toBe(201);
    expect(updateMock).toHaveBeenCalled();
  });

  it('SS-18: スペース区切り名（claude code）がプラグイン「Claude Code」にマッチする', async () => {
    const { res, updateMock } = await postWithPlugins(
      { summary: 'claude code でコードレビューを実施した' },
      [{ id: 'plugin-001', name: 'Claude Code' }],
    );

    expect(res.status).toBe(201);
    expect(updateMock).toHaveBeenCalled();
  });

  it('SS-19: 大文字混在（Claude_Code）がプラグイン「Claude Code」にマッチする', async () => {
    const { res, updateMock } = await postWithPlugins(
      { summary: '作業概要', changed_files: ['tools/Claude_Code/run.sh'] },
      [{ id: 'plugin-001', name: 'Claude Code' }],
    );

    expect(res.status).toBe(201);
    expect(updateMock).toHaveBeenCalled();
  });

  it('SS-20: プラグイン名が一切登場しないテキストではusage_countを更新しない', async () => {
    const { res, updateMock } = await postWithPlugins(
      { summary: '全く関係のない作業をしました', changed_files: ['src/other.ts'] },
      [{ id: 'plugin-001', name: 'Claude Code' }],
    );

    expect(res.status).toBe(201);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('SS-21: 複数プラグインのうち登場したものだけusage_countが増える', async () => {
    const { res, updateMock } = await postWithPlugins(
      { summary: 'claude-code を使いましたが other-tool は使っていません' },
      [
        { id: 'plugin-001', name: 'Claude Code' },
        { id: 'plugin-002', name: 'Other Tool' },
      ],
    );

    expect(res.status).toBe(201);
    // update が呼ばれた = 少なくとも1件マッチ
    expect(updateMock).toHaveBeenCalled();
    // set() に渡された引数にusage_count+1が含まれる
    const setArgs = updateMock.mock.results[0]?.value?.set?.mock?.calls[0]?.[0];
    expect(setArgs).toHaveProperty('usage_count');
  });
});
