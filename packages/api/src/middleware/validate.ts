/**
 * 文字列のサニタイズ（XSS対策）
 * HTMLエンティティエンコーディングで危険な文字を無力化する（削除ではなくエスケープ）
 */
export function sanitizeString(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return input
    .replace(/[&<>"']/g, (char) => map[char]) // HTMLエンティティエスケープ
    .trim()
    .slice(0, 10000); // 最大長制限
}

/**
 * メールアドレスの検証（RFC 5321 簡易準拠）
 * @ が複数存在する場合・ローカルパートが空の場合を明示的に拒否する
 */
export function isValidEmail(email: string): boolean {
  // @ が正確に1つであることを確認
  if ((email.match(/@/g) || []).length !== 1) return false;
  // RFC 5321 簡易パターン（実用的な範囲でバリデーション）
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * パスワードの強度チェック
 * 要件: 8〜128文字、大文字・小文字・数字をそれぞれ1文字以上含む
 */
export function isStrongPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8 || password.length > 128) {
    return { valid: false, message: 'パスワードは8文字以上128文字以下で入力してください' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '大文字を1文字以上含めてください' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '小文字を1文字以上含めてください' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '数字を1文字以上含めてください' };
  }
  return { valid: true };
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
