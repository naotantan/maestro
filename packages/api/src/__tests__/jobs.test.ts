/**
 * ホワイトボックステスト: /api/jobs
 * jobs.ts の全ルートを検証する
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

const MOCK_JOB = {
  id: 'job-001',
  company_id: 'company-test-001',
  prompt: 'テストプロンプト',
  status: 'pending',
  result: null,
  error_message: null,
  started_at: null,
  completed_at: null,
  created_at: new Date().toISOString(),
};

/**
 * DB モックを生成する。
 *
 * jobs.ts のクエリチェーンは以下の形式:
 *   GET /:        select().from().where().orderBy().limit()  → rows
 *   POST /:       insert().values().returning()              → [row]
 *   GET /pending: select().from().where().orderBy().limit()  → rows
 *   PATCH /:id:   update().set().where().returning()         → [row]
 *   DELETE /:id:  delete().where()                           → void
 *
 * すべてのチェーンが同一オブジェクトの this を返すシンプルな形にする。
 * returning() と limit() のみ Promise を返す（クエリの終端）。
 *
 * @param limitResult  .limit() が解決する値（デフォルト []）
 * @param returningResult  .returning() が解決する値（デフォルト []）
 */
function makeDb(
  limitResult: unknown[] = [],
  returningResult: unknown[] = [],
) {
  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(limitResult),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returningResult),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return db;
}

describe('GET /api/jobs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-JOBS-01: 一覧取得 → 200 + data 配列
  it('WT-JOBS-01: 200 と data 配列を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_JOB]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('job-001');
  });

  // WT-JOBS-02: limit パラメータが効く（max 100 制限）
  it('WT-JOBS-02: limit=5 が反映され、limit=999 は 100 に丸められる', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    // limit=5 → .limit(5) が呼ばれる
    await request(app)
      .get('/api/jobs?limit=5')
      .set('Authorization', 'Bearer test-key');

    expect(db.limit).toHaveBeenCalledWith(5);

    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    // limit=999 → max 100 に丸める
    await request(app)
      .get('/api/jobs?limit=999')
      .set('Authorization', 'Bearer test-key');

    expect(db.limit).toHaveBeenCalledWith(100);
  });
});

describe('POST /api/jobs', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-JOBS-03: prompt 欠落 → 400 validation_failed
  it('WT-JOBS-03: prompt がないと 400 validation_failed', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer test-key')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // WT-JOBS-04: prompt が空白のみ → 400
  it('WT-JOBS-04: prompt が空白のみのとき 400 を返す', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer test-key')
      .send({ prompt: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  // WT-JOBS-05: 正常リクエスト → 201 + data
  it('WT-JOBS-05: 正常リクエストで 201 と作成されたジョブを返す', async () => {
    const created = { ...MOCK_JOB, prompt: 'テストプロンプト' };
    const db = makeDb();
    db.returning.mockResolvedValue([created]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer test-key')
      .send({ prompt: 'テストプロンプト' });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe('job-001');
  });
});

describe('GET /api/jobs/pending', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-JOBS-06: pending ジョブあり → 200 + data=job
  it('WT-JOBS-06: pending ジョブがあれば 200 と最古の 1 件を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([MOCK_JOB]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/jobs/pending')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.id).toBe('job-001');
  });

  // WT-JOBS-07: pending ジョブなし → 200 + data=null
  it('WT-JOBS-07: pending ジョブがなければ 200 と data=null を返す', async () => {
    const db = makeDb();
    db.limit.mockResolvedValue([]); // 0 件
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/jobs/pending')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('PATCH /api/jobs/:jobId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-JOBS-08: status='running' → started_at が設定される
  it('WT-JOBS-08: status=running で started_at が設定されたレコードを返す', async () => {
    const updated = { ...MOCK_JOB, status: 'running', started_at: new Date().toISOString() };
    const db = makeDb();
    db.returning.mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/jobs/job-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'running' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.started_at).not.toBeNull();

    // set() に started_at が含まれていることを確認
    const setCall = db.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall).toHaveProperty('started_at');
  });

  // WT-JOBS-09: status='done' → completed_at が設定される
  it('WT-JOBS-09: status=done で completed_at が設定されたレコードを返す', async () => {
    const updated = { ...MOCK_JOB, status: 'done', completed_at: new Date().toISOString() };
    const db = makeDb();
    db.returning.mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/jobs/job-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'done', result: '完了' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');
    expect(res.body.data.completed_at).not.toBeNull();

    const setCall = db.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall).toHaveProperty('completed_at');
  });

  // WT-JOBS-10: status='error' → error_message が設定される
  it('WT-JOBS-10: status=error で error_message が設定されたレコードを返す', async () => {
    const updated = {
      ...MOCK_JOB,
      status: 'error',
      error_message: '処理に失敗しました',
      completed_at: new Date().toISOString(),
    };
    const db = makeDb();
    db.returning.mockResolvedValue([updated]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/jobs/job-001')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'error', error_message: '処理に失敗しました' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('error');
    expect(res.body.data.error_message).toBe('処理に失敗しました');

    const setCall = db.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall).toHaveProperty('completed_at');
    expect(setCall.error_message).toBe('処理に失敗しました');
  });

  // WT-JOBS-11: 存在しないジョブ → 404
  it('WT-JOBS-11: 存在しないジョブは 404 を返す', async () => {
    const db = makeDb();
    db.returning.mockResolvedValue([]); // 0 件 = 見つからない
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/jobs/nonexistent-job')
      .set('Authorization', 'Bearer test-key')
      .send({ status: 'running' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

describe('DELETE /api/jobs/:jobId', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-JOBS-12: 正常削除 → 200 + success:true
  it('WT-JOBS-12: 正常削除で 200 と success:true を返す', async () => {
    const db = makeDb();
    // delete チェーン: .delete().where() は void/undefined で OK
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .delete('/api/jobs/job-001')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
