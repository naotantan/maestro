import { Router, type Router as RouterType } from 'express';
import { getDb, cost_events, budget_policies, agents } from '@company/db';
import { eq, gte, desc, and } from 'drizzle-orm';

export const costsRouter: RouterType = Router();

// GET /api/costs — コスト集計
costsRouter.get('/', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query as { period?: string };
    const db = getDb();
    // 直近30日のコストイベント（company_id でフィルタリング）
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const events = await db
      .select({
        id: cost_events.id,
        agent_id: cost_events.agent_id,
        model: cost_events.model,
        input_tokens: cost_events.input_tokens,
        output_tokens: cost_events.output_tokens,
        cost_usd: cost_events.cost_usd,
        created_at: cost_events.created_at,
      })
      .from(cost_events)
      .innerJoin(agents, eq(cost_events.agent_id, agents.id))
      .where(and(
        gte(cost_events.created_at, since),
        eq(agents.company_id, req.companyId!)
      ))
      .orderBy(desc(cost_events.created_at))
      .limit(200);
    res.json({ data: events, period });
  } catch (err) {
    next(err);
  }
});

// POST /api/costs — コストイベント記録
costsRouter.post('/', async (req, res, next) => {
  try {
    const { agent_id, model, input_tokens, output_tokens, cost_usd } = req.body as {
      agent_id?: string;
      model?: string;
      input_tokens?: number;
      output_tokens?: number;
      cost_usd?: number;
    };
    if (!agent_id || !model || cost_usd === undefined) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'agent_id・model・cost_usd は必須です',
      });
      return;
    }
    const db = getDb();
    // agent_id が自社エージェントか確認
    const agent = await db.select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agent_id), eq(agents.company_id, req.companyId!)))
      .limit(1);
    if (!agent.length) {
      res.status(404).json({ error: 'not_found', message: 'Agentが見つかりません' });
      return;
    }
    const event = await db.insert(cost_events).values({
      agent_id,
      model,
      input_tokens: input_tokens ?? 0,
      output_tokens: output_tokens ?? 0,
      cost_usd: String(cost_usd),
    }).returning();
    res.status(201).json({ data: event[0] });
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
