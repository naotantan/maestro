import { Router, type Router as RouterType } from 'express';
import { getDb, projects, project_workspaces, issues, goals, issue_goals } from '@maestro/db';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

/** プロジェクト名からプレフィックスを自動生成 */
function generatePrefix(name: string): string {
  // 英字のみの場合: 大文字3文字（例: "maestro開発" → "MAE"）
  const alpha = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (alpha.length >= 3) return alpha.slice(0, 3);

  // 英字が少ない場合: 日本語の頭文字をローマ字風に（カタカナ/ひらがなの最初の子音）
  // フォールバック: 名前のハッシュ的に3文字
  if (alpha.length > 0) return alpha.padEnd(3, 'X');

  // 全角のみ: 先頭3文字のコードポイントからアルファベットを生成
  const chars = [...name.replace(/\s/g, '')].slice(0, 3);
  return chars.map(c => String.fromCharCode(65 + (c.charCodeAt(0) % 26))).join('');
}

export const projectsRouter: RouterType = Router();

projectsRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.company_id, req.companyId!));
    const total = Number(countResult?.total ?? 0);
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.company_id, req.companyId!))
      .orderBy(desc(projects.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { total, limit, offset } });
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

    // プレフィックス自動生成: 名前からアルファベット大文字3文字を抽出
    const prefix = (req.body as Record<string, unknown>).prefix
      ? sanitizeString(String((req.body as Record<string, unknown>).prefix)).toUpperCase().slice(0, 10)
      : generatePrefix(sanitizedName);

    const db = getDb();
    const newProject = await db
      .insert(projects)
      .values({
        company_id: req.companyId!,
        name: sanitizedName,
        prefix,
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
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(issues)
      .where(and(eq(issues.project_id, req.params.projectId), eq(issues.company_id, req.companyId!)));
    const total = Number(countResult?.total ?? 0);
    const rows = await db.select().from(issues)
      .where(and(eq(issues.project_id, req.params.projectId), eq(issues.company_id, req.companyId!)))
      .orderBy(desc(issues.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/goals — プロジェクト紐付きGoal一覧
projectsRouter.get('/:projectId/goals', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const projectCheck = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, req.params.projectId), eq(projects.company_id, req.companyId!))).limit(1);
    if (!projectCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Projectが見つかりません' });
      return;
    }
    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(goals)
      .where(and(eq(goals.project_id, req.params.projectId), eq(goals.company_id, req.companyId!)));
    const total = Number(countResult?.total ?? 0);
    const rows = await db.select().from(goals)
      .where(and(eq(goals.project_id, req.params.projectId), eq(goals.company_id, req.companyId!)))
      .orderBy(desc(goals.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { total, limit, offset } });
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
