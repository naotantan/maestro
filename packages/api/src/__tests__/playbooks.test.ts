/**
 * 単体テスト: /api/playbooks
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

// Claude Agent SDK をモック（generatePlaybookWithClaude内で使用）
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(async function* () {
    yield {
      type: 'result',
      result: JSON.stringify({
        title: 'テストタスクの指示書',
        steps: [
          { order: 1, skill: 'tdd-guide', label: 'テスト設計', instruction: '/tdd-guide\n\n具体的な指示' },
        ],
      }),
    };
  }),
}));

// fsモジュールをモック（キューファイル書き出しを回避）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const MOCK_PLAYBOOK = {
  id: 'playbook-001',
  company_id: 'company-test-001',
  title: 'テストタスクの指示書',
  task: 'バグを修正して',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_STEP = {
  id: 'step-001',
  playbook_id: 'playbook-001',
  order: 1,
  skill: 'tdd-guide',
  label: 'テスト作成',
  instruction: '/tdd-guide\n\n具体的な指示',
  created_at: new Date().toISOString(),
};

const MOCK_JOB = {
  id: 'job-001',
  playbook_id: 'playbook-001',
  company_id: 'company-test-001',
  status: 'running',
  current_step: 1,
  total_steps: 3,
  error_message: null,
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
    offset: vi.fn().mockResolvedValue([MOCK_PLAYBOOK]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_PLAYBOOK]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// POST /api/playbooks/generate
// ──────────────────────────────────────────────────────────────
describe('POST /api/playbooks/generate', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB01: バグ関連タスクで200とステップを返す', async () => {
    // SDK失敗 → フォールバックで keyword scoring が動く
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]); // plugins = 0件 → フォールバック
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'バグを修正して' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBeDefined();
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data.steps.length).toBeGreaterThan(0);
  });

  it('UT-PB02: UI関連タスクで200とステップを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'ホームページのUIを実装して' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB03: テスト関連タスクで200とステップを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'テストのカバレッジを上げる' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB04: リファクタリング関連タスクで200とステップを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'コードをリファクタリングして整理する' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB05: 新機能実装タスクで200とステップを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: '認証機能を実装して追加する' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB06: 汎用タスクで200とステップを返す（その他分岐）', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'ドキュメントを翻訳する' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB07: taskなしで400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-PB08: task空文字で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-PB09: pluginsが存在する場合はSDKを使って生成し200を返す', async () => {
    const mockDb = buildMockDb();
    // plugins取得 → 1件返す
    mockDb.where.mockResolvedValueOnce([
      { name: 'tdd-guide', description: 'TDDガイド', category: 'testing' },
    ]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/generate')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'バグを修正して' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/playbooks
// ──────────────────────────────────────────────────────────────
describe('GET /api/playbooks', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB10: 一覧を200で返す', async () => {
    const mockDb = buildMockDb();
    mockDb.orderBy.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/playbooks')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/playbooks/:id
// ──────────────────────────────────────────────────────────────
describe('GET /api/playbooks/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB11: 存在するidでplaybookとstepsを200で返す', async () => {
    const mockDb = buildMockDb();
    // playbook取得
    mockDb.where
      .mockResolvedValueOnce([MOCK_PLAYBOOK])
      // steps取得
      .mockReturnValueOnce({
        orderBy: vi.fn().mockResolvedValue([MOCK_STEP]),
      });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/playbooks/playbook-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('playbook-001');
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB12: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/playbooks/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/playbooks
// ──────────────────────────────────────────────────────────────
describe('POST /api/playbooks', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB13: 正常生成＆保存で201とデータを返す', async () => {
    const mockDb = buildMockDb();
    // playbook insert
    mockDb.returning.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    // steps insert (values().returning()はないがvalues()はチェーン)
    mockDb.values.mockReturnThis();
    // steps select
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([MOCK_STEP]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks')
      .set('Authorization', 'Bearer test-key')
      .send({ task: 'バグを修正して' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe('playbook-001');
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });

  it('UT-PB14: taskなしで400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Authorization', 'Bearer test-key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-PB15: task空文字で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Authorization', 'Bearer test-key')
      .send({ task: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-PB16: customTitleとcustomStepsを指定して保存できる', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_PLAYBOOK, title: 'カスタムタイトル' }]);
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([MOCK_STEP]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks')
      .set('Authorization', 'Bearer test-key')
      .send({
        task: 'バグを修正して',
        title: 'カスタムタイトル',
        steps: [{ order: 1, label: 'ステップ1', instruction: '指示内容' }],
      });

    expect(res.status).toBe(201);
  });
});

// ──────────────────────────────────────────────────────────────
// PUT /api/playbooks/:id
// ──────────────────────────────────────────────────────────────
describe('PUT /api/playbooks/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB17: 正常更新で200とデータを返す', async () => {
    const mockDb = buildMockDb();
    // existing playbook
    mockDb.where.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    // title update (returning不要)
    mockDb.returning.mockResolvedValueOnce([]);
    // steps delete
    mockDb.returning.mockResolvedValueOnce([]);
    // steps insert
    mockDb.values.mockReturnThis();
    // updated steps select
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([MOCK_STEP]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .put('/api/playbooks/playbook-001')
      .set('Authorization', 'Bearer test-key')
      .send({
        title: '更新済みタイトル',
        steps: [{ order: 1, label: '更新ステップ', instruction: '更新指示' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('UT-PB18: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .put('/api/playbooks/nonexistent-id')
      .set('Authorization', 'Bearer test-key')
      .send({ title: '新しいタイトル' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-PB19: stepsが空配列の場合はステップを全削除して200', async () => {
    const mockDb = buildMockDb();
    // existing playbook
    mockDb.where
      .mockResolvedValueOnce([MOCK_PLAYBOOK])
      // delete steps where
      .mockResolvedValueOnce([])
      // updatedSteps select where
      .mockReturnValueOnce({
        orderBy: vi.fn().mockResolvedValue([]),
      });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .put('/api/playbooks/playbook-001')
      .set('Authorization', 'Bearer test-key')
      .send({ steps: [] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.steps)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/playbooks/:id/run
// ──────────────────────────────────────────────────────────────
describe('POST /api/playbooks/:id/run', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB20: 正常実行でjobを201で返す', async () => {
    const mockDb = buildMockDb();
    // playbook取得
    mockDb.where.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    // steps取得
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([MOCK_STEP, { ...MOCK_STEP, order: 2 }, { ...MOCK_STEP, order: 3 }]),
    });
    // job insert
    mockDb.returning.mockResolvedValueOnce([MOCK_JOB]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/playbook-001/run')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('job-001');
    expect(res.body.data.status).toBe('running');
  });

  it('UT-PB21: 存在しないplaybookで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/nonexistent-id/run')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('UT-PB22: ステップが0件の場合は400 no_steps', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/playbook-001/run')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_steps');
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/playbooks/jobs/:jobId
// ──────────────────────────────────────────────────────────────
describe('GET /api/playbooks/jobs/:jobId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB23: 存在するjobIdで200とjobデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([MOCK_JOB]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/playbooks/jobs/job-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('job-001');
  });

  it('UT-PB24: 存在しないjobIdで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/playbooks/jobs/nonexistent-job')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/playbooks/jobs/:jobId/step-complete
// ──────────────────────────────────────────────────────────────
describe('POST /api/playbooks/jobs/:jobId/step-complete', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB25: 全ステップ完了時はcompleted返す', async () => {
    const mockDb = buildMockDb();
    const completedJob = { ...MOCK_JOB, total_steps: 3 };
    mockDb.where.mockResolvedValueOnce([completedJob]);
    // update
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/jobs/job-001/step-complete')
      .set('Authorization', 'Bearer test-key')
      .send({ step: 3 }); // step 3 完了 → nextStep=4 > total_steps=3

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('UT-PB26: 次のステップがある場合はrunning返す', async () => {
    const mockDb = buildMockDb();
    const runningJob = { ...MOCK_JOB, total_steps: 3, playbook_id: 'playbook-001' };
    mockDb.where.mockResolvedValueOnce([runningJob]);
    // steps取得
    mockDb.where.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValue([
        MOCK_STEP,
        { ...MOCK_STEP, order: 2, instruction: 'step2 instruction' },
        { ...MOCK_STEP, order: 3, instruction: 'step3 instruction' },
      ]),
    });
    // job update
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/jobs/job-001/step-complete')
      .set('Authorization', 'Bearer test-key')
      .send({ step: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.current_step).toBe(2);
  });

  it('UT-PB27: 存在しないjobIdで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/jobs/nonexistent-job/step-complete')
      .set('Authorization', 'Bearer test-key')
      .send({ step: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

// ──────────────────────────────────────────────────────────────
// POST /api/playbooks/jobs/:jobId/error
// ──────────────────────────────────────────────────────────────
describe('POST /api/playbooks/jobs/:jobId/error', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB28: エラー通知でstatus=errorを200で返す', async () => {
    const mockDb = buildMockDb();
    // update はset().where()
    mockDb.where.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/playbooks/jobs/job-001/error')
      .set('Authorization', 'Bearer test-key')
      .send({ step: 2, error: 'Something went wrong' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('error');
  });
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/playbooks/:id
// ──────────────────────────────────────────────────────────────
describe('DELETE /api/playbooks/:id', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-PB29: 正常削除で200とデータを返す', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([MOCK_PLAYBOOK]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/playbooks/playbook-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('playbook-001');
  });

  it('UT-PB30: 存在しないidで404 not_found', async () => {
    const mockDb = buildMockDb();
    mockDb.returning.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/playbooks/nonexistent-id')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
