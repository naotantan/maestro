import { Router, type Router as RouterType } from 'express';
import { getDb, routines, routine_runs } from '@maestro/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

/** cron 式の基本的な妥当性確認（5フィールドまたは6フィールド） */
function isValidCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  return parts.every(p => /^[\d*/,\-?LW#]+$/.test(p));
}

export const routinesRouter: RouterType = Router();

// GET /api/routines — 一覧（最新の実行結果付き）
routinesRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(routines)
      .where(eq(routines.company_id, req.companyId!))
      .orderBy(desc(routines.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/routines — 作成
routinesRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, prompt, cron_expression } = req.body as {
      name?: string;
      description?: string;
      prompt?: string;
      cron_expression?: string;
    };
    if (!name || !cron_expression) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name と cron_expression は必須です',
      });
      return;
    }

    if (!isValidCronExpression(cron_expression)) {
      res.status(400).json({ error: 'validation_failed', message: 'cron_expression の形式が無効です（例: 0 9 * * 1）' });
      return;
    }

    const db = getDb();

    // 会社内の最大番号を取得して+1
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${routines.number}), 0)` })
      .from(routines)
      .where(eq(routines.company_id, req.companyId!));

    const newRoutine = await db
      .insert(routines)
      .values({
        company_id: req.companyId!,
        number: max + 1,
        name: sanitizeString(name),
        description: description ? sanitizeString(description) : undefined,
        prompt: prompt ? sanitizeString(prompt) : undefined,
        cron_expression: sanitizeString(cron_expression),
      })
      .returning();
    res.status(201).json({ data: newRoutine[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/routines/:routineId — 詳細
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

// DELETE /api/routines/:routineId
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

// GET /api/routines/:routineId/runs — 実行履歴
routinesRouter.get('/:routineId/runs', async (req, res, next) => {
  try {
    const db = getDb();
    // 所有確認
    const routineCheck = await db
      .select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, req.params.routineId), eq(routines.company_id, req.companyId!)))
      .limit(1);
    if (!routineCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Routineが見つかりません' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const runs = await db
      .select()
      .from(routine_runs)
      .where(eq(routine_runs.routine_id, req.params.routineId))
      .orderBy(desc(routine_runs.executed_at))
      .limit(limit);
    res.json({ data: runs });
  } catch (err) {
    next(err);
  }
});

// POST /api/routines/:routineId/run — 手動実行（結果付き）
routinesRouter.post('/:routineId/run', async (req, res, next) => {
  try {
    const db = getDb();
    const routineCheck = await db
      .select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, req.params.routineId), eq(routines.company_id, req.companyId!)))
      .limit(1);
    if (!routineCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'Routineが見つかりません' });
      return;
    }

    const { result, status, error_message } = req.body as {
      result?: string;
      status?: string;
      error_message?: string;
    };

    const run = await db
      .insert(routine_runs)
      .values({
        routine_id: req.params.routineId,
        status: status || 'success',
        result: result || undefined,
        error_message: error_message || undefined,
      })
      .returning();
    res.status(201).json({ data: run[0] });
  } catch (err) {
    next(err);
  }
});
