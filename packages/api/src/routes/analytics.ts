import { Router, type Router as RouterType } from 'express';
import { getDb, plugins, session_summaries, issues, agents } from '@maestro/db';
import { eq, and, desc, gte, sql, count } from 'drizzle-orm';

export const analyticsRouter: RouterType = Router();

// GET /api/analytics/skills — スキル使用メトリクス
// クエリ: period=7d|30d|90d, top=N
analyticsRouter.get('/skills', async (req, res, next) => {
  try {
    const db = getDb();
    const topN = Math.min(Math.max(parseInt(String(req.query.top ?? '10'), 10) || 10, 1), 50);

    const rows = await db
      .select({
        name: plugins.name,
        count: plugins.usage_count,
      })
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!))
      .orderBy(desc(plugins.usage_count))
      .limit(topN);

    // usage_count が null/0 のスキルは除外（グラフに意味がないため）
    const filtered = rows.filter((r) => (r.count ?? 0) > 0);

    res.json({ data: filtered, meta: { top: topN } });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/sessions — セッション統計（期間別件数・ファイル変更数）
// クエリ: period=7d|30d|90d
analyticsRouter.get('/sessions', async (req, res, next) => {
  try {
    const db = getDb();
    const period = String(req.query.period ?? '30d');
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: session_summaries.id,
        headline: session_summaries.headline,
        session_ended_at: session_summaries.session_ended_at,
        changed_files: session_summaries.changed_files,
        agent_id: session_summaries.agent_id,
      })
      .from(session_summaries)
      .where(
        and(
          eq(session_summaries.company_id, req.companyId!),
          gte(session_summaries.session_ended_at, since)
        )
      )
      .orderBy(desc(session_summaries.session_ended_at));

    const totalSessions = rows.length;
    const totalFilesChanged = rows.reduce((acc, r) => {
      return acc + (Array.isArray(r.changed_files) ? r.changed_files.length : 0);
    }, 0);

    res.json({
      data: rows,
      meta: {
        period,
        total_sessions: totalSessions,
        total_files_changed: totalFilesChanged,
        since: since.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/overview — ダッシュボード用サマリー
analyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeAgentsResult, openIssuesResult, todaySessionsResult, totalSkillsResult] = await Promise.all([
      // 稼働中エージェント数
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(agents)
        .where(and(eq(agents.company_id, req.companyId!), eq(agents.enabled, true))),
      // 未完了Issues数
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            eq(issues.company_id, req.companyId!),
            sql`${issues.status} NOT IN ('done', 'closed', 'cancelled')`
          )
        ),
      // 本日のセッション数
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(session_summaries)
        .where(
          and(
            eq(session_summaries.company_id, req.companyId!),
            gte(session_summaries.session_ended_at, today)
          )
        ),
      // 有効スキル（プラグイン）総数 — 名前で重複排除
      db
        .select({ cnt: sql<number>`count(DISTINCT ${plugins.name})::int` })
        .from(plugins)
        .where(and(eq(plugins.company_id, req.companyId!), eq(plugins.enabled, true))),
    ]);

    res.json({
      data: {
        active_agents: activeAgentsResult[0]?.cnt ?? 0,
        open_issues: openIssuesResult[0]?.cnt ?? 0,
        today_sessions: todaySessionsResult[0]?.cnt ?? 0,
        total_skills: totalSkillsResult[0]?.cnt ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
