import { pgTable, text, varchar, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// L1: artifacts（成果物記録）
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  session_id: varchar('session_id', { length: 36 }),  // Claude Code セッションID
  type: varchar('type', { length: 30 }).notNull().default('file'), // url | file | report | image | other
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),    // 成果物の概要・説明
  prompt: text('prompt'),              // 作成のきっかけとなった指示・依頼文
  content: text('content'),            // レポート・調査結果などの本文（Markdown可）
  url: text('url'),                    // Webアーティファクト (localhost:8888/xxx など)
  file_path: text('file_path'),        // ファイルアーティファクト
  tags: text('tags').array(),
  meta: jsonb('meta'),                 // 追加メタデータ (サイズ、言語、ステータスなど)
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_artifacts_company').on(table.company_id),
  idxSession: index('idx_artifacts_session').on(table.session_id),
  idxType: index('idx_artifacts_type').on(table.type),
}));
