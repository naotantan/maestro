import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
      userId?: string;
    }
  }
}

/**
 * セキュリティ監査ログ（本番では外部ログシステムに送信）
 */
export function auditLog(
  event: string,
  req: Request,
  details?: Record<string, unknown>
): void {
  const log = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    companyId: (req as unknown as { companyId?: string }).companyId,
    path: req.path,
    method: req.method,
    ...details,
  };
  // 本番環境では stdout への JSON ログ出力（ログ収集システムが拾う）
  console.log(JSON.stringify(log));
}

/**
 * 認証失敗ミドルウェア
 */
export function logAuthFailure(req: Request, reason: string): void {
  auditLog('auth_failure', req, { reason });
}
