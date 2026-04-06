import { pgTable, text, varchar, timestamp, uuid, index, integer } from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// K1: playbooks（指示書）
export const playbooks = pgTable('playbooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  task: text('task').notNull(), // 元の依頼文
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_playbooks_company').on(table.company_id),
}));

// K2: playbook_steps（指示書ステップ）
export const playbook_steps = pgTable('playbook_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  playbook_id: uuid('playbook_id').notNull().references(() => playbooks.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  skill: varchar('skill', { length: 255 }),       // 使うスキル名
  label: varchar('label', { length: 200 }).notNull(), // ステップのタイトル
  instruction: text('instruction').notNull(),        // コピーするテキスト（Claude Codeに貼る）
}, (table) => ({
  idxPlaybook: index('idx_playbook_steps_pb').on(table.playbook_id),
}));

// K3: playbook_jobs（fswatch 自動実行ジョブ）
export const playbook_jobs = pgTable('playbook_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  playbook_id: uuid('playbook_id').notNull().references(() => playbooks.id, { onDelete: 'cascade' }),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | running | completed | error
  current_step: integer('current_step').notNull().default(1),
  total_steps: integer('total_steps').notNull(),
  error_message: text('error_message'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_playbook_jobs_company').on(table.company_id),
  idxPlaybook: index('idx_playbook_jobs_playbook').on(table.playbook_id),
}));
