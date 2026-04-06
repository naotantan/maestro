/**
 * ホワイトボックステスト: /api/activity
 * activity.ts の entity_name 解決ロジックを網羅する
 *
 * activity.ts の DB アクセスパターン:
 *   1回目: db.select().from(activity_log).where().orderBy().limit() → activity rows
 *   2〜6回目: Promise.all の各クエリ（issues/goals/projects/agents/routines）
 *             各クエリは db.select().from(table).where(inArray(...)) の形式
 *
 * entity_id がある行のみ各テーブルにクエリが飛ぶ。
 * entity_id がない場合は Promise.all に空配列 [] が渡るため DB クエリは発生しない。
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

// --- ヘルパー ---

/** activity_log の 1 行を生成する */
function makeLog(overrides: Partial<{
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}> = {}) {
  return {
    id: 'log-001',
    company_id: 'company-test-001',
    entity_type: 'issue',
    entity_id: 'entity-001',
    action: 'created',
    changes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * activity.ts の DB チェーンをモックするファクトリ。
 *
 * activity.ts のクエリフロー:
 *   1. db.select().from(activity_log).where(...).orderBy(...).limit(n)
 *      → activityRows を解決
 *   2. Promise.all([
 *        issueIds.length > 0 ? db.select(...).from(issues).where(inArray(...)) : [],
 *        goalIds.length > 0  ? db.select(...).from(goals).where(inArray(...))  : [],
 *        projectIds.length > 0 ? db.select(...).from(projects).where(inArray(...)) : [],
 *        agentIds.length > 0  ? db.select(...).from(agents).where(inArray(...))  : [],
 *        routineIds.length > 0 ? db.select(...).from(routines).where(inArray(...)) : [],
 *      ])
 *
 * 重要: entity_id がないテーブルはスキップされ、from() は呼ばれない。
 * そのため "entityResults は Promise.all の固定インデックス" ではなく
 * "実際に from() が呼ばれる順序のインデックス" で管理する。
 *
 * @param activityRows      activity_log から返す行
 * @param entityQueryResults entity テーブルクエリが実際に呼ばれた順序で返す結果の配列。
 *                           例: entity_type='goal' のみの場合、goals の from() が1番目のエンティティクエリになるので
 *                           entityQueryResults = [[goalRow]] を渡す。
 */
function makeDb(
  activityRows: ReturnType<typeof makeLog>[],
  entityQueryResults: unknown[][] = [],
) {
  // from() が呼ばれた回数（1-indexed）
  // 1 = activity_log, 2以降 = entity テーブル
  let fromCallCount = 0;

  const db: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation(() => {
      fromCallCount++;
      return db;
    }),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      // limit() は activity_log クエリの終端 → activityRows を返す
      return Promise.resolve(activityRows);
    }),
    where: vi.fn().mockImplementation(() => {
      if (fromCallCount === 1) {
        // 最初の from は activity_log: where().orderBy().limit() チェーンを継続
        return db;
      }
      // 2 回目以降の from は entity テーブル
      // entity テーブルの where() は Promise.all の要素として await される
      // entityQueryResults[0] が2番目の from、[1] が3番目の from、...
      const entityIdx = fromCallCount - 2;
      return Promise.resolve(entityQueryResults[entityIdx] ?? []);
    }),
  };
  return db;
}

describe('GET /api/activity', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  // WT-ACT-01: ログなし → 200, data=[]
  it('WT-ACT-01: activity が 0 件のとき 200 と空配列を返す', async () => {
    const db = makeDb([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // WT-ACT-02: entity_type='issue' → identifier+title で entity_name が解決される
  it('WT-ACT-02: entity_type=issue のとき identifier+title で entity_name を解決する', async () => {
    const log = makeLog({ entity_type: 'issue', entity_id: 'issue-001' });
    const issueRow = { id: 'issue-001', title: 'バグ修正', identifier: 'ISS-1' };
    // issueIds が非空 → from() が1番目のエンティティクエリとして呼ばれる
    // entityQueryResults[0] = issueRows
    const db = makeDb([log], [[issueRow]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].entity_name).toBe('ISS-1 バグ修正');
  });

  // WT-ACT-03: entity_type='goal' → goal.name で entity_name が解決される
  it('WT-ACT-03: entity_type=goal のとき goal.name で entity_name を解決する', async () => {
    const log = makeLog({ entity_type: 'goal', entity_id: 'goal-001' });
    const goalRow = { id: 'goal-001', name: '売上向上' };
    // issueIds は空 → from(issues) は呼ばれない
    // goalIds が非空 → from(goals) が1番目のエンティティクエリになる
    // entityQueryResults[0] = goalRows
    const db = makeDb([log], [[goalRow]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBe('売上向上');
  });

  // WT-ACT-04: entity_type='project' → project.name で entity_name が解決される
  it('WT-ACT-04: entity_type=project のとき project.name で entity_name を解決する', async () => {
    const log = makeLog({ entity_type: 'project', entity_id: 'proj-001' });
    const projectRow = { id: 'proj-001', name: 'Webリニューアル' };
    // issueIds, goalIds は空 → from(issues/goals) は呼ばれない
    // projectIds が非空 → from(projects) が1番目のエンティティクエリになる
    // entityQueryResults[0] = projectRows
    const db = makeDb([log], [[projectRow]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBe('Webリニューアル');
  });

  // WT-ACT-05: entity_type='agent' → agent.name で entity_name が解決される
  it('WT-ACT-05: entity_type=agent のとき agent.name で entity_name を解決する', async () => {
    const log = makeLog({ entity_type: 'agent', entity_id: 'agent-001' });
    const agentRow = { id: 'agent-001', name: 'CodexAgent' };
    // issueIds, goalIds, projectIds は空 → それらの from() は呼ばれない
    // agentIds が非空 → from(agents) が1番目のエンティティクエリになる
    // entityQueryResults[0] = agentRows
    const db = makeDb([log], [[agentRow]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBe('CodexAgent');
  });

  // WT-ACT-06: entity_type='routine' → routine.name で entity_name が解決される
  it('WT-ACT-06: entity_type=routine のとき routine.name で entity_name を解決する', async () => {
    const log = makeLog({ entity_type: 'routine', entity_id: 'routine-001' });
    const routineRow = { id: 'routine-001', name: '毎日スタンドアップ' };
    // issueIds, goalIds, projectIds, agentIds は空 → それらの from() は呼ばれない
    // routineIds が非空 → from(routines) が1番目のエンティティクエリになる
    // entityQueryResults[0] = routineRows
    const db = makeDb([log], [[routineRow]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBe('毎日スタンドアップ');
  });

  // WT-ACT-07: entity_id=null → entity_name=null になる
  it('WT-ACT-07: entity_id がない行は entity_name=null を返す', async () => {
    const log = makeLog({ entity_type: 'issue', entity_id: null });
    // entity_id が null なので issueIds=[] → from() は一切呼ばれない
    const db = makeDb([log]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBeNull();
  });

  // WT-ACT-08: limit クエリパラメータが効く（max 200）
  it('WT-ACT-08: limit=10 が適用され、limit=9999 は 200 に丸められる', async () => {
    const db = makeDb([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await request(app)
      .get('/api/activity?limit=10')
      .set('Authorization', 'Bearer test-key');

    // db.limit() が 10 で呼ばれることを確認
    expect(db.limit).toHaveBeenCalledWith(10);

    vi.clearAllMocks();
    const db2 = makeDb([]);
    vi.mocked(getDb).mockReturnValue(db2 as unknown as ReturnType<typeof getDb>);

    await request(app)
      .get('/api/activity?limit=9999')
      .set('Authorization', 'Bearer test-key');

    // 9999 は max 200 に丸められる
    expect(db2.limit).toHaveBeenCalledWith(200);
  });

  // WT-ACT-09: changes.entity_name フォールバック
  //   entity_id は存在するが nameMap に登録されない（DBに存在しない）場合、
  //   changes.entity_name を使う
  it('WT-ACT-09: nameMap に解決できなければ changes.entity_name をフォールバックとして使う', async () => {
    const log = makeLog({
      entity_type: 'issue',
      entity_id: 'issue-orphan',
      changes: { entity_name: 'フォールバック名称' },
    });
    // issueIds が非空 → from(issues) が呼ばれるが空配列を返す → nameMap に登録されない
    // → フォールバックが使われる
    const db = makeDb([log], [[]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data[0].entity_name).toBe('フォールバック名称');
  });
});
