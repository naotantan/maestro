import { Router, type Router as RouterType } from 'express';
import { getDb, plugins } from '@company/db';
import { eq, and } from 'drizzle-orm';

export const pluginsRouter: RouterType = Router();

pluginsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, repository_url } = req.body as {
      name?: string;
      description?: string;
      repository_url?: string;
    };
    if (!name) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name は必須です',
      });
      return;
    }
    const db = getDb();
    const newPlugin = await db
      .insert(plugins)
      .values({
        company_id: req.companyId!,
        name,
        description,
        repository_url,
      })
      .returning();
    res.status(201).json({ data: newPlugin[0] });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.get('/:pluginId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(plugins)
      .where(
        and(
          eq(plugins.id, req.params.pluginId),
          eq(plugins.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.delete('/:pluginId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(plugins)
      .where(
        and(
          eq(plugins.id, req.params.pluginId),
          eq(plugins.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
