import { Router, type Router as RouterType } from 'express';
import { getDb } from '@maestro/db';
import { sql } from 'drizzle-orm';

export const healthRouter: RouterType = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});
