import { Router, type Router as RouterType } from 'express';
import { getDb, companies, company_memberships, board_api_keys } from '@maestro/db';
import { eq } from 'drizzle-orm';
import { generateApiKey } from '../utils/crypto';
import { API_KEY_PREFIXES } from '@maestro/shared';
import { sanitizeString } from '../middleware/validate';

export const companiesRouter: RouterType = Router();

/**
 * GET /api/companies
 * 認証ユーザーの企業一覧
 */
companiesRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const companyId = req.companyId!;

    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company.length === 0) {
      res.status(404).json({ error: 'not_found', message: '企業が見つかりません。' });
      return;
    }

    res.json({ data: company[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/companies/:companyId/members
 * メンバー一覧
 */
companiesRouter.get('/:companyId/members', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (companyId !== req.companyId) {
      res.status(403).json({ error: 'forbidden', message: 'アクセス権限がありません。' });
      return;
    }

    const db = getDb();
    const members = await db
      .select()
      .from(company_memberships)
      .where(eq(company_memberships.company_id, companyId));

    res.json({ data: members });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/companies/:companyId/api-keys
 * 新しいAPIキーを生成
 */
companiesRouter.post('/:companyId/api-keys', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (companyId !== req.companyId) {
      res.status(403).json({ error: 'forbidden', message: 'アクセス権限がありません。' });
      return;
    }

    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: 'validation_failed', message: 'キー名が必要です。' });
      return;
    }

    const db = getDb();
    const { rawKey, keyHash, prefix } = await generateApiKey(API_KEY_PREFIXES.BOARD);
    const sanitizedKeyName = sanitizeString(name);
    const keyName = req.userId ? `user:${req.userId}:${sanitizedKeyName}` : sanitizedKeyName;

    await db.insert(board_api_keys).values({
      company_id: companyId,
      key_hash: keyHash,
      key_prefix: prefix,
      name: keyName,
    });

    res.status(201).json({
      apiKey: rawKey,
      warning: 'このAPIキーは二度と表示されません。安全に保管してください。',
    });
  } catch (err) {
    next(err);
  }
});
