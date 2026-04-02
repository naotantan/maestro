import {
  pgTable, text, varchar, boolean, timestamp, uuid, json, index
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// F1: routines
export const routines = pgTable('routines', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  cron_expression: varchar('cron_expression', { length: 100 }).notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_routines_company').on(table.company_id),
}));

// F2: routine_triggers
export const routine_triggers = pgTable('routine_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  routine_id: uuid('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  condition: json('condition').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxRoutine: index('idx_triggers_routine').on(table.routine_id),
}));

// F3: routine_runs
export const routine_runs = pgTable('routine_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  routine_id: uuid('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  executed_at: timestamp('executed_at').defaultNow(),
  status: varchar('status', { length: 20 }).default('success'),
  error_message: text('error_message'),
}, (table) => ({
  idxRoutine: index('idx_runs_routine').on(table.routine_id),
}));
