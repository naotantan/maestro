import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@company/db';

describe('Auth Middleware', () => {
  const app = createApp();

  it('should return 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(401);
  });

  it('should return 401 when invalid Bearer token format', async () => {
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', 'InvalidToken');
    expect(res.status).toBe(401);
  });

  it('should return 401 when API key not found in DB', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', 'Bearer comp_live_unknownkey');
    expect(res.status).toBe(401);
  });
});
