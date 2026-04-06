import path from 'path';
import fs from 'fs';
import { getDb, board_api_keys } from '@maestro/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

function getApiKey(): string | null {
  if (process.env.MAESTRO_API_KEY) return process.env.MAESTRO_API_KEY;
  const keyFile = path.join(process.env.HOME ?? '', '.maestro', 'api-key');
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf-8').trim();
  return null;
}

/**
 * APIキーからcompany_idを解決する（起動時に一度だけ実行）
 */
export async function resolveCompanyId(): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('MAESTRO_API_KEY が未設定です (~/.maestro/api-key または環境変数)');
  }

  const db = getDb();

  // プレフィックスを抽出してDBから候補を取得
  const firstUnderscore = apiKey.indexOf('_');
  const secondUnderscore = apiKey.indexOf('_', firstUnderscore + 1);
  const prefix = secondUnderscore !== -1
    ? apiKey.substring(0, secondUnderscore + 1)
    : apiKey.substring(0, firstUnderscore + 1);

  const keys = await db
    .select()
    .from(board_api_keys)
    .where(eq(board_api_keys.key_prefix, prefix));

  for (const key of keys) {
    if (!key.key_hash) continue;
    const isMatch = await bcrypt.compare(apiKey, key.key_hash);
    if (isMatch && key.enabled) {
      // 有効期限チェック
      if (key.expires_at && key.expires_at < new Date()) {
        throw new Error('APIキーの有効期限が切れています');
      }
      return key.company_id;
    }
  }

  throw new Error('無効なAPIキーです');
}
