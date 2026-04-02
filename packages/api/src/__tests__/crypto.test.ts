import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, encrypt, decrypt } from '../utils/crypto.js';

// 実際のcrypto実装をテスト
describe('crypto utils', () => {
  it('generateApiKey should return rawKey with correct prefix', async () => {
    const { rawKey, keyHash, prefix } = await generateApiKey('comp_live_');
    expect(rawKey).toMatch(/^comp_live_/);
    expect(keyHash).toBeTruthy();
    expect(prefix).toBe('comp_live_');
  });

  it('hashApiKey should return a bcrypt hash', async () => {
    const hash = await hashApiKey('comp_live_testkey');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('encrypt and decrypt should be reversible', () => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars (32 bytes)
    const plaintext = 'super-secret-value';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });
});
