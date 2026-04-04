import { Router, type Router as RouterType } from 'express';
import { getDb, routines, routine_runs } from '@maestro/db';
import { eq, and } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

/** cron 式の基本的な妥当性確認（5フィールドまたは6フィールド） */
function isValidCronExpression(expr: string): boolean {
  // スペース区切りで5〜6フィールド（秒付きの場合6）
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  // 各フィールドが cron 許容文字のみで構成されているか
  return parts.every(p => /^[\d*/,\-?LW#]+$/.test(p));
}

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

    // cron_expression のバリデーション
    if (!isValidCronExpression(cron_expression)) {
      res.status(400).json({ error: 'validation_failed', message: 'cron_expression の形式が無効です（例: 0 9 * * 1）' });
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
