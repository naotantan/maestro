import { Router, type Router as RouterType } from 'express';
import { getDb, routines, routine_runs } from '@company/db';
import { eq, and, desc } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

export const routinesRouter: RouterType = Router();

routinesRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(routines)
      .where(eq(routines.company_id, req.companyId!));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

routinesRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, cron_expression } = req.body as {
      name?: string;
      description?: string;
      cron_expression?: string;
    };
    if (!name || !cron_expression) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name と cron_expression は必須です',
      });
      return;
    }
    const db = getDb();
    const newRoutine = await db
      .insert(routines)
      .values({
        company_id: req.companyId!,
        name: sanitizeString(name),
        description: description ? sanitizeString(description) : description,
        cron_expression: sanitizeString(cron_expression),
      })
      .returning();
    res.status(201).json({ data: newRoutine[0] });
  } catch (err) {
    next(err);
  }
});

routinesRouter.get('/:routineId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.id, req.params.routineId),
          eq(routines.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Routineが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

routinesRouter.delete('/:routineId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(routines)
      .where(
        and(
          eq(routines.id, req.params.routineId),
          eq(routines.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/routines/:routineId/run — 手動実行
routinesRouter.post('/:routineId/run', async (req, res, next) => {
  try {
    const db = getDb();
    // 自社のルーチンか確認
    const routineCheck = await db
      .select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, req.params.routineId), eq(routines.company_id, req.companyId!)))
      .limit(1);
    if (!routineCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Routineが見つかりません' });
      return;
    }
    const run = await db
      .insert(routine_runs)
      .values({
        routine_id: req.params.routineId,
        status: 'success',
      })
      .returning();
    res.status(201).json({ data: run[0] });
  } catch (err) {
    next(err);
  }
});
