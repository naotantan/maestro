import { Router, type Router as RouterType } from 'express';
import { getDb, projects, project_workspaces, issues, goals, issue_goals } from '@maestro/db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

export const projectsRouter: RouterType = Router();

projectsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.company_id, req.companyId!))
      .orderBy(desc(projects.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
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
    const newProject = await db
      .insert(projects)
      .values({
        company_id: req.companyId!,
        name: sanitizedName,
        description: sanitizedDescription,
      })
      .returning();
    res.status(201).json({ data: newProject[0] });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, req.params.projectId),
          eq(projects.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:projectId', async (req, res, next) => {
  try {
    const { name, description, status } = req.body as {
      name?: string;
      description?: string;
      status?: string;
    };
    const db = getDb();
    const updated = await db
      .update(projects)
      .set({
        ...(name && { name: sanitizeString(name) }),
        ...(description !== undefined && { description: description ? sanitizeString(description) : description }),
        ...(status && { status }),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(projects.id, req.params.projectId),
          eq(projects.company_id, req.companyId!)
        )
      )
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(projects)
      .where(
        and(
          eq(projects.id, req.params.projectId),
          eq(projects.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/issues — プロジェクト紐付きIssue一覧
projectsRouter.get('/:projectId/issues', async (req, res, next) => {
  try {
    const db = getDb();
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    const rows = await db.select().from(issues)
      .where(and(eq(issues.project_id, req.params.projectId), eq(issues.company_id, req.companyId!)))
      .orderBy(desc(issues.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/goals — プロジェクト紐付きGoal一覧
projectsRouter.get('/:projectId/goals', async (req, res, next) => {
  try {
    const db = getDb();
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    const rows = await db.select().from(goals)
      .where(and(eq(goals.project_id, req.params.projectId), eq(goals.company_id, req.companyId!)))
      .orderBy(desc(goals.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/goals — 既存ゴールをプロジェクトに紐付ける
projectsRouter.post('/:projectId/goals', async (req, res, next) => {
  try {
    const { goal_id } = req.body as {
      goal_id?: string;
    };
    if (!goal_id) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'goal_id は必須です',
      });
      return;
    }
    const db = getDb();
    // プロジェクトの存在確認
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    // ゴールの存在確認
    const goalCheck = await db.select({ id: goals.id }).from(goals)
      .where(and(eq(goals.id, goal_id), eq(goals.company_id, req.companyId!))).limit(1);
    if (!goalCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    // ゴールをプロジェクトに紐付ける
    const updated = await db.update(goals)
      .set({ project_id: req.params.projectId, updated_at: new Date() })
      .where(eq(goals.id, goal_id))
      .returning();
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/issue-goal-links — このプロジェクトのゴールに紐付くIssue-Goal対応を返す
projectsRouter.get('/:projectId/issue-goal-links', async (req, res, next) => {
  try {
    const db = getDb();
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    // このプロジェクトに属するゴールIDを取得
    const projectGoals = await db.select({ id: goals.id }).from(goals)
      .where(and(eq(goals.project_id, req.params.projectId), eq(goals.company_id, req.companyId!)));
    if (!projectGoals.length) {
      res.json({ data: [] });
      return;
    }
    const goalIds = projectGoals.map(g => g.id);
    // ゴールに紐付くissue_goalsを取得
    const links = await db.select({
      goal_id: issue_goals.goal_id,
      issue_id: issue_goals.issue_id,
    }).from(issue_goals).where(inArray(issue_goals.goal_id, goalIds));
    res.json({ data: links });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/workspaces
projectsRouter.get('/:projectId/workspaces', async (req, res, next) => {
  try {
    const db = getDb();
    // プロジェクトが自社のものか確認してからワークスペースを返す
    const projectCheck = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!)))
      .limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    const workspaces = await db
      .select()
      .from(project_workspaces)
      .where(eq(project_workspaces.project_id, req.params.projectId));
    res.json({ data: workspaces });
  } catch (err) {
    next(err);
  }
});
