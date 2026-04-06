import { Router, type Router as RouterType } from 'express';
import { getDb, users, company_memberships, companies } from '@maestro/db';
import { eq, and } from 'drizzle-orm';
import { sanitizeString, isValidEmail } from '../middleware/validate';

export const userRouter: RouterType = Router();

// GET /api/user/profile — プロフィール取得
userRouter.get('/profile', async (req, res, next) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'unauthorized', message: 'ユーザー認証が必要です' });
      return;
    }

    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar_url: users.avatar_url,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'ユーザーが見つかりません' });
      return;
    }

    // 所属企業とロールを取得
    const memberships = await db
      .select({
        company_id: company_memberships.company_id,
        role: company_memberships.role,
        company_name: companies.name,
      })
      .from(company_memberships)
      .innerJoin(companies, eq(companies.id, company_memberships.company_id))
      .where(eq(company_memberships.user_id, req.userId));

    res.json({
      data: {
        ...rows[0],
        memberships,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/user/profile — プロフィール更新（display_name, email, language）
userRouter.put('/profile', async (req, res, next) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'unauthorized', message: 'ユーザー認証が必要です' });
      return;
    }

    const { display_name, email, language } = req.body as {
      display_name?: string;
      email?: string;
      language?: string;
    };

    const updateFields: Record<string, unknown> = { updated_at: new Date() };

    if (display_name !== undefined) {
      const trimmed = display_name.trim();
      if (!trimmed) {
        res.status(400).json({ error: 'validation_failed', message: 'display_name を空にすることはできません' });
        return;
      }
      updateFields.name = sanitizeString(trimmed).slice(0, 255);
    }

    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!isValidEmail(trimmed)) {
        res.status(400).json({ error: 'validation_failed', message: 'メールアドレスの形式が無効です' });
        return;
      }
      updateFields.email = trimmed;
    }

    // language は company settings に保存（users テーブルには language カラムなし）
    // language が指定された場合は会社設定に反映する
    if (language !== undefined) {
      const VALID_LANGUAGES = ['ja', 'en'];
      if (!VALID_LANGUAGES.includes(language)) {
        res.status(400).json({
          error: 'validation_failed',
          message: `language が無効です。有効な値: ${VALID_LANGUAGES.join(', ')}`,
        });
        return;
      }

      const db = getDb();
      const companyRows = await db
        .select({ settings: companies.settings })
        .from(companies)
        .where(eq(companies.id, req.companyId!))
        .limit(1);

      const current = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;
      await db
        .update(companies)
        .set({ settings: { ...current, language }, updated_at: new Date() })
        .where(eq(companies.id, req.companyId!));
    }

    if (Object.keys(updateFields).length <= 1) {
      // updated_at のみ — 更新するフィールドなし
      res.status(400).json({ error: 'validation_failed', message: '更新するフィールドがありません' });
      return;
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, req.userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar_url: users.avatar_url,
        updated_at: users.updated_at,
      });

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: 'ユーザーが見つかりません' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
