import {
  pgTable, text, varchar, integer, timestamp, uuid, index
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// G1: documents
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_documents_company').on(table.company_id),
}));

// G2: document_revisions
export const document_revisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  changed_by: uuid('changed_by'),
  change_reason: text('change_reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxDocument: index('idx_revisions_document').on(table.document_id),
}));

// G3: assets
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id'),
  url: text('url').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  mime_type: varchar('mime_type', { length: 100 }),
  size: integer('size'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_assets_company').on(table.company_id),
}));
