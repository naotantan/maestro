import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * APIキーを生成する
 * @param prefix キープレフィックス（例: 'comp_live_'）
 * @returns rawKey（平文）, keyHash（ハッシュ）, prefix
 */
export async function generateApiKey(prefix: string): Promise<{
  rawKey: string;
  keyHash: string;
  prefix: string;
}> {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const rawKey = `${prefix}${randomBytes}`;
  const keyHash = await hashApiKey(rawKey);
  return { rawKey, keyHash, prefix };
}

/**
 * APIキーをハッシュ化する
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, 10);
}

/**
 * AES-256-GCM で文字列を暗号化する
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // iv(16) + authTag(16) + encrypted を base64 で返す
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * AES-256-GCM で文字列を復号する
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const buf = Buffer.from(ciphertext, 'base64');

  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const encrypted = buf.subarray(32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}
