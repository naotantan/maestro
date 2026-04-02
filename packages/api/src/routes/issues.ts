import { Router, type Router as RouterType } from 'express';
import { getDb, issues, issue_comments } from '@company/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export const issuesRouter: RouterType = Router();

// GET /api/issues
issuesRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);
    const offset = parseInt((req.query.offset as string) || '0');
    const db = getDb();
    const rows = await db
      .select()
      .from(issues)
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
    const { title, description, status, priority, assigned_to } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
    };
    if (!title) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'title は必須です',
      });
      return;
    }
    const db = getDb();
    // identifier 採番
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(eq(issues.company_id, req.companyId!));
    const count = Number(countResult[0]?.count ?? 0);
    const identifier = `COMP-${String(count + 1).padStart(3, '0')}`;
    const newIssue = await db
      .insert(issues)
      .values({
        company_id: req.companyId!,
        identifier,
        title,
        description,
        status,
        priority,
        assigned_to,
      })
      .returning();
    res.status(201).json({ data: newIssue[0] });
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
    const { title, description, status, priority, assigned_to } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigned_to?: string;
    };
    const db = getDb();
    const updated = await db
      .update(issues)
      .set({
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigned_to !== undefined && { assigned_to }),
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
    res.json({ data: updated[0] });
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
    const db = getDb();
    const comments = await db
      .select()
      .from(issue_comments)
      .where(eq(issue_comments.issue_id, req.params.issueId))
      .orderBy(issue_comments.created_at);
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:issueId/comments
issuesRouter.post('/:issueId/comments', async (req, res, next) => {
  try {
    const { body, author_id } = req.body as { body?: string; author_id?: string };
    if (!body) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'body は必須です',
      });
      return;
    }
    const db = getDb();
    const comment = await db
      .insert(issue_comments)
      .values({
        issue_id: req.params.issueId,
        author_id: author_id || 'system',
        body,
      })
      .returning();
    res.status(201).json({ data: comment[0] });
  } catch (err) {
    next(err);
  }
});
