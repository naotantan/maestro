import { Router, type Router as RouterType } from 'express';
import { getDb, goals } from '@company/db';
import { eq, and, desc } from 'drizzle-orm';

export const goalsRouter: RouterType = Router();

goalsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(goals)
      .where(eq(goals.company_id, req.companyId!))
      .orderBy(desc(goals.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, deadline } = req.body as {
      name?: string;
      description?: string;
      deadline?: string;
    };
    if (!name) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name は必須です',
      });
      return;
    }
    const db = getDb();
    const newGoal = await db
      .insert(goals)
      .values({
        company_id: req.companyId!,
        name,
        description,
        deadline: deadline ? new Date(deadline) : undefined,
      })
      .returning();
    res.status(201).json({ data: newGoal[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.get('/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch('/:goalId', async (req, res, next) => {
  try {
    const { name, description, status, deadline } = req.body as {
      name?: string;
      description?: string;
      status?: string;
      deadline?: string;
    };
    const db = getDb();
    const updated = await db
      .update(goals)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(deadline && { deadline: new Date(deadline) }),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      )
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'Goalが見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/:goalId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(goals)
      .where(
        and(
          eq(goals.id, req.params.goalId),
          eq(goals.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
