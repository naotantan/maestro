import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, json, index
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';
import { agents } from './group-b';

// H1: plugins
export const plugins = pgTable('plugins', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  repository_url: text('repository_url'),
  version: varchar('version', { length: 20 }).default('1.0.0'),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_plugins_company').on(table.company_id),
}));

// H2: plugin_config
export const plugin_config = pgTable('plugin_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  config: json('config').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_plugin_config_plugin').on(table.plugin_id),
}));

// H3: plugin_state
export const plugin_state = pgTable('plugin_state', {
  plugin_id: uuid('plugin_id').primaryKey().references(() => plugins.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').default(true),
  last_run: timestamp('last_run'),
  error_count: integer('error_count').default(0),
});

// H4: plugin_entities
export const plugin_entities = pgTable('plugin_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  entity_type: varchar('entity_type', { length: 100 }).notNull(),
  entity_id: uuid('entity_id'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_entities_plugin').on(table.plugin_id),
}));

// H5: plugin_jobs
export const plugin_jobs = pgTable('plugin_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  schedule: varchar('schedule', { length: 100 }),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_jobs_plugin').on(table.plugin_id),
}));

// H6: plugin_job_runs
export const plugin_job_runs = pgTable('plugin_job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_id: uuid('job_id').notNull().references(() => plugin_jobs.id, { onDelete: 'cascade' }),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'),
  error_message: text('error_message'),
}, (table) => ({
  idxJob: index('idx_runs_job').on(table.job_id),
}));

// H7: plugin_logs
export const plugin_logs = pgTable('plugin_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_run_id: uuid('job_run_id').notNull().references(() => plugin_job_runs.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 20 }).default('info'),
  message: text('message').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxJobRun: index('idx_logs_jobrun').on(table.job_run_id),
}));

// H8: plugin_webhooks
export const plugin_webhooks = pgTable('plugin_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: json('events').notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_webhooks_plugin').on(table.plugin_id),
}));

// H9: activity_log
export const activity_log = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  actor_id: uuid('actor_id'),
  entity_type: varchar('entity_type', { length: 50 }).notNull(),
  entity_id: uuid('entity_id'),
  action: varchar('action', { length: 50 }).notNull(),
  changes: json('changes'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_activity_company').on(table.company_id),
  idxCreatedAt: index('idx_activity_created_at').on(table.created_at),
}));

// H10: feedback_votes
export const feedback_votes = pgTable('feedback_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity_id: uuid('entity_id').notNull(),
  user_id: uuid('user_id').notNull(),
  vote: integer('vote').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxEntity: index('idx_votes_entity').on(table.entity_id),
  idxUser: index('idx_votes_user').on(table.user_id),
}));

// H12: agent_handoffs — エージェント間引き継ぎ
export const agent_handoffs = pgTable('agent_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  from_agent_id: uuid('from_agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  to_agent_id: uuid('to_agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  issue_id: uuid('issue_id'),  // 任意: issues への参照（循環参照を避けFKなし）
  // pending → running → completed / failed / cancelled
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  prompt: text('prompt').notNull(),          // to_agent へのタスク指示
  context: text('context'),                  // from_agent の最新出力（エンジンがセット）
  result: text('result'),                    // to_agent の実行結果
  error: text('error'),                      // 失敗時エラー内容
  created_at: timestamp('created_at').defaultNow(),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
}, (table) => ({
  idxCompany: index('idx_handoffs_company').on(table.company_id),
  idxStatus: index('idx_handoffs_status').on(table.status),
  idxFromAgent: index('idx_handoffs_from_agent').on(table.from_agent_id),
  idxToAgent: index('idx_handoffs_to_agent').on(table.to_agent_id),
}));

// H11: principal_permission_grants
export const principal_permission_grants = pgTable('principal_permission_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  principal_id: uuid('principal_id').notNull(),
  granted_to_id: uuid('granted_to_id').notNull(),
  permissions: json('permissions').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPrincipal: index('idx_grants_principal').on(table.principal_id),
}));
