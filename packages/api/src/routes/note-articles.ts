import { Router, type Router as RouterType } from 'express';
import { getDb, note_articles, note_article_images } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

export const noteArticlesRouter: RouterType = Router();

// GET /api/note-articles — 一覧（新しい順）
noteArticlesRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = sanitizePagination(req.query.limit, req.query.offset);
    const { status } = req.query;
    const db = getDb();

    const query = db
      .select({
        id:                 note_articles.id,
        slug:               note_articles.slug,
        title:              note_articles.title,
        type:               note_articles.type,
        price:              note_articles.price,
        difficulty:         note_articles.difficulty,
        tags:               note_articles.tags,
        status:             note_articles.status,
        note_url:           note_articles.note_url,
        article_created_at: note_articles.article_created_at,
        published_at:       note_articles.published_at,
        updated_at:         note_articles.updated_at,
      })
      .from(note_articles)
      .where(
        status
          ? and(
              eq(note_articles.company_id, req.companyId!),
              eq(note_articles.status, String(status)),
            )
          : eq(note_articles.company_id, req.companyId!),
      )
      .orderBy(desc(note_articles.updated_at))
      .limit(limit)
      .offset(offset);

    const rows = await query;
    res.json({ data: rows, meta: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /api/note-articles/:id — 個別取得（本文含む）
noteArticlesRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(note_articles)
      .where(
        and(
          eq(note_articles.id, req.params.id),
          eq(note_articles.company_id, req.companyId!),
        ),
      )
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: '記事が見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/note-articles/:id — 更新
noteArticlesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { title, type, price, difficulty, tags, images, status, note_url, content, published_at } =
      req.body as {
        title?: string;
        type?: string;
        price?: number;
        difficulty?: string;
        tags?: string[];
        images?: string[];
        status?: string;
        note_url?: string;
        content?: string;
        published_at?: string;
      };

    const db = getDb();
    const updateFields: Record<string, unknown> = { updated_at: new Date() };
    if (title     !== undefined) updateFields.title      = sanitizeString(title.trim());
    if (type      !== undefined) updateFields.type       = type;
    if (price     !== undefined) updateFields.price      = price;
    if (difficulty !== undefined) updateFields.difficulty = difficulty;
    if (tags      !== undefined) updateFields.tags       = Array.isArray(tags) ? tags : [];
    if (images    !== undefined) updateFields.images     = Array.isArray(images) ? images : [];
    if (status    !== undefined) updateFields.status     = status;
    if (note_url  !== undefined) updateFields.note_url   = note_url || null;
    if (content   !== undefined) {
      // CRLF → LF 正規化
      updateFields.content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    if (published_at !== undefined) updateFields.published_at = published_at ? new Date(published_at) : null;

    const updated = await db
      .update(note_articles)
      .set(updateFields)
      .where(
        and(
          eq(note_articles.id, req.params.id),
          eq(note_articles.company_id, req.companyId!),
        ),
      )
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: '記事が見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/note-articles/:id/images — 記事に紐づく画像一覧
noteArticlesRouter.get('/:id/images', async (req, res, next) => {
  try {
    const db = getDb();
    const images = await db
      .select()
      .from(note_article_images)
      .where(
        and(
          eq(note_article_images.article_id, req.params.id),
          eq(note_article_images.company_id, req.companyId!),
        ),
      )
      .orderBy(note_article_images.image_type);

    res.json({ data: images });
  } catch (err) {
    next(err);
  }
});
