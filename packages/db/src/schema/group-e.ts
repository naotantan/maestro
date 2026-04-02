import {
  pgTable, varchar, integer, timestamp, uuid, decimal, boolean, index, text
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';
import { agents } from './group-b';

// E1: cost_events
export const cost_events = pgTable('cost_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  model: varchar('model', { length: 100 }).notNull(),
  input_tokens: integer('input_tokens').notNull(),
  output_tokens: integer('output_tokens').notNull(),
  cost_usd: decimal('cost_usd', { precision: 10, scale: 4 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxAgent: index('idx_costs_agent').on(table.agent_id),
  idxCreatedAt: index('idx_costs_created_at').on(table.created_at),
}));

// E2: budget_policies
export const budget_policies = pgTable('budget_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  limit_amount_usd: decimal('limit_amount_usd', { precision: 10, scale: 2 }).notNull(),
  period: varchar('period', { length: 20 }).default('monthly'),
  alert_threshold: decimal('alert_threshold', { precision: 3, scale: 2 }).default('0.80'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_budget_company').on(table.company_id),
}));

// E3: budget_incidents
export const budget_incidents = pgTable('budget_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  exceeded_at: timestamp('exceeded_at').defaultNow(),
  amount_usd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
  auto_stopped: boolean('auto_stopped').default(false),
}, (table) => ({
  idxAgent: index('idx_incidents_agent').on(table.agent_id),
}));

// E4: finance_events
export const finance_events = pgTable('finance_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  amount_usd: decimal('amount_usd', { precision: 10, scale: 2 }),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_finance_company').on(table.company_id),
}));
