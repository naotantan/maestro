/**
 * ホワイトボックステスト: /api/analytics
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

function buildCountChain(cnt: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ cnt }]),
    }),
  };
}

// ──────────────────────────────────────────────────────────────
// GET /api/analytics/skills
// ──────────────────────────────────────────────────────────────
describe('GET /api/analytics/skills', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A01: 200とスキル一覧を返す', async () => {
    const mockPlugins = [
      { id: 'p-001', name: 'git-helper', category: 'dev', usage_count: 10, last_used_at: null, enabled: true },
    ];
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockPlugins),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/skills')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('git-helper');
    expect(res.body.meta.top).toBe(10);
  });

  it('UT-A02: top=5 クエリが有効', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/skills?top=5')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.top).toBe(5);
  });

  it('UT-A03: top=100 超は50にクランプ', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/skills?top=200')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.top).toBe(50);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/analytics/sessions
// ──────────────────────────────────────────────────────────────
describe('GET /api/analytics/sessions', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A04: 200とセッション統計を返す', async () => {
    const mockSessions = [
      {
        id: 's-001',
        headline: 'セッション1',
        session_ended_at: new Date().toISOString(),
        changed_files: ['file1.ts', 'file2.ts'],
        agent_id: 'agent-001',
      },
    ];
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSessions),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/sessions')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total_sessions).toBe(1);
    expect(res.body.meta.total_files_changed).toBe(2);
  });

  it('UT-A05: period=7d が受け付けられる', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/sessions?period=7d')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.period).toBe('7d');
  });

  it('UT-A06: period=90d が受け付けられる', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/sessions?period=90d')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.period).toBe('90d');
  });

  it('UT-A07: changed_files が配列でない場合ファイル数 0', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { id: 's-001', headline: '', session_ended_at: new Date(), changed_files: null, agent_id: 'a-001' },
            ]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/sessions')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.meta.total_files_changed).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/analytics/overview
// ──────────────────────────────────────────────────────────────
describe('GET /api/analytics/overview', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('UT-A08: 200と4つのメトリクスを返す', async () => {
    // Promise.all で4クエリが並行実行される
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildCountChain(3))  // active_agents
      .mockReturnValueOnce(buildCountChain(7))  // open_issues
      .mockReturnValueOnce(buildCountChain(2))  // today_sessions
      .mockReturnValueOnce(buildCountChain(10)); // total_skills

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.active_agents).toBe(3);
    expect(res.body.data.open_issues).toBe(7);
    expect(res.body.data.today_sessions).toBe(2);
    expect(res.body.data.total_skills).toBe(10);
  });

  it('UT-A09: DB が空の場合 0 を返す', async () => {
    const selectFn = vi.fn()
      .mockReturnValueOnce(buildCountChain(0))
      .mockReturnValueOnce(buildCountChain(0))
      .mockReturnValueOnce(buildCountChain(0))
      .mockReturnValueOnce(buildCountChain(0));

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', 'Bearer test-key');

    expect(res.status).toBe(200);
    expect(res.body.data.active_agents).toBe(0);
    expect(res.body.data.open_issues).toBe(0);
  });
});
