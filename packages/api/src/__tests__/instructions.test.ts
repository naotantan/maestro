/**
 * 単体テスト: /api/instructions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: { companyId?: string; userId?: string }, _res: unknown, next: () => void) => {
    req.companyId = 'company-test-001';
    req.userId = 'user-test-001';
    next();
  },
}));
vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const MOCK_ISSUE = {
  id: 'issue-001',
  company_id: 'company-test-001',
  project_id: null,
  identifier: 'COMP-001',
  title: 'バグを修正して',
  description: null,
  status: 'todo',
  created_by: 'user-test-001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_PROJECT = {
  id: 'project-001',
  name: 'maestro',
  description: 'AI agent ops',
};

const MOCK_AGENT = {
  id: 'agent-001',
  name: 'Test Agent',
};

function buildMockDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([MOCK_AGENT]),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_ISSUE]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ max_id: null }]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([MOCK_ISSUE]),
      };
      return cb(tx);
    }),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// POST /api/instructions
// ──────────────────────────────────────────────────────────────
describe('POST /api/instructions', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-I01: バグ修正指示でissueを201で登録する', async () => {
    const mockDb = buildMockDb();
    // projectList取得
    mockDb.where.mockResolvedValueOnce([]);
    // agents取得
    mockDb.limit.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'バグを修正してください' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta.skipped).toBe(false);
  });

  it('UT-I02: textなしで400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('text');
  });

  it('UT-I03: text空文字で400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-I04: 開発指示でない雑談はskipped:trueで200を返す', async () => {
    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: '今日はいい天気ですね' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(res.body.meta.skipped).toBe(true);
    expect(res.body.meta.reason).toBeDefined();
  });

  it('UT-I05: 短い具体的なアクション指示はtodoに分類される', async () => {
    const mockDb = buildMockDb({
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ max_id: null }]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MOCK_ISSUE, status: 'todo' }]),
        };
        return cb(tx);
      }),
    });
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'バグを修正して' });

    expect(res.status).toBe(201);
    expect(res.body.meta.classified_as).toBe('todo');
  });

  it('UT-I06: 長い実装依頼はbacklog(issue)に分類される', async () => {
    const mockDb = buildMockDb({
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ max_id: null }]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MOCK_ISSUE, status: 'backlog' }]),
        };
        return cb(tx);
      }),
    });
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: '認証機能を実装してください。OAuthとJWTを使用して、ログイン・ログアウト・セッション管理を一通り実装してください。' });

    expect(res.status).toBe(201);
    expect(res.body.meta.classified_as).toBe('issue');
  });

  it('UT-I07: プロジェクト名マッチでproject_idが設定される', async () => {
    const mockDb = buildMockDb({
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ max_id: null }]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MOCK_ISSUE, project_id: 'project-001' }]),
        };
        return cb(tx);
      }),
    });
    // projects取得: maestroプロジェクトあり
    mockDb.where.mockResolvedValueOnce([MOCK_PROJECT]);
    // agents取得
    mockDb.limit.mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'maestroのバグを修正して' });

    expect(res.status).toBe(201);
    expect(res.body.meta.project_id).toBe('project-001');
    expect(res.body.meta.project_name).toBe('maestro');
  });

  it('UT-I08: プロジェクトがマッチしない場合はproject_idがnull', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([MOCK_PROJECT]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'データベースの不具合を修正して' });

    expect(res.status).toBe(201);
    expect(res.body.meta.project_id).toBeNull();
  });

  it('UT-I09: 有効なエージェントがいる場合はagent_handoffsが生成され名前が返る', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]); // projects
    // agents limit → agent存在
    mockDb.limit.mockResolvedValueOnce([MOCK_AGENT]);
    // agent_handoffs insert → returning
    mockDb.returning
      .mockResolvedValueOnce([MOCK_ISSUE]) // transaction内のissue insert
      .mockResolvedValueOnce([]); // handoff insert
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'バグを修正してください' });

    expect(res.status).toBe(201);
    expect(res.body.meta.handoff_agent).toBe('Test Agent');
  });

  it('UT-I10: エージェントが0件の場合はhandoff_agentがnull', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents (0件)
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'バグを修正してください' });

    expect(res.status).toBe(201);
    expect(res.body.meta.handoff_agent).toBeNull();
  });

  it('UT-I11: identifierが既存の最大番号+1で採番される', async () => {
    const mockDb = buildMockDb({
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ max_id: 'COMP-005' }]), // 既存最大=5
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MOCK_ISSUE, identifier: 'COMP-006' }]),
        };
        return cb(tx);
      }),
    });
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'バグを修正してください' });

    expect(res.status).toBe(201);
    expect(res.body.data.identifier).toBe('COMP-006');
  });

  it('UT-I12: テスト関連の開発キーワードも登録される', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'テストを追加してカバレッジを上げる' });

    expect(res.status).toBe(201);
    expect(res.body.meta.skipped).toBe(false);
  });

  it('UT-I13: API実装指示も登録される', async () => {
    const mockDb = buildMockDb();
    mockDb.where.mockResolvedValueOnce([]); // projects
    mockDb.limit.mockResolvedValueOnce([]); // agents
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/instructions')
      .set('Authorization', 'Bearer test-key')
      .send({ text: 'APIエンドポイントを実装してください' });

    expect(res.status).toBe(201);
    expect(res.body.meta.skipped).toBe(false);
  });
});
