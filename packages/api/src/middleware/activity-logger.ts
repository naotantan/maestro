import type { Request, Response, NextFunction } from 'express';
import { getDb, activity_log } from '@company/db';

// パスからエンティティ種別を抽出する
// app.use('/api', ...) でマウントされるため req.path は /agents 形式（/api/ プレフィックスなし）
function extractEntityType(path: string): string | null {
  const segments = path.replace(/^\//, '').split('/');
  const entityMap: Record<string, string> = {
    agents: 'agent',
    issues: 'issue',
    goals: 'goal',
    projects: 'project',
    costs: 'cost',
    routines: 'routine',
    plugins: 'plugin',
    approvals: 'approval',
  };
  return entityMap[segments[0]] ?? null;
}

// HTTPメソッドをアクション名に変換
function methodToAction(method: string): string {
  const map: Record<string, string> = {
    POST: 'create',
    PATCH: 'update',
    PUT: 'update',
    DELETE: 'delete',
  };
  return map[method] ?? method.toLowerCase();
}

/**
 * Activity自動記録ミドルウェア
 * POST/PATCH/PUT/DELETE で 2xx レスポンスが返ったときに activity_log へ記録する。
 */
export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  // 記録対象メソッドのみ
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  const entityType = extractEntityType(req.path);
  if (!entityType) {
    next();
    return;
  }

  // レスポンス完了後に記録（非同期・エラーはサイレント）
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const companyId = req.companyId;
    if (!companyId) return;

    const action = methodToAction(req.method);

    // UUIDパターンでエンティティIDを抽出
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const pathMatch = req.path.match(uuidPattern);
    const entityId = pathMatch?.[0] ?? undefined;

    getDb()
      .insert(activity_log)
      .values({
        company_id: companyId,
        actor_id: req.userId ?? undefined,
        entity_type: entityType,
        entity_id: entityId,
        action,
        changes: {
          method: req.method,
          path: req.path,
          authKeyId: req.authKeyId,
          authKeyName: req.authKeyName,
        },
      })
      .catch(() => {
        // Activity記録の失敗はメインフローに影響させない
      });
  });

  next();
}
