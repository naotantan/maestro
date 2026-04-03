import { Router, type Router as RouterType } from 'express';
import { getDb, issues, issue_comments, issue_goals, agents, goals } from '@company/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const issuesRouter: RouterType = Router();

async function findOwnedIssue(db: ReturnType<typeof getDb>, companyId: string, issueId: string) {
  const rows = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), eq(issues.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

async function findOwnedGoal(db: ReturnType<typeof getDb>, companyId: string, goalId: string) {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

async function findOwnedAgent(db: ReturnType<typeof getDb>, companyId: string, agentId: string) {
  const rows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

// GET /api/issues
issuesRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const rows = await db
      .select()
      .from(issues)
      .where(eq(issues.company_id, req.companyId!))
      .orderBy(desc(issues.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues
issuesRouter.post('/', async (req, res, next) => {
  try {
    const { title, description, status, priority, assigned_to } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
    };
    if (!title) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'title は必須です',
      });
      return;
    }
    // XSS対策: HTMLタグを除去
    const sanitizedTitle = sanitizeString(title);
    const sanitizedDescription = description ? sanitizeString(description) : description;
    const db = getDb();
    // identifier 採番
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(eq(issues.company_id, req.companyId!));
    const count = Number(countResult[0]?.count ?? 0);
    const identifier = `COMP-${String(count + 1).padStart(3, '0')}`;
    // assigned_toが未指定の場合、有効なエージェントに自動アサイン
    let finalAssignedTo = assigned_to;
    if (finalAssignedTo && !(await findOwnedAgent(db, req.companyId!, finalAssignedTo))) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'assigned_to が無効です',
      });
      return;
    }
    if (!finalAssignedTo) {
      const availableAgents = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.company_id, req.companyId!), eq(agents.enabled, true)))
        .limit(1);
      if (availableAgents.length > 0) {
        finalAssignedTo = availableAgents[0].id;
      }
    }

    const newIssue = await db
      .insert(issues)
      .values({
        company_id: req.companyId!,
        identifier,
        title: sanitizedTitle,
        description: sanitizedDescription,
        status,
        priority,
        assigned_to: finalAssignedTo,
        created_by: req.userId,
      })
      .returning();
    res.status(201).json({ data: newIssue[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId
issuesRouter.get('/:issueId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/issues/:issueId
issuesRouter.patch('/:issueId', async (req, res, next) => {
  try {
    const { title, description, status, priority, assigned_to } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
    };
    const db = getDb();
    if (assigned_to !== undefined && assigned_to !== null && assigned_to !== '' && !(await findOwnedAgent(db, req.companyId!, assigned_to))) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'assigned_to が無効です',
      });
      return;
    }
    const updated = await db
      .update(issues)
      .set({
        ...(title && { title: sanitizeString(title) }),
        ...(description !== undefined && { description: description ? sanitizeString(description) : description }),
        ...(status && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigned_to !== undefined && { assigned_to: assigned_to || null }),
        updated_at: new Date(),
        ...(status === 'done' && { completed_at: new Date() }),
      })
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      )
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/issues/:issueId
issuesRouter.delete('/:issueId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(issues)
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId/comments
issuesRouter.get('/:issueId/comments', async (req, res, next) => {
  try {
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const comments = await db
      .select()
      .from(issue_comments)
      .where(eq(issue_comments.issue_id, req.params.issueId))
      .orderBy(issue_comments.created_at);
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId/goals — 紐付きGoal一覧
issuesRouter.get('/:issueId/goals', async (req, res, next) => {
  try {
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const links = await db
      .select()
      .from(issue_goals)
      .where(eq(issue_goals.issue_id, req.params.issueId));
    res.json({ data: links });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:issueId/goals — GoalをIssueに紐付け
issuesRouter.post('/:issueId/goals', async (req, res, next) => {
  try {
    const { goal_id } = req.body as { goal_id?: string };
    if (!goal_id) {
      res.status(400).json({ error: 'validation_failed', message: 'goal_id は必須です' });
      return;
    }
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const goal = await findOwnedGoal(db, req.companyId!, goal_id);
    if (!goal) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    let link;
    try {
      link = await db.insert(issue_goals).values({
        issue_id: req.params.issueId,
        goal_id,
      }).returning();
    } catch (dbErr: any) {
      // PostgreSQL unique violation (23505) = すでに紐付け済み
      if (dbErr?.code === '23505') {
        res.status(409).json({ error: 'conflict', message: 'すでに紐付け済みです' });
        return;
      }
      throw dbErr;
    }
    res.status(201).json({ data: link[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/issues/:issueId/goals/:goalId — 紐付け解除
issuesRouter.delete('/:issueId/goals/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const goal = await findOwnedGoal(db, req.companyId!, req.params.goalId);
    if (!goal) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    await db.delete(issue_goals).where(
      and(
        eq(issue_goals.issue_id, req.params.issueId),
        eq(issue_goals.goal_id, req.params.goalId)
      )
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:issueId/comments
issuesRouter.post('/:issueId/comments', async (req, res, next) => {
  try {
    const { body } = req.body as { body?: string };
    if (!body) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'body は必須です',
      });
      return;
    }
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    if (!req.userId) {
      res.status(403).json({
        error: 'forbidden',
        message: 'ユーザーに紐付くAPIキーでのみコメントを投稿できます',
      });
      return;
    }
    const comment = await db
      .insert(issue_comments)
      .values({
        issue_id: req.params.issueId,
        author_id: req.userId,
        body: sanitizeString(body),
      })
      .returning();
    res.status(201).json({ data: comment[0] });
  } catch (err) {
    next(err);
  }
});
