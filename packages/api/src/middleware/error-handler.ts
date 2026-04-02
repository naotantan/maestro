import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // スタックトレースは本番環境では隠す
  const isDev = process.env.NODE_ENV !== 'production';

  console.error({
    timestamp: new Date().toISOString(),
    error: err.message,
    path: req.path,
    method: req.method,
    stack: isDev ? err.stack : undefined,
  });

  // 既にレスポンスが送信済みの場合はスキップ
  if (res.headersSent) return;

  res.status(500).json({
    error: 'internal_server_error',
    message: isDev ? err.message : '内部サーバーエラーが発生しました。',
  });
}
