import { Router, type Router as RouterType } from 'express';
import { getDb, agent_handoffs } from '@maestro/db';
import { eq, and } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';
import { findOwnedAgentWithDetails } from '../utils/ownership';

export const handoffsRouter: RouterType = Router();

const VALID_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

// GET /api/handoffs
handoffsRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const chainIdFilter = typeof req.query.chain_id === 'string' ? req.query.chain_id : undefined;

    const db = getDb();

    // フィルタ条件を構築（status / chain_id を組み合わせ）
    const conditions = [eq(agent_handoffs.company_id, req.companyId!)];
    if (statusFilter && VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
      conditions.push(eq(agent_handoffs.status, statusFilter));
    }
    if (chainIdFilter) {
      conditions.push(eq(agent_handoffs.chain_id, chainIdFilter));
    }

    const rows = await db
      .select()
      .from(agent_handoffs)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/handoffs — 引き継ぎ登録（チェーン対応）
handoffsRouter.post('/', async (req, res, next) => {
  try {
    const { from_agent_id, to_agent_id, prompt, issue_id, next_agent_id, next_prompt } = req.body as {
      from_agent_id?: string;
      to_agent_id?: string;
      prompt?: string;
      issue_id?: string;
      next_agent_id?: string;   // チェーン: 次の引き継ぎ先
      next_prompt?: string;     // チェーン: 次ステップのプロンプト
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

    const db = getDb();

    // テナント所有確認
    const fromAgent = await findOwnedAgentWithDetails(db, req.companyId!, from_agent_id);
    if (!fromAgent) {
      res.status(400).json({ error: 'validation_failed', message: 'from_agent_id が見つからないか、アクセス権がありません' });
      return;
    }
    const toAgent = await findOwnedAgentWithDetails(db, req.companyId!, to_agent_id);
    if (!toAgent) {
      res.status(400).json({ error: 'validation_failed', message: 'to_agent_id が見つからないか、アクセス権がありません' });
      return;
    }

    // next_agent_id が指定されている場合はテナント確認
    if (next_agent_id) {
      const nextAgent = await findOwnedAgentWithDetails(db, req.companyId!, next_agent_id);
      if (!nextAgent) {
        res.status(400).json({ error: 'validation_failed', message: 'next_agent_id が見つからないか、アクセス権がありません' });
        return;
      }
    }
    const [created] = await db.insert(agent_handoffs).values({
      company_id: req.companyId!,
      from_agent_id,
      to_agent_id,
      issue_id: issue_id ?? null,
      status: 'pending',
      prompt: sanitizeString(prompt),
      next_agent_id: next_agent_id ?? null,
      next_prompt: next_prompt ? sanitizeString(next_prompt) : null,
    }).returning();

    // chain_id = 先頭の handoff id 自身（後続は engine がセット）
    await db.update(agent_handoffs)
      .set({ chain_id: created.id })
      .where(eq(agent_handoffs.id, created.id));

    res.status(201).json({ data: { ...created, chain_id: created.id } });
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
      .where(and(eq(agent_handoffs.id, req.params.id), eq(agent_handoffs.company_id, req.companyId!)))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
