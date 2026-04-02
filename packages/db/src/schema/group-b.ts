import {
  pgTable, text, varchar, integer, timestamp, uuid, json, boolean, index, foreignKey
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// B1: agents
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(true),
  config: json('config'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  last_heartbeat_at: timestamp('last_heartbeat_at'),
}, (table) => ({
  idxCompany: index('idx_agents_company').on(table.company_id),
  idxType: index('idx_agents_type').on(table.type),
}));

// B2: agent_config_revisions
export const agent_config_revisions = pgTable('agent_config_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  config: json('config').notNull(),
  changed_by: uuid('changed_by'),
  change_reason: text('change_reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxAgent: index('idx_config_revisions_agent').on(table.agent_id),
}));

// B3: agent_runtime_state
export const agent_runtime_state = pgTable('agent_runtime_state', {
  agent_id: uuid('agent_id').primaryKey().references(() => agents.id, { onDelete: 'cascade' }),
  state: json('state').notNull(),
  last_task_id: uuid('last_task_id'),
  last_error: text('last_error'),
  updated_at: timestamp('updated_at').defaultNow(),
});

// B4: heartbeat_runs
export const heartbeat_runs = pgTable('heartbeat_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'),
  result_summary: json('result_summary'),
  token_usage: json('token_usage'),
}, (table) => ({
  idxAgent: index('idx_heartbeat_runs_agent').on(table.agent_id),
  idxStatus: index('idx_heartbeat_runs_status').on(table.status),
}));

// B5: heartbeat_run_events
export const heartbeat_run_events = pgTable('heartbeat_run_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  heartbeat_run_id: uuid('heartbeat_run_id').notNull().references(() => heartbeat_runs.id, { onDelete: 'cascade' }),
  event_type: varchar('event_type', { length: 50 }).notNull(),
  log: text('log').notNull(),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxHeartbeat: index('idx_events_heartbeat').on(table.heartbeat_run_id),
  idxEventType: index('idx_events_type').on(table.event_type),
}));

// B6: agent_task_sessions
export const agent_task_sessions = pgTable('agent_task_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  task_id: uuid('task_id').notNull(),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'),
  result: text('result'),
}, (table) => ({
  idxAgent: index('idx_sessions_agent').on(table.agent_id),
  idxTask: index('idx_sessions_task').on(table.task_id),
}));

// B7: agent_wakeup_requests
export const agent_wakeup_requests = pgTable('agent_wakeup_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  requested_at: timestamp('requested_at').defaultNow(),
  wakeup_at: timestamp('wakeup_at').notNull(),
  priority: integer('priority').default(1),
  requested_by: uuid('requested_by'),
}, (table) => ({
  idxAgent: index('idx_wakeup_agent').on(table.agent_id),
  idxPriority: index('idx_wakeup_priority').on(table.priority),
}));

// B8: company_skills
export const company_skills = pgTable('company_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  skill_yaml: text('skill_yaml').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  created_by: uuid('created_by'),
}, (table) => ({
  idxCompany: index('idx_skills_company').on(table.company_id),
}));

// B9: company_secrets
export const company_secrets = pgTable('company_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  encrypted_value: text('encrypted_value').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_secrets_company').on(table.company_id),
}));

// B10: secret_versions
export const secret_versions = pgTable('secret_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  secret_id: uuid('secret_id').notNull().references(() => company_secrets.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  encrypted_value: text('encrypted_value').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxSecret: index('idx_versions_secret').on(table.secret_id),
}));

// B11: agent_approvals (エージェントによる承認要求)
export const agent_approvals = pgTable('agent_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  action_type: varchar('action_type', { length: 100 }).notNull(),
  action_params: json('action_params'),
  status: varchar('status', { length: 20 }).default('pending'),
  requested_at: timestamp('requested_at').defaultNow(),
  decided_at: timestamp('decided_at'),
  decided_by: uuid('decided_by'),
}, (table) => ({
  idxAgent: index('idx_agent_approvals_agent').on(table.agent_id),
  idxStatus: index('idx_agent_approvals_status').on(table.status),
}));

// B12: execution_workspaces (エージェント実行ワークスペース)
export const execution_workspaces = pgTable('execution_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  task_id: uuid('task_id'),
  workspace_path: text('workspace_path'),
  status: varchar('status', { length: 20 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
  ended_at: timestamp('ended_at'),
}, (table) => ({
  idxAgent: index('idx_workspaces_agent').on(table.agent_id),
}));
