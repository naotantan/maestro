import { Router, type Router as RouterType } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, users, company_memberships, companies, board_api_keys } from '@company/db';
import { eq } from 'drizzle-orm';
import { generateApiKey, hashApiKey } from '../utils/crypto';
import { API_KEY_PREFIXES } from '@company/shared';
import { isValidEmail, isStrongPassword, sanitizeString } from '../middleware/validate';
import { auditLog } from '../middleware/audit';

export const authRouter: RouterType = Router();

/**
 * POST /api/auth/register
 * 新規ユーザー登録 + 初期企業・APIキー生成
 */
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, companyName } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      companyName?: string;
    };

    if (!email || !password || !name || !companyName) {
      res.status(400).json({
        error: 'validation_failed',
        message: '必須フィールドが不足しています。',
        fields: {
          email: !email ? ['必須'] : [],
          password: !password ? ['必須'] : [],
          name: !name ? ['必須'] : [],
          companyName: !companyName ? ['必須'] : [],
        },
      });
      return;
    }

    // メールアドレス検証
    if (!isValidEmail(email)) {
      res.status(400).json({
        error: 'validation_failed',
        message: '有効なメールアドレスを入力してください。',
      });
      return;
    }

    // パスワード強度チェック
    if (!isStrongPassword(password)) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'パスワードは8文字以上128文字以下で入力してください。',
      });
      return;
    }

    // 入力値のサニタイズ
    const sanitizedName = sanitizeString(name);
    const sanitizedCompanyName = sanitizeString(companyName);

    const db = getDb();

    // メール重複チェック
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      auditLog('register_email_taken', req, { email });
      res.status(409).json({
        error: 'email_taken',
        message: 'このメールアドレスは既に登録されています。',
      });
      return;
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 12);

    // トランザクション: ユーザー → 企業 → メンバーシップ → APIキー
    const userId = uuidv4();
    const companyId = uuidv4();

    // APIキーを先に生成（トランザクション外）
    const { rawKey, keyHash, prefix } = await generateApiKey(API_KEY_PREFIXES.BOARD);

    await db.transaction(async (tx) => {
      // ユーザー作成
      await tx.insert(users).values({
        id: userId,
        email,
        password_hash: passwordHash,
        name: sanitizedName,
      });

      // 企業作成
      await tx.insert(companies).values({
        id: companyId,
        name: sanitizedCompanyName,
        created_by: userId,
      });

      // メンバーシップ（admin）
      await tx.insert(company_memberships).values({ company_id: companyId, user_id: userId, role: 'admin' });

      // Board APIキー保存
      await tx.insert(board_api_keys).values({
        company_id: companyId,
        key_hash: keyHash,
        key_prefix: prefix,
        name: '初期キー',
      });

      // 監査ログ
      auditLog('user_registered', req, { userId, companyId, email });
    });

    // トランザクション完了後にレスポンス送信
    res.status(201).json({
      message: '登録が完了しました。',
      apiKey: rawKey,
      companyId,
      userId,
      warning: 'このAPIキーは二度と表示されません。安全に保管してください。',
    });
  } catch (err) {
    auditLog('register_error', req, { error: err instanceof Error ? err.message : 'unknown' });
    next(err);
  }
});

/**
 * POST /api/auth/login
 * ログイン → APIキー返却
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'validation_failed', message: 'メールアドレスとパスワードが必要です。' });
      return;
    }

    const db = getDb();
    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (userRows.length === 0) {
      auditLog('login_user_not_found', req, { email });
      res.status(401).json({
        error: 'invalid_credentials',
        message: 'メールアドレスまたはパスワードが正しくありません。',
      });
      return;
    }

    const user = userRows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      auditLog('login_invalid_password', req, { userId: user.id, email });
      res.status(401).json({
        error: 'invalid_credentials',
        message: 'メールアドレスまたはパスワードが正しくありません。',
      });
      return;
    }

    auditLog('user_logged_in', req, { userId: user.id, email });

    // ユーザーの所属企業を取得
    const memberships = await db
      .select({ company_id: company_memberships.company_id, role: company_memberships.role })
      .from(company_memberships)
      .where(eq(company_memberships.user_id, user.id))
      .limit(1);

    res.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      companies: memberships,
    });
  } catch (err) {
    next(err);
  }
});
