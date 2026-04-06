import {
  pgTable, text, varchar, boolean, timestamp, uuid, index
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// M1: webhooks — 外部Webhook設定
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  events: text('events').array().notNull().default([]),
  secret: text('secret'),
  enabled: boolean('enabled').default(true),
  last_triggered_at: timestamp('last_triggered_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_webhooks_company').on(table.company_id),
}));

// M2: notifications — ユーザー通知
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull().default('info'), // 'info' | 'success' | 'warning' | 'error'
  title: varchar('title', { length: 500 }).notNull(),
  message: text('message'),
  entity_type: varchar('entity_type', { length: 50 }), // 'session' | 'job' | 'issue' etc
  entity_id: uuid('entity_id'),
  read: boolean('read').default(false),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_notifications_company').on(table.company_id),
  idxRead: index('idx_notifications_read').on(table.company_id, table.read),
}));
