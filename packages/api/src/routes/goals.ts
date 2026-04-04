import { Router, type Router as RouterType } from 'express';
import { getDb, goals, issue_goals, issues } from '@maestro/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

export const goalsRouter: RouterType = Router();

goalsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(goals)
      .where(eq(goals.company_id, req.companyId!))
      .orderBy(desc(goals.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, deadline } = req.body as {
      name?: string;
      description?: string;
      deadline?: string;
    };
    if (!name) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name は必須です',
      });
      return;
    }
    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : description;
    const db = getDb();
    const newGoal = await db
      .insert(goals)
      .values({
        company_id: req.companyId!,
        name: sanitizedName,
        description: sanitizedDescription,
        deadline: deadline ? new Date(deadline) : undefined,
      })
      .returning();
    res.status(201).json({ data: newGoal[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.get('/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch('/:goalId', async (req, res, next) => {
  try {
    const { name, description, status, deadline } = req.body as {
      name?: string;
      description?: string;
      status?: string;
      deadline?: string;
    };
    const db = getDb();
    const updated = await db
      .update(goals)
      .set({
        ...(name && { name: sanitizeString(name) }),
        ...(description !== undefined && { description: description ? sanitizeString(description) : description }),
        ...(status && { status }),
        ...(deadline && { deadline: new Date(deadline) }),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      )
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(goals)
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/goals/:goalId/recalculate — Goal達成率を再計算して更新
goalsRouter.post('/:goalId/recalculate', async (req, res, next) => {
  try {
    const db = getDb();

    // Goalの存在確認
    const goalRows = await db.select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, req.params.goalId), eq(goals.company_id, req.companyId!)))
      .limit(1);
    if (!goalRows.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }

    // このGoalに紐付くIssueを取得
    const linkedIssues = await db.select({ issue_id: issue_goals.issue_id })
      .from(issue_goals)
      .where(eq(issue_goals.goal_id, req.params.goalId));

    let progress = 0;
    if (linkedIssues.length > 0) {
      const issueIds = linkedIssues.map(l => l.issue_id);
      // 完了済みIssue数を集計
      const completedResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .where(
          and(
            inArray(issues.id, issueIds),
            eq(issues.status, 'done')
          )
        );
      const completedCount = Number(completedResult[0]?.count ?? 0);
      progress = Math.round((completedCount / linkedIssues.length) * 100);
    }

    // Goalのprogressを更新
    const updated = await db.update(goals)
      .set({ progress, updated_at: new Date() })
      .where(and(eq(goals.id, req.params.goalId), eq(goals.company_id, req.companyId!)))
      .returning();

    res.json({ data: updated[0], progress, total_issues: linkedIssues.length });
  } catch (err) {
    next(err);
  }
});
