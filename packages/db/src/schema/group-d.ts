import {
  pgTable, text, varchar, timestamp, uuid, index, integer
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';

// D1: goals
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  deadline: timestamp('deadline'),
  status: varchar('status', { length: 20 }).default('in_progress'),
  progress: integer('progress').default(0), // 達成率 0-100
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_goals_company').on(table.company_id),
}));

// D2: projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_projects_company').on(table.company_id),
}));

// D3: project_goals
export const project_goals = pgTable('project_goals', {
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  goal_id: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
});

// D4: project_workspaces
export const project_workspaces = pgTable('project_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxProject: index('idx_workspaces_project').on(table.project_id),
}));
