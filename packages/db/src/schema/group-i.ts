import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  uuid,
  json,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';
import { relations } from 'drizzle-orm';

// ============================================================
// I1: note_articles — note.com 記事マスタ
//   status: draft | pipeline | published | archived
//   content は UTF-8 / LF 正規化済みで格納
// ============================================================
export const note_articles = pgTable('note_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // ファイル由来の識別子
  slug: varchar('slug', { length: 255 }).notNull(),          // ファイル名から拡張子を除いたもの
  original_filename: varchar('original_filename', { length: 255 }), // 元ファイル名

  // 記事メタデータ（frontmatter）
  title: text('title').notNull(),
  type: varchar('type', { length: 50 }).default('無料'),      // 無料 / Tier1 / Tier2 / メンバーシップ
  price: integer('price').default(0),                         // 円（0 = 無料）
  difficulty: varchar('difficulty', { length: 20 }),          // ★☆☆ 形式
  tags: json('tags').$type<string[]>().default([]),           // ["#Claude", "#AI", ...]
  images: json('images').$type<string[]>().default([]),       // 画像パス一覧

  // ステータス・URL
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | pipeline | published | archived
  note_url: varchar('note_url', { length: 1024 }),            // https://note.com/... 公開済みのみ

  // 本文（UTF-8 / LF 正規化済み）
  content: text('content').notNull(),

  // 日時
  article_created_at: timestamp('article_created_at'),        // frontmatter の created フィールド
  published_at: timestamp('published_at'),                    // frontmatter の published フィールド
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany:    index('idx_note_articles_company').on(table.company_id),
  idxStatus:     index('idx_note_articles_status').on(table.status),
  idxPublished:  index('idx_note_articles_published_at').on(table.published_at),
  uniqueSlug:    unique('uq_note_articles_company_slug').on(table.company_id, table.slug),
}));

// ============================================================
// I2: note_article_images — 記事に紐づく画像マスタ
//   image_type: thumbnail | inline | diagram | asset
//   article_id は NULL 可（孤立アセットも登録する）
// ============================================================
export const note_article_images = pgTable('note_article_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // 紐づく記事（NULL = 特定記事に紐づかないアセット）
  article_id: uuid('article_id').references(() => note_articles.id, { onDelete: 'set null' }),

  // ファイル情報
  filename: varchar('filename', { length: 255 }).notNull(),    // ファイル名のみ（例: maestro-login.png）
  file_path: text('file_path').notNull(),                      // 絶対パス

  // 分類
  image_type: varchar('image_type', { length: 20 }).notNull().default('asset'), // thumbnail | inline | diagram | asset
  file_size: integer('file_size'),                             // バイト数

  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxArticle:    index('idx_note_article_images_article').on(table.article_id),
  idxCompany:    index('idx_note_article_images_company').on(table.company_id),
}));

// リレーション定義
export const noteArticlesRelations = relations(note_articles, ({ many }) => ({
  images: many(note_article_images),
}));

export const noteArticleImagesRelations = relations(note_article_images, ({ one }) => ({
  article: one(note_articles, {
    fields: [note_article_images.article_id],
    references: [note_articles.id],
  }),
}));
