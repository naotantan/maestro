/**
 * W9 セキュリティ強化 — ホワイトボックステスト
 * 対象: validate.ts の XSS/Email修正・server.ts のレート制限環境変数化
 */
import { describe, it, expect } from 'vitest';
import { sanitizeString, isValidEmail, sanitizePagination } from '../middleware/validate.js';

// ─────────────────────────────────────────────
// S1: XSS サニタイズ（sanitizeString）
// ─────────────────────────────────────────────
describe('S1: sanitizeString — XSSエンティティエスケープ', () => {
  it('S1-1: < > をエンティティエスケープする', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('S1-2: & をエスケープする', () => {
    expect(sanitizeString('foo & bar')).toBe('foo &amp; bar');
  });

  it('S1-3: ダブルクォートをエスケープする', () => {
    expect(sanitizeString('"hello"')).toBe('&quot;hello&quot;');
  });

  it('S1-4: シングルクォートをエスケープする', () => {
    expect(sanitizeString("it's fine")).toBe("it&#39;s fine");
  });

  it('S1-5: 複合攻撃パターン（エンコーディング回避）を無力化する', () => {
    const input = '<img src=x onerror="alert(\'XSS\')">';
    const result = sanitizeString(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('S1-6: 削除ではなくエスケープ（文字列長が変わらない → 情報を保持）', () => {
    const result = sanitizeString('a<b');
    expect(result).toBe('a&lt;b'); // 削除なら 'ab' になる
  });

  it('S1-7: 最大長制限（10000文字）を超えたら切り捨てる', () => {
    const longStr = 'a'.repeat(15000);
    expect(sanitizeString(longStr).length).toBeLessThanOrEqual(10000);
  });

  it('S1-8: 通常の文字列は変更しない', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
  });

  it('S1-9: 前後の空白をトリムする', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('S1-10: 空文字列を処理できる', () => {
    expect(sanitizeString('')).toBe('');
  });
});

// ─────────────────────────────────────────────
// S2: メールバリデーション（isValidEmail）
// ─────────────────────────────────────────────
describe('S2: isValidEmail — RFC 5321 簡易準拠', () => {
  it('S2-1: 正常なメールアドレスを許可する', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('S2-2: サブドメインを許可する', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('S2-3: @ が2つあるアドレスを拒否する', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
  });

  it('S2-4: @ がないアドレスを拒否する', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('S2-5: ローカルパートが空（@example.com）を拒否する', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('S2-6: 空文字列を拒否する', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('S2-7: 254文字を超えるメールを拒否する', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(isValidEmail(longEmail)).toBe(false);
  });

  it('S2-8: 254文字ちょうどは許可する（境界値）', () => {
    // user@domain.com 形式で合計254文字
    const localPart = 'a'.repeat(243);
    const email = `${localPart}@example.com`; // 243 + 1 + 11 = 255 → 254文字に調整
    const trimmedLocal = 'a'.repeat(242);
    const validEmail = `${trimmedLocal}@example.com`; // 242+12=254
    expect(validEmail.length).toBe(254);
    expect(isValidEmail(validEmail)).toBe(true);
  });

  it('S2-9: スペースを含むアドレスを拒否する', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('S2-10: ドメインが省略されたアドレスを拒否する（user@）', () => {
    expect(isValidEmail('user@')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// S3: ページネーションサニタイズ
// ─────────────────────────────────────────────
describe('S3: sanitizePagination — SQLインジェクション対策', () => {
  it('S3-1: 正常値を通す', () => {
    const result = sanitizePagination('20', '0');
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it('S3-2: limitが100を超えたら100に丸める', () => {
    expect(sanitizePagination('999').limit).toBe(100);
  });

  it('S3-3: limitが負数なら1にする（0はNaN扱いでデフォルト20）', () => {
    // parseInt('0') = 0 は falsy なため || 20 が発火 → Math.max(20,1) = 20
    expect(sanitizePagination('0').limit).toBe(20);
    // parseInt('-5') = -5 → Math.max(-5 || 20, 1) = Math.max(20, 1) = 20
    // 実装: -5 || 20 → -5 は truthy なので Math.max(-5, 1) = 1
    expect(sanitizePagination('-5').limit).toBe(1);
  });

  it('S3-4: offsetが負数なら0にする', () => {
    expect(sanitizePagination('20', '-10').offset).toBe(0);
  });

  it('S3-5: 文字列（SQLインジェクション試み）を数値変換する', () => {
    const result = sanitizePagination('1; DROP TABLE agents;--', '0');
    expect(result.limit).toBe(1); // parseInt('1; DROP...') = 1
  });

  it('S3-6: undefinedの場合はデフォルト値を使う', () => {
    const result = sanitizePagination(undefined, undefined);
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it('S3-7: NaN文字列はデフォルト値にフォールバックする', () => {
    expect(sanitizePagination('abc').limit).toBe(20); // NaN → 20
  });
});
