/**
 * ホワイトボックステスト: /api/search
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: unknown, _res: unknown, next: () => void) => {
    (req as Record<string, unknown>).companyId = 'company-test-001';
    next();
  },
}));

vi.mock('../middleware/activity-logger.js', () => ({
  activityLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const MOCK_ISSUE = {
  id: 'issue-001',
  identifier: 'ISSUE-1',
  title: 'テストIssue',
  status: 'open',
  priority: 'high',
  created_at: new Date().toISOString(),
};

const MOCK_SESSION = {
  id: 'session-001',
  headline: 'テストセッション',
  summary: 'セッションの概要',
  session_ended_at: new Date().toISOString(),
};

const MOCK_PLUGIN = {
  id: 'plugin-001',
  name: 'git-helper',
  description: 'Git helper plugin',
  category: 'dev',
  enabled: true,
};

function buildSelectChain(resolvedValue: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(resolvedValue),
        }),
      }),
    }),
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/search
// ──────────────────────────────────────────────────────────────
describe('GET /api/search', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-S01: q なしで400 validation_failed', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-S02: 空文字 q で400', async () => {
    const res = await request(app)
      .get('/api/search?q=')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-S03: 有効な q でissues/sessions/pluginsを横断検索して200', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildSelectChain([MOCK_ISSUE]))   // issues
      .mockReturnValueOnce(buildSelectChain([MOCK_SESSION])) // sessions
      .mockReturnValueOnce(buildSelectChain([MOCK_PLUGIN])); // plugins

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/search')
      .query({ q: 'テスト' })
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.issues).toBeDefined();
    expect(res.body.data.sessions).toBeDefined();
    expect(res.body.data.plugins).toBeDefined();
    expect(res.body.meta.query).toBe('テスト');
  });

  it('UT-S04: 各エンティティの件数が正しく返る', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildSelectChain([MOCK_ISSUE, MOCK_ISSUE]))  // 2 issues
      .mockReturnValueOnce(buildSelectChain([]))                         // 0 sessions
      .mockReturnValueOnce(buildSelectChain([MOCK_PLUGIN]));             // 1 plugin

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/search?q=keyword')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.issues).toHaveLength(2);
    expect(res.body.data.sessions).toHaveLength(0);
    expect(res.body.data.plugins).toHaveLength(1);
  });

  it('UT-S05: 空白のみの q で400', async () => {
    const res = await request(app)
      .get('/api/search?q=   ')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('UT-S06: 特殊文字を含む q で正常に処理される', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]));

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/search?q=test%27s%20query')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.query).toBe("test's query");
  });

  it('UT-S07: 結果がなくても200で空配列を返す', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]));

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/search')
      .query({ q: '存在しないキーワード' })
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.issues).toHaveLength(0);
    expect(res.body.data.sessions).toHaveLength(0);
    expect(res.body.data.plugins).toHaveLength(0);
  });
});
