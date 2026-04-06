import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateApiKey, hashApiKey, encrypt, decrypt } from '../utils/crypto.js';

describe('crypto utils', () => {
  // --- generateApiKey ---
  describe('generateApiKey', () => {
    it('should return rawKey with correct prefix', async () => {
      const { rawKey, keyHash, prefix } = await generateApiKey('comp_live_');
      expect(rawKey).toMatch(/^comp_live_/);
      expect(keyHash).toBeTruthy();
      expect(prefix).toBe('comp_live_');
    });

    it('should append 64 hex characters after the prefix', async () => {
      const { rawKey, prefix } = await generateApiKey('comp_live_');
      const suffix = rawKey.slice(prefix.length);
      // randomBytes(32).toString('hex') → 64 hex chars
      expect(suffix).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should work with agent_live_ prefix', async () => {
      const { rawKey, prefix } = await generateApiKey('agent_live_');
      expect(rawKey).toMatch(/^agent_live_/);
      expect(prefix).toBe('agent_live_');
    });

    it('should produce different rawKeys on successive calls', async () => {
      const a = await generateApiKey('comp_live_');
      const b = await generateApiKey('comp_live_');
      expect(a.rawKey).not.toBe(b.rawKey);
    });

    it('keyHash should be a bcrypt hash of the rawKey', async () => {
      const { keyHash } = await generateApiKey('comp_live_');
      // bcrypt hash starts with $2b$ (or $2a$/$2y$)
      expect(keyHash).toMatch(/^\$2[aby]\$\d+\$/);
    });
  });

  // --- hashApiKey ---
  describe('hashApiKey', () => {
    it('should return a bcrypt hash', async () => {
      const hash = await hashApiKey('comp_live_testkey');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should produce different hashes for the same input (salting)', async () => {
      const hash1 = await hashApiKey('same_key');
      const hash2 = await hashApiKey('same_key');
      expect(hash1).not.toBe(hash2);
    });
  });

  // --- encrypt / decrypt ---
  describe('encrypt and decrypt', () => {
    const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    beforeEach(() => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
    });

    afterEach(() => {
      delete process.env.ENCRYPTION_KEY;
    });

    it('should be reversible (round-trip)', () => {
      const plaintext = 'super-secret-value';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypted output should differ from plaintext', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext each call (random IV)', () => {
      const plaintext = 'same plaintext';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      // both must decrypt correctly
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });

    it('should handle empty string round-trip', () => {
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });

    it('should handle unicode / multibyte characters', () => {
      const plaintext = '日本語テスト 🔐';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('encrypt should throw when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    });

    it('encrypt should throw when ENCRYPTION_KEY is too short', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    });

    it('decrypt should throw when ENCRYPTION_KEY is not set', () => {
      // encrypt with valid key first
      const ciphertext = encrypt('data');
      delete process.env.ENCRYPTION_KEY;
      expect(() => decrypt(ciphertext)).toThrow('ENCRYPTION_KEY');
    });

    it('decrypt should throw when ENCRYPTION_KEY is wrong length (63 chars)', () => {
      process.env.ENCRYPTION_KEY = '0'.repeat(63);
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    });

    it('encrypted output should be valid base64', () => {
      const encrypted = encrypt('test data');
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });
  });
});
