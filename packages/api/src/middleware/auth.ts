import type { Request, Response, NextFunction } from 'express';
import { getDb, board_api_keys } from '@company/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logAuthFailure } from './audit';

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
      userId?: string;
    }
  }
}

/**
 * APIキー認証ミドルウェア
 * Authorization: Bearer <api_key> ヘッダーを検証する
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: '認証が必要です。Authorization: Bearer <api_key> ヘッダーを設定してください。',
    });
    return;
  }

  const rawKey = authHeader.slice(7);

  // トークン長制限（DoS対策）
  if (rawKey.length > 256) {
    logAuthFailure(req, 'token_length_exceeded');
    res.status(401).json({
      error: 'unauthorized',
      message: '認証に失敗しました。',
    });
    return;
  }

  try {
    const db = getDb();
    // 全APIキーを取得してbcryptで比較（プレフィックスマッチングは最適化）
    // プレフィックスは2番目の_までを含む（例: comp_live_）
    const firstUnderscore = rawKey.indexOf('_');
    const secondUnderscore = rawKey.indexOf('_', firstUnderscore + 1);
    const prefix = secondUnderscore !== -1
      ? rawKey.substring(0, secondUnderscore + 1)
      : rawKey.substring(0, firstUnderscore + 1);
    const keys = await db
      .select()
      .from(board_api_keys)
      .where(eq(board_api_keys.key_prefix, prefix));

    // keysが配列であることを確認
    if (!Array.isArray(keys)) {
      logAuthFailure(req, 'db_error');
      console.error('[DEBUG] keys is not array:', typeof keys, keys);
      res.status(401).json({
        error: 'invalid_api_key',
        message: '無効なAPIキーです。',
      });
      return;
    }
    // デバッグログは本番環境のセキュリティリスクになるため削除済み

    // bcryptで平文と保存済みハッシュを比較
    let matchedKey = null;
    try {
      for (const key of keys) {
        if (!key.key_hash) continue; // ハッシュがない場合はスキップ
        const isMatch = await bcrypt.compare(rawKey, key.key_hash);
        if (isMatch && key.enabled) {
          matchedKey = key;
          break;
        }
      }
    } catch (bcryptErr) {
      logAuthFailure(req, 'bcrypt_error');
      res.status(401).json({
        error: 'invalid_api_key',
        message: '無効なAPIキーです。',
      });
      return;
    }

    if (!matchedKey) {
      logAuthFailure(req, 'invalid_api_key');
      res.status(401).json({
        error: 'invalid_api_key',
        message: '無効なAPIキーです。',
      });
      return;
    }

    // 有効期限チェック
    if (matchedKey.expires_at && matchedKey.expires_at < new Date()) {
      logAuthFailure(req, 'api_key_expired');
      res.status(401).json({
        error: 'api_key_expired',
        message: 'APIキーの有効期限が切れています。',
      });
      return;
    }

    req.companyId = matchedKey.company_id;

    // last_used_at を非同期で更新（レスポンスをブロックしない）
    db.update(board_api_keys)
      .set({ last_used_at: new Date() })
      .where(eq(board_api_keys.id, matchedKey.id))
      .execute()
      .catch(() => { /* 更新失敗は無視 */ });

    next();
  } catch (err) {
    next(err);
  }
}
