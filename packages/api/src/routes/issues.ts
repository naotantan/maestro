import { Router, type Router as RouterType } from 'express';
import { getDb, issues, issue_comments, issue_goals, agents, goals, projects, agent_handoffs, companies, company_memberships, users } from '@maestro/db';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';
import { findOwnedIssue, findOwnedGoal, findOwnedAgent } from '../utils/ownership';
import { PlaneClient, getPlaneConfig, type PlaneState } from '../services/plane.js';

async function getPlaneClient(companyId: string): Promise<PlaneClient | null> {
  const db = getDb();
  const rows = await db.select({ settings: companies.settings }).from(companies)
    .where(eq(companies.id, companyId)).limit(1);
  const config = getPlaneConfig((rows[0]?.settings ?? {}) as Record<string, unknown>);
  return config ? new PlaneClient(config) : null;
}

// Issue status → Plane state group マッピング
const ISSUE_STATUS_TO_PLANE_GROUP: Record<string, string> = {
  backlog: 'backlog',
  todo: 'unstarted',
  in_progress: 'started',
  in_review: 'started',
  done: 'completed',
  cancelled: 'cancelled',
};

const VALID_ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;

export const issuesRouter: RouterType = Router();

// GET /api/issues（project_nameをJOINで付与）
issuesRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const db = getDb();
    const rows = await db
      .select({
        id: issues.id,
        company_id: issues.company_id,
        project_id: issues.project_id,
        project_name: projects.name,
        identifier: issues.identifier,
        title: issues.title,
        description: issues.description,
        status: issues.status,
        priority: issues.priority,
        assigned_to: issues.assigned_to,
        created_by: issues.created_by,
        created_at: issues.created_at,
        updated_at: issues.updated_at,
        completed_at: issues.completed_at,
        plane_issue_id: issues.plane_issue_id,
        plane_issue_url: issues.plane_issue_url,
      })
      .from(issues)
      .leftJoin(projects, eq(issues.project_id, projects.id))
      .where(eq(issues.company_id, req.companyId!))
      .orderBy(desc(issues.created_at))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues
issuesRouter.post('/', async (req, res, next) => {
  try {
    const { title, description, status, priority, assigned_to, project_id } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
      project_id?: string;
    };
    if (!title) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'title は必須です',
      });
      return;
    }

    // status/priority の検証
    if (status && !VALID_ISSUE_STATUSES.includes(status as typeof VALID_ISSUE_STATUSES[number])) {
      res.status(400).json({ error: 'validation_failed', message: `status が無効です。有効な値: ${VALID_ISSUE_STATUSES.join(', ')}` });
      return;
    }
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 5)) {
      res.status(400).json({ error: 'validation_failed', message: 'priority は 0〜5 の整数です' });
      return;
    }

    // XSS対策: HTMLタグを除去
    const sanitizedTitle = sanitizeString(title);
    const sanitizedDescription = description ? sanitizeString(description) : description;
    const db = getDb();

    // project_id の検証（指定された場合のみ）
    if (project_id) {
      const projectRows = await db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.id, project_id), eq(projects.company_id, req.companyId!))).limit(1);
      if (!projectRows.length) {
        res.status(400).json({ error: 'validation_failed', message: 'project_id が無効です' });
        return;
      }
    }

    // assigned_toが未指定の場合、有効なエージェントに自動アサイン
    let finalAssignedTo = assigned_to;
    if (finalAssignedTo && !(await findOwnedAgent(db, req.companyId!, finalAssignedTo))) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'assigned_to が無効です',
      });
      return;
    }
    if (!finalAssignedTo) {
      const availableAgents = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.company_id, req.companyId!), eq(agents.enabled, true)))
        .limit(1);
      if (availableAgents.length > 0) {
        finalAssignedTo = availableAgents[0].id;
      }
    }

    // トランザクション内で identifier を採番（race condition 防止）
    const newIssue = await db.transaction(async (tx) => {
      // プロジェクトのプレフィックスを取得
      let prefix = 'TODO';
      if (project_id) {
        const projRow = await tx
          .select({ prefix: projects.prefix })
          .from(projects)
          .where(eq(projects.id, project_id))
          .limit(1);
        if (projRow[0]?.prefix) prefix = projRow[0].prefix;
      }

      // プロジェクト内の最大番号を取得
      const maxResult = await tx
        .select({ max_id: sql<string | null>`max(identifier)` })
        .from(issues)
        .where(
          project_id
            ? eq(issues.project_id, project_id)
            : eq(issues.company_id, req.companyId!)
        );

      const maxIdentifier = maxResult[0]?.max_id;
      let nextNum = 1;
      if (maxIdentifier) {
        const match = maxIdentifier.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const identifier = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      // トランザクション内で insert を実行
      return tx
        .insert(issues)
        .values({
          company_id: req.companyId!,
          project_id: project_id ?? null,
          identifier,
          title: sanitizedTitle,
          description: sanitizedDescription,
          status,
          priority,
          assigned_to: finalAssignedTo,
          created_by: req.userId,
        })
        .returning();
    });
    const issue = newIssue[0];

    // Plane Issue を自動作成
    const plane = await getPlaneClient(req.companyId!).catch(() => null);
    if (plane) {
      try {
        const pi = await plane.createIssue(
          `[${issue.identifier}] ${sanitizedTitle}`,
          sanitizedDescription,
        );
        const issueUrl = plane.buildIssueUrl(pi.sequence_id);
        await db.update(issues)
          .set({ plane_issue_id: pi.id, plane_issue_url: issueUrl })
          .where(eq(issues.id, issue.id));
        issue.plane_issue_id = pi.id;
        (issue as Record<string, unknown>).plane_issue_url = issueUrl;
      } catch (e) {
        console.error('[Plane] Issue作成失敗:', e);
      }
    }

    res.status(201).json({ data: issue });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId
issuesRouter.get('/:issueId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/issues/:issueId
issuesRouter.patch('/:issueId', async (req, res, next) => {
  try {
    let { title, description, status, priority, assigned_to, project_id } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
      project_id?: string | null;
    };

    // status/priority の検証
    if (status && !VALID_ISSUE_STATUSES.includes(status as typeof VALID_ISSUE_STATUSES[number])) {
      res.status(400).json({ error: 'validation_failed', message: `status が無効です。有効な値: ${VALID_ISSUE_STATUSES.join(', ')}` });
      return;
    }
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 5)) {
      res.status(400).json({ error: 'validation_failed', message: 'priority は 0〜5 の整数です' });
      return;
    }

    const db = getDb();
    if (assigned_to !== undefined && assigned_to !== null && assigned_to !== '' && !(await findOwnedAgent(db, req.companyId!, assigned_to))) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'assigned_to が無効です',
      });
      return;
    }
    // project_id の検証（指定された場合のみ）
    if (project_id) {
      const projectRows = await db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.id, project_id), eq(projects.company_id, req.companyId!))).limit(1);
      if (!projectRows.length) {
        res.status(400).json({ error: 'validation_failed', message: 'project_id が無効です' });
        return;
      }
    }

    // status が done に変わる場合、対応内容を追記
    if (status === 'done') {
      const currentIssue = await db.select({ description: issues.description })
        .from(issues)
        .where(eq(issues.id, req.params.issueId))
        .limit(1);
      const currentDesc = currentIssue[0]?.description ?? '';
      // description が既に対応完了セクションを含む場合は追記しない
      if (!currentDesc.includes('**対応完了**')) {
        const resolvedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const resolutionNote = description
          ? `\n\n---\n**対応完了** (${resolvedAt})\n${description}`
          : `\n\n---\n**対応完了** (${resolvedAt})\n手動で完了マークされました。`;
        description = (currentDesc + resolutionNote).trim();
      }
    }

    const updated = await db
      .update(issues)
      .set({
        ...(title && { title: sanitizeString(title) }),
        ...(description !== undefined && { description: description ? sanitizeString(description) : description }),
        ...(status && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigned_to !== undefined && { assigned_to: assigned_to || null }),
        ...(project_id !== undefined && { project_id: project_id ?? null }),
        updated_at: new Date(),
        ...(status === 'done' && { completed_at: new Date() }),
      })
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      )
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }

    // statusが変更された場合、紐付くゴールの進捗を自動再計算する
    if (status) {
      const linkedGoals = await db
        .select({ goal_id: issue_goals.goal_id })
        .from(issue_goals)
        .where(eq(issue_goals.issue_id, req.params.issueId));

      const goalIds = linkedGoals.map(g => g.goal_id);
      if (goalIds.length > 0) {
        // 全ゴールに紐付く issue_goals を一括取得（N+1 回避）
        const allLinks = await db
          .select({ goal_id: issue_goals.goal_id, issue_id: issue_goals.issue_id })
          .from(issue_goals)
          .where(inArray(issue_goals.goal_id, goalIds));

        // 関連する全 issue の status を一括取得
        const allIssueIds = [...new Set(allLinks.map(l => l.issue_id))];
        const issueStatuses = allIssueIds.length > 0
          ? await db
              .select({ id: issues.id, status: issues.status })
              .from(issues)
              .where(inArray(issues.id, allIssueIds))
          : [];
        const statusMap = new Map(issueStatuses.map(i => [i.id, i.status]));

        // ゴールごとに進捗を計算してバッチ更新
        const now = new Date();
        for (const goalId of goalIds) {
          const goalLinks = allLinks.filter(l => l.goal_id === goalId);
          const total = goalLinks.length;
          const doneCount = goalLinks.filter(l => statusMap.get(l.issue_id) === 'done').length;
          const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          await db
            .update(goals)
            .set({ progress, updated_at: now })
            .where(eq(goals.id, goalId));
        }
      }
    }

    const updatedIssue = updated[0];

    // ステータス変更を Plane に同期
    if (status && updatedIssue.plane_issue_id) {
      const plane = await getPlaneClient(req.companyId!).catch(() => null);
      if (plane) {
        const planeGroup = ISSUE_STATUS_TO_PLANE_GROUP[status];
        if (planeGroup) {
          plane.updateIssueStateByGroup(updatedIssue.plane_issue_id, planeGroup as PlaneState['group']).catch((e) => {
            console.error('[Plane] Issue状態同期失敗:', e);
          });
        }
      }
    }

    res.json({ data: updatedIssue });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/issues/:issueId
issuesRouter.delete('/:issueId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(issues)
      .where(
        and(
          eq(issues.id, req.params.issueId),
          eq(issues.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId/comments
issuesRouter.get('/:issueId/comments', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit ?? '50', req.query.offset);
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(issue_comments)
      .where(eq(issue_comments.issue_id, req.params.issueId));
    const total = Number(countResult?.total ?? 0);
    const comments = await db
      .select()
      .from(issue_comments)
      .where(eq(issue_comments.issue_id, req.params.issueId))
      .orderBy(issue_comments.created_at)
      .limit(limit)
      .offset(offset);
    res.json({ data: comments, meta: { total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:issueId/goals — 紐付きGoal一覧
issuesRouter.get('/:issueId/goals', async (req, res, next) => {
  try {
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const links = await db
      .select()
      .from(issue_goals)
      .where(eq(issue_goals.issue_id, req.params.issueId));
    res.json({ data: links });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:issueId/goals — GoalをIssueに紐付け
issuesRouter.post('/:issueId/goals', async (req, res, next) => {
  try {
    const { goal_id } = req.body as { goal_id?: string };
    if (!goal_id) {
      res.status(400).json({ error: 'validation_failed', message: 'goal_id は必須です' });
      return;
    }
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const goal = await findOwnedGoal(db, req.companyId!, goal_id);
    if (!goal) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    let link;
    try {
      link = await db.insert(issue_goals).values({
        issue_id: req.params.issueId,
        goal_id,
      }).returning();
    } catch (dbErr: any) {
      // PostgreSQL unique violation (23505) = すでに紐付け済み
      if (dbErr?.code === '23505') {
        res.status(409).json({ error: 'conflict', message: 'すでに紐付け済みです' });
        return;
      }
      throw dbErr;
    }
    res.status(201).json({ data: link[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/issues/:issueId/goals/:goalId — 紐付け解除
issuesRouter.delete('/:issueId/goals/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    const goal = await findOwnedGoal(db, req.companyId!, req.params.goalId);
    if (!goal) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    await db.delete(issue_goals).where(
      and(
        eq(issue_goals.issue_id, req.params.issueId),
        eq(issue_goals.goal_id, req.params.goalId)
      )
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:issueId/comments
issuesRouter.post('/:issueId/comments', async (req, res, next) => {
  try {
    const { body } = req.body as { body?: string };
    if (!body) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'body は必須です',
      });
      return;
    }
    const db = getDb();
    const issue = await findOwnedIssue(db, req.companyId!, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'not_found', message: 'Issueが見つかりません' });
      return;
    }
    // userId未設定（board APIキー）の場合はcompanyのadminユーザーをauthorとして使用
    let authorId = req.userId;
    if (!authorId) {
      const adminRow = await db
        .select({ user_id: company_memberships.user_id })
        .from(company_memberships)
        .where(and(eq(company_memberships.company_id, req.companyId!), eq(company_memberships.role, 'admin')))
        .limit(1);
      authorId = adminRow[0]?.user_id ?? undefined;
      if (!authorId) {
        res.status(403).json({ error: 'forbidden', message: 'コメント投稿に必要なユーザーが見つかりません' });
        return;
      }
    }
    const sanitizedBody = sanitizeString(body);
    const comment = await db
      .insert(issue_comments)
      .values({
        issue_id: req.params.issueId,
        author_id: authorId,
        body: sanitizedBody,
      })
      .returning();

    // @メンション検出 → agent_handoffs 生成
    const mentions = body.match(/@([\w\u3040-\u9FFF\u30A0-\u30FF\-]+)/g) ?? [];
    if (mentions.length > 0) {
      const mentionNames = mentions.map(m => m.slice(1).toLowerCase());
      const allAgents = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(and(eq(agents.company_id, req.companyId!), eq(agents.enabled, true)));
      for (const name of mentionNames) {
        const matched = allAgents.find(a => a.name.toLowerCase().includes(name));
        if (matched) {
          await db.insert(agent_handoffs).values({
            company_id: req.companyId!,
            from_agent_id: matched.id, // システム起点のため自己参照
            to_agent_id: matched.id,
            issue_id: req.params.issueId,
            status: 'pending',
            prompt: `Issue のコメントであなたがメンションされました: "${sanitizedBody}"`,
          });
        }
      }
    }

    res.status(201).json({ data: comment[0] });
  } catch (err) {
    next(err);
  }
});
