import { Router, type Router as RouterType } from 'express';
import { getDb, issues, session_summaries, plugins } from '@maestro/db';
import { eq, and, ilike, or, desc } from 'drizzle-orm';

export const searchRouter: RouterType = Router();

// GET /api/search?q=<query> — issues/session_summaries/plugins を横断検索
searchRouter.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();

    if (!q) {
      res.status(400).json({ error: 'validation_failed', message: 'q (検索キーワード) は必須です' });
      return;
    }

    const searchTerm = `%${q}%`;
    const db = getDb();

    const [issueRows, sessionRows, pluginRows] = await Promise.all([
      db
        .select({
          id: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          status: issues.status,
          priority: issues.priority,
          created_at: issues.created_at,
        })
        .from(issues)
        .where(
          and(
            eq(issues.company_id, req.companyId!),
            or(ilike(issues.title, searchTerm), ilike(issues.description, searchTerm))!
          )
        )
        .orderBy(desc(issues.created_at))
        .limit(20),

      db
        .select({
          id: session_summaries.id,
          headline: session_summaries.headline,
          summary: session_summaries.summary,
          session_ended_at: session_summaries.session_ended_at,
        })
        .from(session_summaries)
        .where(
          and(
            eq(session_summaries.company_id, req.companyId!),
            or(
              ilike(session_summaries.headline, searchTerm),
              ilike(session_summaries.summary, searchTerm)
            )!
          )
        )
        .orderBy(desc(session_summaries.session_ended_at))
        .limit(20),

      db
        .select({
          id: plugins.id,
          name: plugins.name,
          description: plugins.description,
          category: plugins.category,
          enabled: plugins.enabled,
        })
        .from(plugins)
        .where(
          and(
            eq(plugins.company_id, req.companyId!),
            or(ilike(plugins.name, searchTerm), ilike(plugins.description, searchTerm))!
          )
        )
        .orderBy(desc(plugins.usage_count))
        .limit(20),
    ]);

    res.json({
      data: {
        issues: issueRows,
        sessions: sessionRows,
        plugins: pluginRows,
      },
      meta: { query: q },
    });
  } catch (err) {
    next(err);
  }
});
