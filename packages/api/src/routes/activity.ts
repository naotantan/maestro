import { Router, type Router as RouterType } from 'express';
import { getDb, activity_log, issues, goals, projects, agents } from '@maestro/db';
import { eq, desc, inArray } from 'drizzle-orm';

export const activityRouter: RouterType = Router();

activityRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);
    const db = getDb();
    const rows = await db
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, req.companyId!))
      .orderBy(desc(activity_log.created_at))
      .limit(limit);

    if (rows.length === 0) {
      res.json({ data: [] });
      return;
    }

    // entity_id → entity_name を解決するためエンティティ別にIDを収集
    const issueIds   = rows.filter(r => r.entity_type === 'issue'   && r.entity_id).map(r => r.entity_id!);
    const goalIds    = rows.filter(r => r.entity_type === 'goal'    && r.entity_id).map(r => r.entity_id!);
    const projectIds = rows.filter(r => r.entity_type === 'project' && r.entity_id).map(r => r.entity_id!);
    const agentIds   = rows.filter(r => r.entity_type === 'agent'   && r.entity_id).map(r => r.entity_id!);

    // 各テーブルからIDとname/title/identifierを取得
    const [issueRows, goalRows, projectRows, agentRows] = await Promise.all([
      issueIds.length > 0
        ? db.select({ id: issues.id, title: issues.title, identifier: issues.identifier })
             .from(issues).where(inArray(issues.id, issueIds))
        : [],
      goalIds.length > 0
        ? db.select({ id: goals.id, name: goals.name }).from(goals).where(inArray(goals.id, goalIds))
        : [],
      projectIds.length > 0
        ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
        : [],
      agentIds.length > 0
        ? db.select({ id: agents.id, name: agents.name }).from(agents).where(inArray(agents.id, agentIds))
        : [],
    ]);

    // ID → 表示名のマップを構築
    const nameMap: Record<string, string> = {};
    for (const r of issueRows)   nameMap[r.id] = `${r.identifier} ${r.title}`;
    for (const r of goalRows)    nameMap[r.id] = r.name;
    for (const r of projectRows) nameMap[r.id] = r.name;
    for (const r of agentRows)   nameMap[r.id] = r.name;

    // entity_name と updated_fields を付与して返す
    const enriched = rows.map(r => {
      const changes = r.changes as Record<string, unknown> | null;
      const entityName =
        (r.entity_id && nameMap[r.entity_id]) ||
        (typeof changes?.entity_name === 'string' ? changes.entity_name : undefined) ||
        r.entity_id;
      const updatedFields = Array.isArray(changes?.updated_fields)
        ? (changes.updated_fields as string[])
        : null;
      return { ...r, entity_name: entityName ?? null, updated_fields: updatedFields };
    });

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
});
