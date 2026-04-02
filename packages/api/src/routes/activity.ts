import { Router, type Router as RouterType } from 'express';
import { getDb, activity_log } from '@company/db';
import { eq, desc } from 'drizzle-orm';

export const activityRouter: RouterType = Router();

activityRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);
    const db = getDb();
    const rows = await db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, req.companyId!))
      .orderBy(desc(activity_log.created_at))
      .limit(limit);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
