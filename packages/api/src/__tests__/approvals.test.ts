/**
 * ホワイトボックステスト: /api/approvals
 * approvals.ts の全分岐をカバーする
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@maestro/db';
import { findOwnedApproval } from '../utils/ownership.js';

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
  findOwnedApproval: vi.fn(),
}));

const MOCK_APPROVAL = {
  id: 'approval-001',
  issue_id: 'issue-001',
  approver_id: 'user-001',
  status: 'pending',
  created_at: new Date().toISOString(),
  decided_at: null,
};

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([MOCK_APPROVAL]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// GET /api/approvals
// -----------------------------------------------------------------------
describe('GET /api/approvals', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('status フィルタなし → 200 と data 配列', async () => {
    const db = makeDb();
    // select チェーン末尾: .orderBy().limit() → approvals 配列
    db.limit = vi.fn().mockResolvedValue([MOCK_APPROVAL]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/approvals');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('approval-001');
  });

  it('?status=pending でフィルタあり → 200 と data 配列', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([MOCK_APPROVAL]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/approvals?status=pending');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // where が status フィルタ付きで呼ばれていること（呼び出し自体は成功）
    expect(db.where).toHaveBeenCalled();
  });

  it('承認レコードが 0 件でも 200 と空配列', async () => {
    const db = makeDb();
    db.limit = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app).get('/api/approvals');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// POST /api/approvals/:approvalId/approve
// -----------------------------------------------------------------------
describe('POST /api/approvals/:approvalId/approve', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('存在しない approvalId → 404', async () => {
    vi.mocked(findOwnedApproval).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/approvals/nonexistent/approve');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(res.body.message).toMatch(/承認レコード/);
  });

  it('正常な承認 → 200, status=approved', async () => {
    vi.mocked(findOwnedApproval).mockResolvedValue({ id: 'approval-001', issue_id: 'issue-001' });
    const approvedRecord = { ...MOCK_APPROVAL, status: 'approved', decided_at: new Date().toISOString() };
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([approvedRecord]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/approvals/approval-001/approve');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.decided_at).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// POST /api/approvals/:approvalId/reject
// -----------------------------------------------------------------------
describe('POST /api/approvals/:approvalId/reject', () => {
  const app = createApp();

  beforeEach(() => { vi.clearAllMocks(); });

  it('存在しない approvalId → 404', async () => {
    vi.mocked(findOwnedApproval).mockResolvedValue(null);
    const db = makeDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/approvals/nonexistent/reject');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(res.body.message).toMatch(/承認レコード/);
  });

  it('正常な却下 → 200, status=rejected', async () => {
    vi.mocked(findOwnedApproval).mockResolvedValue({ id: 'approval-001', issue_id: 'issue-001' });
    const rejectedRecord = { ...MOCK_APPROVAL, status: 'rejected', decided_at: new Date().toISOString() };
    const db = makeDb();
    db.returning = vi.fn().mockResolvedValue([rejectedRecord]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .post('/api/approvals/approval-001/reject');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.decided_at).toBeDefined();
  });
});
