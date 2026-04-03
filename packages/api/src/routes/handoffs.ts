import { Router, type Router as RouterType } from 'express';
import { getDb, agent_handoffs, agents } from '@company/db';
import { eq, and } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const handoffsRouter: RouterType = Router();

const VALID_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

// 自テナント内のエージェントIDか確認するヘルパー
async function findOwnedAgent(companyId: string, agentId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: agents.id, type: agents.type, config: agents.config, enabled: agents.enabled })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

// GET /api/handoffs
handoffsRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

    const db = getDb();

    // status フィルタあり/なしで条件を切り替え
    const whereClause = (statusFilter && VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number]))
      ? and(eq(agent_handoffs.company_id, req.companyId!), eq(agent_handoffs.status, statusFilter))
      : eq(agent_handoffs.company_id, req.companyId!);

    const rows = await db
      .select()
      .from(agent_handoffs)
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/handoffs — 引き継ぎ登録
handoffsRouter.post('/', async (req, res, next) => {
  try {
    const { from_agent_id, to_agent_id, prompt, issue_id } = req.body as {
      from_agent_id?: string;
      to_agent_id?: string;
      prompt?: string;
      issue_id?: string;
    };

    // 必須チェック
    if (!from_agent_id || !to_agent_id || !prompt) {
      res.status(400).json({ error: 'validation_failed', message: 'from_agent_id, to_agent_id, prompt は必須です' });
      return;
    }

    // 自己引き継ぎ禁止
    if (from_agent_id === to_agent_id) {
      res.status(400).json({ error: 'validation_failed', message: 'from_agent_id と to_agent_id に同じエージェントは指定できません' });
      return;
    }

    // テナント所有確認
    const fromAgent = await findOwnedAgent(req.companyId!, from_agent_id);
    if (!fromAgent) {
      res.status(400).json({ error: 'validation_failed', message: 'from_agent_id が見つからないか、アクセス権がありません' });
      return;
    }
    const toAgent = await findOwnedAgent(req.companyId!, to_agent_id);
    if (!toAgent) {
      res.status(400).json({ error: 'validation_failed', message: 'to_agent_id が見つからないか、アクセス権がありません' });
      return;
    }

    const db = getDb();
    const [created] = await db.insert(agent_handoffs).values({
      company_id: req.companyId!,
      from_agent_id,
      to_agent_id,
      issue_id: issue_id ?? null,
      status: 'pending',
      prompt: sanitizeString(prompt),
    }).returning();

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// GET /api/handoffs/:id
handoffsRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(agent_handoffs)
      .where(and(eq(agent_handoffs.id, req.params.id), eq(agent_handoffs.company_id, req.companyId!)))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: 'not_found', message: '引き継ぎが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/handoffs/:id/cancel — pending のみキャンセル可
handoffsRouter.patch('/:id/cancel', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(agent_handoffs)
      .where(and(eq(agent_handoffs.id, req.params.id), eq(agent_handoffs.company_id, req.companyId!)))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: 'not_found', message: '引き継ぎが見つかりません' });
      return;
    }
    if (rows[0].status !== 'pending') {
      res.status(409).json({ error: 'invalid_state', message: `pending 状態の引き継ぎのみキャンセルできます（現在: ${rows[0].status}）` });
      return;
    }

    const [updated] = await db
      .update(agent_handoffs)
      .set({ status: 'cancelled', completed_at: new Date() })
      .where(eq(agent_handoffs.id, req.params.id))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
