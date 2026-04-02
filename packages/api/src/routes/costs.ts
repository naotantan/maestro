import { Router, type Router as RouterType } from 'express';
import { getDb, cost_events, budget_policies } from '@company/db';
import { eq, gte, desc } from 'drizzle-orm';

export const costsRouter: RouterType = Router();

// GET /api/costs — コスト集計
costsRouter.get('/', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query as { period?: string };
    const db = getDb();
    // 直近30日のコストイベント
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const events = await db
      .select()
      .from(cost_events)
      .where(gte(cost_events.created_at, since))
      .orderBy(desc(cost_events.created_at))
      .limit(200);
    res.json({ data: events, period });
  } catch (err) {
    next(err);
  }
});

// GET /api/costs/budget — 予算ポリシー
costsRouter.get('/budget', async (req, res, next) => {
  try {
    const db = getDb();
    const policies = await db
      .select()
      .from(budget_policies)
      .where(eq(budget_policies.company_id, req.companyId!));
    res.json({ data: policies });
  } catch (err) {
    next(err);
  }
});

// POST /api/costs/budget
costsRouter.post('/budget', async (req, res, next) => {
  try {
    const { limit_amount_usd, period, alert_threshold } = req.body as {
      limit_amount_usd?: number;
      period?: string;
      alert_threshold?: number;
    };
    if (!limit_amount_usd) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'limit_amount_usd は必須です',
      });
      return;
    }
    const db = getDb();
    const policy = await db
      .insert(budget_policies)
      .values({
        company_id: req.companyId!,
        limit_amount_usd: String(limit_amount_usd),
        period,
        ...(alert_threshold && { alert_threshold: String(alert_threshold) }),
      })
      .returning();
    res.status(201).json({ data: policy[0] });
  } catch (err) {
    next(err);
  }
});
