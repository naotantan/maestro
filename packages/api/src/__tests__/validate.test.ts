import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizePagination,
  isValidEmail,
  isStrongPassword,
  isValidUuid,
} from '../middleware/validate.js';

// --- sanitizeString ---
describe('sanitizeString', () => {
  it('should escape <script> tags (XSS prevention)', () => {
    const result = sanitizeString('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should escape < and > characters', () => {
    const result = sanitizeString('<b>bold</b>');
    expect(result).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('should escape & ampersand', () => {
    expect(sanitizeString('a & b')).toBe('a &amp; b');
  });

  it('should escape double quotes', () => {
    expect(sanitizeString('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('should escape single quotes', () => {
    expect(sanitizeString("it's")).toBe('it&#39;s');
  });

  it('should pass through plain strings unchanged (no special chars)', () => {
    const plain = 'Hello World 123';
    expect(sanitizeString(plain)).toBe(plain);
  });

  it('should return empty string for empty input', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should truncate strings longer than 10000 characters', () => {
    const long = 'a'.repeat(10001);
    expect(sanitizeString(long)).toHaveLength(10000);
  });

  it('should handle string of exactly 10000 chars without truncation', () => {
    const exact = 'a'.repeat(10000);
    expect(sanitizeString(exact)).toHaveLength(10000);
  });

  it('should handle all dangerous characters together', () => {
    const result = sanitizeString('<script>alert("XSS & \'hack\'");</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).not.toContain("'");
    expect(result).not.toContain('&"'); // raw & before quote
  });
});

// --- sanitizePagination ---
describe('sanitizePagination', () => {
  it('should return defaults when no arguments provided', () => {
    const result = sanitizePagination();
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should return defaults when undefined is passed', () => {
    const result = sanitizePagination(undefined, undefined);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should accept valid limit and offset', () => {
    const result = sanitizePagination(50, 10);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
  });

  it('should cap limit at 100 when given 1000', () => {
    const result = sanitizePagination(1000, 0);
    expect(result.limit).toBe(100);
  });

  it('should cap limit at 100 when given very large number', () => {
    const result = sanitizePagination(999999, 0);
    expect(result.limit).toBe(100);
  });

  it('should return default 20 when given 0 (0 is falsy, triggers || 20 fallback)', () => {
    // Implementation: parseInt('0') || 20 → 20 because 0 is falsy
    const result = sanitizePagination(0, 0);
    expect(result.limit).toBe(20);
  });

  it('should floor negative limit to 1', () => {
    // parseInt('-5') = -5, -5 || 20 = -5 (truthy), Math.max(-5, 1) = 1
    const result = sanitizePagination(-5, 0);
    expect(result.limit).toBe(1);
  });

  it('should floor negative offset to 0', () => {
    const result = sanitizePagination(20, -10);
    expect(result.offset).toBe(0);
  });

  it('should return default limit when given string "abc"', () => {
    const result = sanitizePagination('abc', 0);
    expect(result.limit).toBe(20);
  });

  it('should return default offset when given string "abc"', () => {
    const result = sanitizePagination(20, 'abc');
    expect(result.offset).toBe(0);
  });

  it('should parse numeric strings', () => {
    const result = sanitizePagination('50', '25');
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(25);
  });

  it('should handle null-like falsy values for limit (default 20)', () => {
    const result = sanitizePagination(null, 0);
    expect(result.limit).toBe(20);
  });

  it('should handle exactly the max limit of 100', () => {
    const result = sanitizePagination(100, 0);
    expect(result.limit).toBe(100);
  });
});

// --- isValidEmail ---
describe('isValidEmail', () => {
  it('should return true for valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should return false for email with no @', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('should return false for email with multiple @', () => {
    expect(isValidEmail('a@@b.com')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should return false for email longer than 254 chars', () => {
    const long = 'a'.repeat(245) + '@example.com'; // >254
    expect(isValidEmail(long)).toBe(false);
  });
});

// --- isStrongPassword ---
describe('isStrongPassword', () => {
  it('should accept a valid strong password', () => {
    const result = isStrongPassword('Secure1Password');
    expect(result.valid).toBe(true);
  });

  it('should reject password shorter than 8 chars', () => {
    const result = isStrongPassword('Ab1');
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('should reject password longer than 128 chars', () => {
    const result = isStrongPassword('Aa1' + 'x'.repeat(126));
    expect(result.valid).toBe(false);
  });

  it('should reject password without uppercase', () => {
    const result = isStrongPassword('alllower1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('大文字');
  });

  it('should reject password without lowercase', () => {
    const result = isStrongPassword('ALLUPPER1');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('小文字');
  });

  it('should reject password without digit', () => {
    const result = isStrongPassword('NoDigitHere');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('数字');
  });
});

// --- isValidUuid ---
describe('isValidUuid', () => {
  it('should accept a valid UUID v4', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should reject a string without hyphens', () => {
    expect(isValidUuid('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidUuid('')).toBe(false);
  });

  it('should reject UUID with wrong segment lengths', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
  });

  it('should accept UUID with uppercase hex chars', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});
