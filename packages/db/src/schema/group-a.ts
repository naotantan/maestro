import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  uuid,
  json,
  boolean,
  decimal,
  index,
  foreignKey,
  unique,
} from 'drizzle-orm/pg-core';

// ============================================================
// A1: companies — 企業（組織）マスタ
// ============================================================
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  created_by: uuid('created_by'),
}, (table) => ({
  idxCreatedAt: index('idx_companies_created_at').on(table.created_at),
}));

// ============================================================
// A2: users — ユーザーマスタ
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxEmail: index('idx_users_email').on(table.email),
}));

// ============================================================
// A3: company_memberships — 企業↔ユーザー関連付け
// ============================================================
export const company_memberships = pgTable('company_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull().default('member'), // 'admin', 'member', 'viewer'
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_memberships_company_id').on(table.company_id),
  idxUser: index('idx_memberships_user_id').on(table.user_id),
  uniqueMembership: unique('unique_membership').on(table.company_id, table.user_id),
}));

// ============================================================
// A4: board_api_keys — Board（Webダッシュボード）用 APIキー
// ============================================================
export const board_api_keys = pgTable('board_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  key_hash: varchar('key_hash', { length: 255 }).notNull(),
  key_prefix: varchar('key_prefix', { length: 20 }).notNull(), // 'comp_live_' など
  name: varchar('name', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  last_used_at: timestamp('last_used_at'),
  expires_at: timestamp('expires_at'),
}, (table) => ({
  idxCompany: index('idx_board_keys_company').on(table.company_id),
  idxPrefix: index('idx_board_keys_prefix').on(table.key_prefix),
}));

// ============================================================
// A5: agent_api_keys — エージェント用 APIキー
// NOTE: agents テーブルは Group B で定義されるが、
//       マイグレーション順序のため外部キー制約は後から追加する
// ============================================================
export const agent_api_keys = pgTable('agent_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull(), // FK to agents.id (Group B)
  key_hash: varchar('key_hash', { length: 255 }).notNull(),
  key_prefix: varchar('key_prefix', { length: 20 }).notNull(), // 'agent_live_' など
  name: varchar('name', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  last_used_at: timestamp('last_used_at'),
  expires_at: timestamp('expires_at'),
}, (table) => ({
  idxAgent: index('idx_agent_keys_agent').on(table.agent_id),
  idxPrefix: index('idx_agent_keys_prefix').on(table.key_prefix),
}));

// ============================================================
// A6: cli_auth_challenges — CLI 認証フロー（OAuth Device Flow）
// ============================================================
export const cli_auth_challenges = pgTable('cli_auth_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id'),
  device_code: varchar('device_code', { length: 50 }).notNull().unique(),
  user_code: varchar('user_code', { length: 10 }).notNull(),
  // 'pending' | 'approved' | 'denied'
  status: varchar('status', { length: 20 }).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  approved_at: timestamp('approved_at'),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  idxCompany: index('idx_cli_challenges_company').on(table.company_id),
  idxDeviceCode: index('idx_cli_challenges_device').on(table.device_code),
  idxStatus: index('idx_cli_challenges_status').on(table.status),
}));

// ============================================================
// A7: permission_grants — 権限管理（RBAC）
// ============================================================
export const permission_grants = pgTable('permission_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  principal_id: uuid('principal_id').notNull(), // user_id or role_id
  principal_type: varchar('principal_type', { length: 20 }).notNull(), // 'user', 'role'
  resource_id: uuid('resource_id').notNull(), // company_id, project_id, etc.
  resource_type: varchar('resource_type', { length: 50 }).notNull(), // 'companies', 'agents', etc.
  action: varchar('action', { length: 50 }).notNull(), // 'read', 'write', 'admin', 'delete'
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPrincipal: index('idx_perms_principal').on(table.principal_id),
  idxResource: index('idx_perms_resource').on(table.resource_id),
}));

// ============================================================
// A8: company_invites — 企業への招待
// ============================================================
export const company_invites = pgTable('company_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  // 'pending' | 'accepted' | 'declined'
  status: varchar('status', { length: 20 }).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  accepted_at: timestamp('accepted_at'),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  idxCompany: index('idx_invites_company').on(table.company_id),
  idxToken: index('idx_invites_token').on(table.token),
}));

// ============================================================
// A9: join_requests — ユーザーによる企業参加リクエスト
// ============================================================
export const join_requests = pgTable('join_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'pending' | 'approved' | 'denied'
  status: varchar('status', { length: 20 }).default('pending'),
  message: text('message'),
  created_at: timestamp('created_at').defaultNow(),
  reviewed_at: timestamp('reviewed_at'),
  reviewed_by: uuid('reviewed_by'),
}, (table) => ({
  idxCompany: index('idx_join_requests_company').on(table.company_id),
  idxUser: index('idx_join_requests_user').on(table.user_id),
}));

// ============================================================
// A10: sessions — ユーザーセッション（Better Auth セッション管理）
// ============================================================
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  idxUser: index('idx_sessions_user').on(table.user_id),
  idxToken: index('idx_sessions_token').on(table.token),
  idxExpires: index('idx_sessions_expires').on(table.expires_at),
}));
