import { Router, type Router as RouterType } from 'express';
import { getDb, plugins, plugin_jobs, plugin_job_runs, plugin_webhooks } from '@company/db';
import { eq, and } from 'drizzle-orm';

export const pluginsRouter: RouterType = Router();

// --- Plugin CRUD ---

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

// PATCH /api/plugins/:pluginId — Plugin更新
pluginsRouter.patch('/:pluginId', async (req, res, next) => {
  try {
    const { name, description, repository_url, is_active } = req.body as {
      name?: string;
      description?: string;
      repository_url?: string;
      is_active?: boolean;
    };
    const db = getDb();
    const existing = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (repository_url !== undefined) updates.repository_url = repository_url;
    if (is_active !== undefined) updates.is_active = is_active;
    const updated = await db.update(plugins)
      .set({ ...updates, updated_at: new Date() })
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .returning();
    res.json({ data: updated[0] });
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

// --- Plugin Jobs ---

// GET /api/plugins/:pluginId/jobs — ジョブ一覧
pluginsRouter.get('/:pluginId/jobs', async (req, res, next) => {
  try {
    const db = getDb();
    // Pluginが自社に属するか確認
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const jobs = await db.select()
      .from(plugin_jobs)
      .where(eq(plugin_jobs.plugin_id, req.params.pluginId));
    res.json({ data: jobs });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/jobs — ジョブ作成
pluginsRouter.post('/:pluginId/jobs', async (req, res, next) => {
  try {
    const { name, schedule } = req.body as { name?: string; schedule?: string };
    if (!name) {
      res.status(400).json({ error: 'validation_failed', message: 'name は必須です' });
      return;
    }
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const job = await db.insert(plugin_jobs)
      .values({ plugin_id: req.params.pluginId, name, schedule })
      .returning();
    res.status(201).json({ data: job[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/jobs/:jobId/run — ジョブ実行（run record を作成）
pluginsRouter.post('/:pluginId/jobs/:jobId/run', async (req, res, next) => {
  try {
    const db = getDb();
    // Pluginが自社に属するか確認（アクセス制御）
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    // ジョブ存在確認
    const job = await db.select({ id: plugin_jobs.id })
      .from(plugin_jobs)
      .where(and(eq(plugin_jobs.id, req.params.jobId), eq(plugin_jobs.plugin_id, req.params.pluginId)))
      .limit(1);
    if (!job.length) {
      res.status(404).json({ error: 'not_found', message: 'Jobが見つかりません' });
      return;
    }
    // 実行レコード作成
    const run = await db.insert(plugin_job_runs)
      .values({ job_id: req.params.jobId, status: 'running' })
      .returning();
    // 即座にcompleted扱い（同期実行モデル）
    await db.update(plugin_job_runs)
      .set({ status: 'completed', ended_at: new Date() })
      .where(eq(plugin_job_runs.id, run[0].id));
    res.status(201).json({ data: { ...run[0], status: 'completed' } });
  } catch (err) {
    next(err);
  }
});

// --- Plugin Webhooks ---

// GET /api/plugins/:pluginId/webhooks — Webhook一覧
pluginsRouter.get('/:pluginId/webhooks', async (req, res, next) => {
  try {
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const hooks = await db.select()
      .from(plugin_webhooks)
      .where(eq(plugin_webhooks.plugin_id, req.params.pluginId));
    res.json({ data: hooks });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/webhooks — Webhook作成
pluginsRouter.post('/:pluginId/webhooks', async (req, res, next) => {
  try {
    const { url, events } = req.body as { url?: string; events?: string[] };
    if (!url || !events?.length) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'url と events は必須です',
      });
      return;
    }
    // URL形式バリデーション
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      res.status(400).json({ error: 'validation_failed', message: 'url の形式が不正です' });
      return;
    }
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const hook = await db.insert(plugin_webhooks)
      .values({ plugin_id: req.params.pluginId, url, events })
      .returning();
    res.status(201).json({ data: hook[0] });
  } catch (err) {
    next(err);
  }
});
