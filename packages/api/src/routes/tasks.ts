import { Router, type Router as RouterType } from 'express';
import { getDb, agents, agent_task_sessions } from '@maestro/db';
import { eq, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { sanitizeString, sanitizePagination } from '../middleware/validate';
import type { AgentType } from '@maestro/shared';

// @maestro/adapters は ESM のため dynamic import
// AdapterConfig は packages/adapters/src/base.ts と同一形状
type AdapterConfig = { apiKey?: string; baseUrl?: string; model?: string; timeout?: number };

export const tasksRouter: RouterType = Router();

// POST /api/tasks — エージェントにタスクを直接実行させる
tasksRouter.post('/', async (req, res, next) => {
  try {
    const { agent_id, prompt, context } = req.body as {
      agent_id?: string;
      prompt?: string;
      context?: string;
    };

    if (!agent_id || !prompt) {
      res.status(400).json({ error: 'validation_failed', message: 'agent_id と prompt は必須です' });
      return;
    }

    const db = getDb();

    // テナント所有・存在確認
    const agentRows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agent_id), eq(agents.company_id, req.companyId!)))
      .limit(1);

    if (!agentRows[0]) {
      res.status(400).json({ error: 'validation_failed', message: 'agent_id が見つからないか、アクセス権がありません' });
      return;
    }

    const agent = agentRows[0];

    if (!agent.enabled) {
      res.status(400).json({ error: 'agent_disabled', message: 'エージェントが無効です。有効化してから実行してください' });
      return;
    }

    // タスクセッション開始記録
    const taskId = randomUUID();
    const startedAt = new Date();
    await db.insert(agent_task_sessions).values({
      id: taskId,
      agent_id,
      task_id: taskId,
      started_at: startedAt,
      status: 'running',
    });

    try {
      // アダプター経由でタスク実行
      const { createAdapter } = await import('@maestro/adapters');
      const adapter = createAdapter(agent.type as AgentType, (agent.config as AdapterConfig) ?? {});
      const response = await adapter.runTask({
        taskId,
        prompt: sanitizeString(prompt),
        context: context ? sanitizeString(context) : undefined,
      });

      const completedAt = new Date();
      const status = response.finishReason === 'error' ? 'failed' : 'completed';

      // セッション結果を記録
      await db.update(agent_task_sessions)
        .set({ status, result: response.output || null, ended_at: completedAt })
        .where(eq(agent_task_sessions.id, taskId));

      res.json({
        data: {
          session_id: taskId,
          agent_id,
          output: response.output,
          finish_reason: response.finishReason,
          error: response.error ?? null,
          started_at: startedAt,
          completed_at: completedAt,
        },
      });
    } catch (err) {
      // 実行エラー記録
      await db.update(agent_task_sessions)
        .set({ status: 'failed', ended_at: new Date() })
        .where(eq(agent_task_sessions.id, taskId));
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks — タスク実行履歴一覧
tasksRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const agentIdFilter = typeof req.query.agent_id === 'string' ? req.query.agent_id : undefined;

    const db = getDb();

    // テナント内の全エージェントIDを取得（agent_id フィルタあり/なしで条件切り替え）
    const agentWhere = agentIdFilter
      ? and(eq(agents.company_id, req.companyId!), eq(agents.id, agentIdFilter))
      : eq(agents.company_id, req.companyId!);

    const ownedAgents = await db.select({ id: agents.id }).from(agents).where(agentWhere);
    if (ownedAgents.length === 0) {
      res.json({ data: [], meta: { limit, offset } });
      return;
    }

    const agentIds = ownedAgents.map(a => a.id);
    const rows = await db
      .select()
      .from(agent_task_sessions)
      .where(inArray(agent_task_sessions.agent_id, agentIds))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});
