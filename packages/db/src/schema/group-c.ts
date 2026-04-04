import {
  pgTable, text, varchar, integer, timestamp, uuid, index, primaryKey, unique
} from 'drizzle-orm/pg-core';
import { companies } from './group-a';
import { projects } from './group-d';

// C1: issues
export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // どのプロジェクトに属するか（nullable = 組織横断の課題）
  project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  identifier: varchar('identifier', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('backlog'),
  priority: integer('priority').default(1),
  assigned_to: uuid('assigned_to'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  completed_at: timestamp('completed_at'),
}, (table) => ({
  idxCompany: index('idx_issues_company').on(table.company_id),
  idxProject: index('idx_issues_project').on(table.project_id),
  idxIdentifier: index('idx_issues_identifier').on(table.identifier),
  idxStatus: index('idx_issues_status').on(table.status),
  // 同一組織内で identifier が重複しないよう保証
  uqIdentifier: unique('uq_issues_company_identifier').on(table.company_id, table.identifier),
}));

// C2: issue_comments
export const issue_comments = pgTable('issue_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').notNull(),
  body: text('body').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_comments_issue').on(table.issue_id),
}));

// C3: issue_labels
export const issue_labels = pgTable('issue_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 10 }).default('#808080'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_labels_company').on(table.company_id),
}));

// C4: issue_label_assignments
export const issue_label_assignments = pgTable('issue_label_assignments', {
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  label_id: uuid('label_id').notNull().references(() => issue_labels.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.issue_id, table.label_id] }),
}));

// C5: issue_attachments
export const issue_attachments = pgTable('issue_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  file_url: text('file_url').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  file_size: integer('file_size'),
  mime_type: varchar('mime_type', { length: 100 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_attachments_issue').on(table.issue_id),
}));

// C6: approvals
export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  approver_id: uuid('approver_id').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  decided_at: timestamp('decided_at'),
}, (table) => ({
  idxIssue: index('idx_approvals_issue').on(table.issue_id),
}));

// C7: approval_comments
export const approval_comments = pgTable('approval_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  approval_id: uuid('approval_id').notNull().references(() => approvals.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').notNull(),
  comment: text('comment').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxApproval: index('idx_approval_comments_approval').on(table.approval_id),
}));

// C8: work_products
export const work_products = pgTable('work_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  artifact_url: text('artifact_url').notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_products_issue').on(table.issue_id),
}));

// C9: issue_goals（Issue↔Goal紐付け）
export const issue_goals = pgTable('issue_goals', {
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  goal_id: uuid('goal_id').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.issue_id, table.goal_id] }),
  idxIssue: index('idx_issue_goals_issue').on(table.issue_id),
  idxGoal: index('idx_issue_goals_goal').on(table.goal_id),
}));

// C10: issue_read_states
export const issue_read_states = pgTable('issue_read_states', {
  user_id: uuid('user_id').notNull(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  read_at: timestamp('read_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.user_id, table.issue_id] }),
}));

// C10: inbox_archives
export const inbox_archives = pgTable('inbox_archives', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  archived_at: timestamp('archived_at').defaultNow(),
}, (table) => ({
  idxUser: index('idx_archived_user').on(table.user_id),
  // 同一ユーザーが同一Issueを重複アーカイブしないよう保証
  uqUserIssue: unique('uq_inbox_archives_user_issue').on(table.user_id, table.issue_id),
}));
