import { Router, type Router as RouterType } from 'express';
import { getDb, projects, project_workspaces } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
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
