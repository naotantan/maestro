import { Router, type Router as RouterType } from 'express';
import { getDb, cost_events, budget_policies, agents } from '@maestro/db';
import { eq, gte, desc, and } from 'drizzle-orm';

export const costsRouter: RouterType = Router();

function parseBudgetDecimal(value: unknown, scale: number): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed.toFixed(scale);
}

function normalizeAlertThreshold(value: unknown): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = parsed > 1 ? parsed / 100 : parsed;
  if (normalized < 0 || normalized > 1) {
    return null;
  }

  return normalized.toFixed(2);
}

// GET /api/costs — コスト集計
costsRouter.get('/', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query as { period?: string };

    // period enum チェック
    const VALID_PERIODS = ['day', 'week', 'month', 'year'] as const;
    if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number])) {
      res.status(400).json({ error: 'validation_failed', message: `period は ${VALID_PERIODS.join(', ')} のいずれかです` });
      return;
    }

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

    // cost_usd の数値検証
    const normalizedCostUsd = parseBudgetDecimal(cost_usd, 6); // 6桁精度
    if (normalizedCostUsd === null) {
      res.status(400).json({ error: 'validation_failed', message: 'cost_usd が不正な値です' });
      return;
    }

    const event = await db.insert(cost_events).values({
      agent_id,
      model,
      input_tokens: input_tokens ?? 0,
      output_tokens: output_tokens ?? 0,
      cost_usd: normalizedCostUsd,
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

    const normalizedLimit = parseBudgetDecimal(limit_amount_usd, 2);
    if (!normalizedLimit || Number(normalizedLimit) <= 0) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'limit_amount_usd は 0 より大きい数値である必要があります',
      });
      return;
    }

    const normalizedThreshold = alert_threshold === undefined
      ? undefined
      : normalizeAlertThreshold(alert_threshold);

    if (alert_threshold !== undefined && normalizedThreshold === null) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'alert_threshold は 0.00〜1.00 または 0〜100 の範囲で指定してください',
      });
      return;
    }

    const db = getDb();
    const policy = await db
      .insert(budget_policies)
      .values({
        company_id: req.companyId!,
        limit_amount_usd: normalizedLimit,
        period,
        ...(normalizedThreshold !== undefined ? { alert_threshold: normalizedThreshold } : {}),
      })
      .returning();
    res.status(201).json({ data: policy[0] });
  } catch (err) {
    next(err);
  }
});
