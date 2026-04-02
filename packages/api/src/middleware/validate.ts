import type { Request, Response, NextFunction } from 'express';

/**
 * 文字列のサニタイズ（XSS対策）
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // HTMLタグの除去
    .trim()
    .slice(0, 10000); // 最大長制限
}

/**
 * メールアドレスの検証
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * パスワードの強度チェック
 */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

/**
 * UUIDの検証
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * ページネーション検証（SQLインジェクション対策）
 */
export function sanitizePagination(
  limit?: unknown,
  offset?: unknown
): { limit: number; offset: number } {
  const safeLimit = Math.min(Math.max(parseInt(String(limit ?? '20'), 10) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(String(offset ?? '0'), 10) || 0, 0);
  return { limit: safeLimit, offset: safeOffset };
}
