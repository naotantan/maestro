import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

// req.companyId を注入するためのミドルウェアモック
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: unknown, _res: unknown, next: () => void) => {
    (req as Record<string, unknown>).companyId = 'company-test-id';
    next();
  },
}));

describe('GET /api/companies', () => {
  it('should return 404 if company not found', async () => {
    const { getDb } = await import('@company/db');
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const app = createApp();
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', 'Bearer comp_live_test');
    expect(res.status).toBe(404);
  });

  it('should return company data if found', async () => {
    const { getDb } = await import('@company/db');
    const mockCompany = { id: 'company-test-id', name: 'Test Corp', createdAt: new Date() };
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockCompany]),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const app = createApp();
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', 'Bearer comp_live_test');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test Corp');
  });
});
