import { Router, type Router as RouterType } from 'express';
import { getDb, jobs, companies } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';
import { PlaneClient, getPlaneConfig } from '../services/plane.js';

export const jobsRouter: RouterType = Router();

/** 会社設定から PlaneClient を取得（未設定なら null） */
async function getPlaneClient(companyId: string): Promise<PlaneClient | null> {
  const db = getDb();
  const rows = await db
    .select({ settings: companies.settings })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>;
  const config = getPlaneConfig(settings);
  return config ? new PlaneClient(config) : null;
}

// GET /api/jobs — 一覧
jobsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.company_id, req.companyId!))
      .orderBy(desc(jobs.created_at))
      .limit(limit);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs — ジョブ作成（Web UIから送信）
// Plane が設定されていれば自動的に Issue を作成する（絶対の仕組み）
jobsRouter.post('/', async (req, res, next) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'prompt は必須です' });
      return;
    }
    const db = getDb();

    // まず DB にジョブを保存
    const sanitized = sanitizeString(prompt.trim());
    const row = await db
      .insert(jobs)
      .values({
        company_id: req.companyId!,
        prompt: sanitized,
      })
      .returning();
    const job = row[0];

    // Plane Issue を自動作成（設定済みの場合）
    const plane = await getPlaneClient(req.companyId!).catch(() => null);
    if (plane) {
      try {
        const issue = await plane.createIssue(
          sanitized.length > 120 ? sanitized.slice(0, 120) + '…' : sanitized,
          sanitized,
        );
        const issueUrl = plane.buildIssueUrl(issue.sequence_id);
        await db
          .update(jobs)
          .set({ plane_issue_id: issue.id, plane_issue_url: issueUrl })
          .where(eq(jobs.id, job.id));
        job.plane_issue_id = issue.id;
        (job as Record<string, unknown>).plane_issue_url = issueUrl;
      } catch (e) {
        // Plane 連携失敗はジョブ作成自体をブロックしない
        console.error('[Plane] Issue 作成失敗:', e);
      }
    }

    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/pending — ポーリング用（最古の pending ジョブ1件）
jobsRouter.get('/pending', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, 'pending'))
      .orderBy(jobs.created_at)
      .limit(1);
    res.json({ data: rows[0] ?? null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/jobs/:jobId — ステータス更新（ポーリングスクリプトから）
// ステータス変更を Plane Issue に自動同期
jobsRouter.patch('/:jobId', async (req, res, next) => {
  try {
    const { status, result, error_message } = req.body as {
      status?: string;
      result?: string;
      error_message?: string;
    };
    const db = getDb();

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (result !== undefined) updates.result = result;
    if (error_message !== undefined) updates.error_message = error_message;
    if (status === 'running') updates.started_at = new Date();
    if (status === 'done' || status === 'error') updates.completed_at = new Date();

    const rows = await db
      .update(jobs)
      .set(updates)
      .where(and(eq(jobs.id, req.params.jobId), eq(jobs.company_id, req.companyId!)))
      .returning();

    if (!rows.length) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const job = rows[0];

    // Plane Issue のステータスを同期
    if (status && job.plane_issue_id) {
      const plane = await getPlaneClient(req.companyId!).catch(() => null);
      if (plane) {
        plane.updateIssueState(job.plane_issue_id, status).catch((e) => {
          console.error('[Plane] Issue 状態同期失敗:', e);
        });
      }
    }

    res.json({ data: job });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jobs/:jobId — キャンセル/削除
jobsRouter.delete('/:jobId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(jobs)
      .where(and(eq(jobs.id, req.params.jobId), eq(jobs.company_id, req.companyId!)));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/plane/test — Plane 接続テスト
jobsRouter.get('/plane/test', async (req, res, next) => {
  try {
    const plane = await getPlaneClient(req.companyId!);
    if (!plane) {
      res.json({ data: { connected: false, message: 'Plane が未設定です' } });
      return;
    }
    const states = await plane.getStates();
    res.json({ data: { connected: true, states_count: states.length, states } });
  } catch (err) {
    res.json({ data: { connected: false, message: String(err) } });
  }
});
