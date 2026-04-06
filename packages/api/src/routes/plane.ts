import { Router, type Router as RouterType } from 'express';
import { getDb, companies } from '@maestro/db';
import { eq } from 'drizzle-orm';
import { PlaneClient, getPlaneConfig } from '../services/plane.js';

export const planeRouter: RouterType = Router();

/** company settings から PlaneClient を取得（未設定なら null） */
async function getClient(companyId: string): Promise<PlaneClient | null> {
  const db = getDb();
  const rows = await db
    .select({ settings: companies.settings })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const settings = rows[0]?.settings as Record<string, unknown> | undefined;
  if (!settings) return null;

  const config = getPlaneConfig(settings);
  if (!config) return null;

  return new PlaneClient(config);
}

// GET /api/plane/projects — プロジェクト一覧
planeRouter.get('/projects', async (req, res, next) => {
  try {
    const client = await getClient(req.companyId!);
    if (!client) {
      res.status(400).json({ error: 'plane_not_configured' });
      return;
    }
    const projects = await client.listProjects();
    res.json({ data: projects });
  } catch (err) {
    next(err);
  }
});

// POST /api/plane/projects — プロジェクト作成
planeRouter.post('/projects', async (req, res, next) => {
  try {
    const client = await getClient(req.companyId!);
    if (!client) {
      res.status(400).json({ error: 'plane_not_configured' });
      return;
    }

    const { name, description } = req.body as { name?: string; description?: string };
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'invalid_request', message: 'name は必須です' });
      return;
    }

    const project = await client.createProject(name.trim(), description?.trim());
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// GET /api/plane/projects/:projectId/issues — Issue 一覧
planeRouter.get('/projects/:projectId/issues', async (req, res, next) => {
  try {
    const client = await getClient(req.companyId!);
    if (!client) {
      res.status(400).json({ error: 'plane_not_configured' });
      return;
    }

    const { projectId } = req.params;
    const group = req.query.group as string | undefined;

    const issues = await client.listIssues(projectId, group ? { group } : undefined);
    res.json({ data: issues });
  } catch (err) {
    next(err);
  }
});

// POST /api/plane/projects/:projectId/pages — ページ作成
planeRouter.post('/projects/:projectId/pages', async (req, res, next) => {
  try {
    const client = await getClient(req.companyId!);
    if (!client) {
      res.status(400).json({ error: 'plane_not_configured' });
      return;
    }

    const { projectId } = req.params;
    const { title, body } = req.body as { title?: string; body?: string };

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'invalid_request', message: 'title は必須です' });
      return;
    }
    if (!body || typeof body !== 'string') {
      res.status(400).json({ error: 'invalid_request', message: 'body は必須です' });
      return;
    }

    const page = await client.createPage(projectId, title.trim(), body);
    res.status(201).json({ data: page });
  } catch (err) {
    next(err);
  }
});
