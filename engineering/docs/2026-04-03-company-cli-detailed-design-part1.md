# .company CLI 詳細設計書 Part1 — DB詳細設計（DDL）+ API詳細仕様（W3）

**作成日**: 2026-04-03
**担当**: 開発部 第1課（Omar × Hana × David Park）
**版**: v2.0
**ステータス**: 詳細設計確定版
**関連W2**: engineering/docs/2026-04-03-company-cli-basic-design.md
**関連W1**: consulting/reviews/2026-04-03-company-cli-requirements.md

---

## 概要

本ドキュメントは W2 基本設計書に記載された 61テーブルの完全な DDL（Data Definition Language）と、100+ エンドポイントの API 仕様を定義する。
Drizzle ORM（TypeScript）のスキーマ形式で DDL を記述し、全エンドポイントの HTTP メソッド・パス・リクエスト/レスポンス・認証要件・エラーコードを明記する。

**対象読者**: 開発部全課（第1課: 設計審査 / 第2課: 実装 / 第3課: QA / 第4課: ドキュメント管理）

---

## 1. DB詳細設計（DDL）

### 前提：Drizzle ORM スキーマ形式

本セクションでは、全テーブルを Drizzle ORM の `pgTable` 関数を使った TypeScript 形式で記述する。

```typescript
import { pgTable, serial, text, varchar, integer, timestamp, uuid, json, boolean, decimal, index, foreignKey } from 'drizzle-orm/pg-core';

// 構成: テーブル定義 + インデックス + 外部キー制約
const tableName = pgTable('table_name', {
  // カラム定義
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at').defaultNow(),
  // ...
}, (table) => ({
  // インデックス・制約定義
  idxName: index('idx_name').on(table.field),
  fkName: foreignKey({ columns: [table.fk_id], foreignColumns: [otherTable.id] }),
}));
```

---

### 1.1 グループA: 組織・認証系（10テーブル）

#### A1: companies
```typescript
const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  created_by: uuid('created_by'),
  settings: json('settings').$type<{
    defaultAgentType?: string;
    anthropicApiKey?: string;
    backup?: Record<string, unknown>;
  }>().default({}),
}, (table) => ({
  idxName: index('idx_companies_created_at').on(table.created_at),
}));
```

**用途**: 企業（組織）マスタ
**キャラクタリスティクス**:
- `id`: 主キー（UUID）
- `name`: 企業名（255文字以下）
- `description`: 説明文
- `created_at`: 作成日時（デフォルト: 現在時刻）
- `created_by`: 作成者（user_id）
- `settings`: 組織設定JSON（エージェントモード・APIキー・バックアップ設定など）

---

#### A2: users
```typescript
const users = pgTable('users', {
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
```

**用途**: ユーザーマスタ
**特記**:
- `email`: ユニーク（複数登録不可）
- `password_hash`: bcrypt ハッシュ化済み値

---

#### A3: company_memberships
```typescript
const company_memberships = pgTable('company_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  user_id: uuid('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 50 }).notNull(), // 'admin', 'member', 'viewer'
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_memberships_company_id').on(table.company_id),
  idxUser: index('idx_memberships_user_id').on(table.user_id),
  fkCompany: foreignKey({ columns: [table.company_id], foreignColumns: [companies.id] }),
  fkUser: foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
}));
```

**用途**: 企業 ←→ ユーザーの関連付け
**ロール**: admin / member / viewer

---

#### A4: board_api_keys
```typescript
const board_api_keys = pgTable('board_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  key_hash: varchar('key_hash', { length: 255 }).notNull(),
  key_prefix: varchar('key_prefix', { length: 10 }).notNull(), // 'comp_' など
  name: varchar('name', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  last_used_at: timestamp('last_used_at'),
  expires_at: timestamp('expires_at'),
}, (table) => ({
  idxCompany: index('idx_board_keys_company').on(table.company_id),
  idxPrefix: index('idx_board_keys_prefix').on(table.key_prefix),
  fkCompany: foreignKey({ columns: [table.company_id], foreignColumns: [companies.id] }),
}));
```

**用途**: Board（Webダッシュボード）用 APIキー
**認証**: キーハッシュをDB保存、平文は返却のみ（1度のみ）
**name フォーマット**:
- register時: `user:{userId}:初期キー`
- login時: `user:{userId}:login`
- /api/companies/:id/api-keys 経由の作成時: `user:{userId}:{指定名}`（userIdがある場合）

---

#### A5: agent_api_keys
```typescript
const agent_api_keys = pgTable('agent_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  key_hash: varchar('key_hash', { length: 255 }).notNull(),
  key_prefix: varchar('key_prefix', { length: 10 }).notNull(), // 'agent_' など
  name: varchar('name', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  last_used_at: timestamp('last_used_at'),
  expires_at: timestamp('expires_at'),
}, (table) => ({
  idxAgent: index('idx_agent_keys_agent').on(table.agent_id),
  idxPrefix: index('idx_agent_keys_prefix').on(table.key_prefix),
}));
```

**用途**: エージェント用 APIキー
**暗号化**: シークレット値は AES-256-GCM で暗号化

---

#### A6: cli_auth_challenges
```typescript
const cli_auth_challenges = pgTable('cli_auth_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  user_id: uuid('user_id'),
  device_code: varchar('device_code', { length: 50 }).notNull().unique(),
  user_code: varchar('user_code', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'approved', 'denied'
  created_at: timestamp('created_at').defaultNow(),
  approved_at: timestamp('approved_at'),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  idxCompany: index('idx_cli_challenges_company').on(table.company_id),
  idxDeviceCode: index('idx_cli_challenges_device').on(table.device_code),
  idxStatus: index('idx_cli_challenges_status').on(table.status),
  fkCompany: foreignKey({ columns: [table.company_id], foreignColumns: [companies.id] }),
}));
```

**用途**: CLI 認証フロー（OAuth Device Flow）
**ライフサイクル**: 15分以内に approved/denied に遷移

---

#### A7: permission_grants
```typescript
const permission_grants = pgTable('permission_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  principal_id: uuid('principal_id').notNull(), // user_id or role_id
  principal_type: varchar('principal_type', { length: 20 }).notNull(), // 'user', 'role'
  resource_id: uuid('resource_id').notNull(), // company_id, project_id, etc
  resource_type: varchar('resource_type', { length: 50 }).notNull(), // 'companies', 'agents', 'issues'
  action: varchar('action', { length: 50 }).notNull(), // 'read', 'write', 'admin'
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPrincipal: index('idx_perms_principal').on(table.principal_id),
  idxResource: index('idx_perms_resource').on(table.resource_id),
}));
```

**用途**: 権限管理（RBAC ベース）
**アクション**: read / write / admin / delete

---

#### A8: company_invites
```typescript
const company_invites = pgTable('company_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'accepted', 'declined'
  created_at: timestamp('created_at').defaultNow(),
  accepted_at: timestamp('accepted_at'),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  idxCompany: index('idx_invites_company').on(table.company_id),
  idxToken: index('idx_invites_token').on(table.token),
  fkCompany: foreignKey({ columns: [table.company_id], foreignColumns: [companies.id] }),
}));
```

**用途**: 企業への招待メール送信

---

#### A9: join_requests
```typescript
const join_requests = pgTable('join_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  user_id: uuid('user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'approved', 'denied'
  message: text('message'),
  created_at: timestamp('created_at').defaultNow(),
  reviewed_at: timestamp('reviewed_at'),
  reviewed_by: uuid('reviewed_by'),
}, (table) => ({
  idxCompany: index('idx_join_requests_company').on(table.company_id),
  idxUser: index('idx_join_requests_user').on(table.user_id),
  fkCompany: foreignKey({ columns: [table.company_id], foreignColumns: [companies.id] }),
  fkUser: foreignKey({ columns: [table.user_id], foreignColumns: [users.id] }),
}));
```

**用途**: ユーザーが企業への参加をリクエスト

---

### 1.2 グループB: エージェント・スキル系（12テーブル）

#### B1: agents
```typescript
const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'claude_local', 'cursor', 'gemini_local', etc
  enabled: boolean('enabled').default(true),
  config: json('config'), // latest config (JSON)
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  last_heartbeat_at: timestamp('last_heartbeat_at'),
}, (table) => ({
  idxCompany: index('idx_agents_company').on(table.company_id),
  idxType: index('idx_agents_type').on(table.type),
}));
```

**用途**: エージェントマスタ
**type**: claude_local / codex_local / cursor / gemini_local / openclaw_gateway / opencode_local / pi_local

---

#### B2: agent_config_revisions
```typescript
const agent_config_revisions = pgTable('agent_config_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  version: integer('version').notNull(),
  config: json('config').notNull(), // 設定内容（YAML形式を JSON化）
  changed_by: uuid('changed_by'),
  change_reason: text('change_reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxAgent: index('idx_config_revisions_agent').on(table.agent_id),
  uniqueVersion: ({ agent_id, version }) => `unique_agent_version_${agent_id}_${version}`,
}));
```

**用途**: エージェント設定の版管理

---

#### B3: agent_runtime_state
```typescript
const agent_runtime_state = pgTable('agent_runtime_state', {
  agent_id: uuid('agent_id').primaryKey().references(() => agents.id),
  state: json('state').notNull(), // { status: 'idle'/'running'/'error', ... }
  last_task_id: uuid('last_task_id'),
  last_error: text('last_error'),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  fkAgent: foreignKey({ columns: [table.agent_id], foreignColumns: [agents.id] }),
}));
```

**用途**: エージェント実行時状態（最新1件のみ）

---

#### B4: heartbeat_runs
```typescript
const heartbeat_runs = pgTable('heartbeat_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'), // 'running', 'success', 'error'
  result_summary: json('result_summary'),
  token_usage: json('token_usage'), // { input: N, output: N, cost: X }
}, (table) => ({
  idxAgent: index('idx_heartbeat_runs_agent').on(table.agent_id),
  idxStatus: index('idx_heartbeat_runs_status').on(table.status),
}));
```

**用途**: ハートビート実行ログ

---

#### B5: heartbeat_run_events
```typescript
const heartbeat_run_events = pgTable('heartbeat_run_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  heartbeat_run_id: uuid('heartbeat_run_id').notNull().references(() => heartbeat_runs.id),
  event_type: varchar('event_type', { length: 50 }).notNull(), // 'task_started', 'tool_called', 'error'
  log: text('log').notNull(),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxHeartbeat: index('idx_events_heartbeat').on(table.heartbeat_run_id),
  idxEventType: index('idx_events_type').on(table.event_type),
}));
```

**用途**: ハートビート中のイベントログ

---

#### B6: agent_task_sessions
```typescript
const agent_task_sessions = pgTable('agent_task_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  task_id: uuid('task_id').notNull(), // issues.id
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'),
  result: text('result'),
}, (table) => ({
  idxAgent: index('idx_sessions_agent').on(table.agent_id),
  idxTask: index('idx_sessions_task').on(table.task_id),
}));
```

**用途**: エージェント ←→ タスク（Issue）の実行セッション

---

#### B7: agent_wakeup_requests
```typescript
const agent_wakeup_requests = pgTable('agent_wakeup_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  requested_at: timestamp('requested_at').defaultNow(),
  wakeup_at: timestamp('wakeup_at').notNull(),
  priority: integer('priority').default(1), // 1=normal, 2=high, 3=critical
  requested_by: uuid('requested_by'),
}, (table) => ({
  idxAgent: index('idx_wakeup_agent').on(table.agent_id),
  idxPriority: index('idx_wakeup_priority').on(table.priority),
}));
```

**用途**: エージェントの強制起動リクエスト

---

#### B8: company_skills
```typescript
const company_skills = pgTable('company_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  skill_yaml: text('skill_yaml').notNull(), // Skill定義（YAML）
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  created_by: uuid('created_by'),
}, (table) => ({
  idxCompany: index('idx_skills_company').on(table.company_id),
}));
```

**用途**: カスタムスキルの登録管理

---

#### B9: company_secrets
```typescript
const company_secrets = pgTable('company_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  encrypted_value: text('encrypted_value').notNull(), // AES-256-GCM
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_secrets_company').on(table.company_id),
}));
```

**用途**: シークレット保存（暗号化）

---

#### B10: secret_versions
```typescript
const secret_versions = pgTable('secret_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  secret_id: uuid('secret_id').notNull().references(() => company_secrets.id),
  version: integer('version').notNull(),
  encrypted_value: text('encrypted_value').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxSecret: index('idx_versions_secret').on(table.secret_id),
}));
```

**用途**: シークレットの版管理

---

### 1.3 グループC: Issue・ゴール系（10テーブル）

#### C1: issues
```typescript
const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  identifier: varchar('identifier', { length: 20 }).notNull(), // 'COMP-001', 'COMP-002', etc
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('backlog'), // 'backlog', 'in_progress', 'done'
  priority: integer('priority').default(1), // 1=low, 2=normal, 3=high
  assigned_to: uuid('assigned_to'), // agent_id
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  completed_at: timestamp('completed_at'),
}, (table) => ({
  idxCompany: index('idx_issues_company').on(table.company_id),
  idxIdentifier: index('idx_issues_identifier').on(table.identifier),
  idxStatus: index('idx_issues_status').on(table.status),
}));
```

**用途**: Issue マスタ
**identifier**: COMP-001 形式で自動採番

---

#### C2: issue_comments
```typescript
const issue_comments = pgTable('issue_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  author_id: uuid('author_id').notNull(),
  body: text('body').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_comments_issue').on(table.issue_id),
}));
```

**用途**: Issue コメント

---

#### C3: issue_labels
```typescript
const issue_labels = pgTable('issue_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 10 }).default('#808080'), // HEX color
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_labels_company').on(table.company_id),
}));
```

**用途**: Issue ラベルマスタ

---

#### C4: issue_label_assignments
```typescript
const issue_label_assignments = pgTable('issue_label_assignments', {
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  label_id: uuid('label_id').notNull().references(() => issue_labels.id),
  created_at: timestamp('created_at').defaultNow(),
});
```

**用途**: Issue ←→ Label の関連付け（中間テーブル）

---

#### C5: issue_attachments
```typescript
const issue_attachments = pgTable('issue_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  file_url: text('file_url').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  file_size: integer('file_size'),
  mime_type: varchar('mime_type', { length: 100 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_attachments_issue').on(table.issue_id),
}));
```

**用途**: Issue 添付ファイル

---

#### C6: approvals
```typescript
const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  approver_id: uuid('approver_id').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'approved', 'rejected'
  created_at: timestamp('created_at').defaultNow(),
  decided_at: timestamp('decided_at'),
}, (table) => ({
  idxIssue: index('idx_approvals_issue').on(table.issue_id),
}));
```

**用途**: Issue 承認フロー

---

#### C7: approval_comments
```typescript
const approval_comments = pgTable('approval_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  approval_id: uuid('approval_id').notNull().references(() => approvals.id),
  author_id: uuid('author_id').notNull(),
  comment: text('comment').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxApproval: index('idx_approval_comments_approval').on(table.approval_id),
}));
```

**用途**: 承認コメント

---

#### C8: work_products
```typescript
const work_products = pgTable('work_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  artifact_url: text('artifact_url').notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxIssue: index('idx_products_issue').on(table.issue_id),
}));
```

**用途**: Issue の成果物リンク

---

#### C9: issue_read_states
```typescript
const issue_read_states = pgTable('issue_read_states', {
  user_id: uuid('user_id').notNull(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  read_at: timestamp('read_at').defaultNow(),
});
```

**用途**: Issue の既読状態管理

---

#### C10: inbox_archives
```typescript
const inbox_archives = pgTable('inbox_archives', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  issue_id: uuid('issue_id').notNull().references(() => issues.id),
  archived_at: timestamp('archived_at').defaultNow(),
}, (table) => ({
  idxUser: index('idx_archived_user').on(table.user_id),
}));
```

**用途**: インボックスアーカイブ

---

### 1.4 グループD: Goals・Projects（4テーブル）

#### D1: goals
```typescript
const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  deadline: timestamp('deadline'),
  status: varchar('status', { length: 20 }).default('in_progress'), // 'in_progress', 'completed'
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_goals_company').on(table.company_id),
}));
```

**用途**: ゴールマスタ

---

#### D2: projects
```typescript
const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_projects_company').on(table.company_id),
}));
```

**用途**: プロジェクトマスタ

---

#### D3: project_goals
```typescript
const project_goals = pgTable('project_goals', {
  project_id: uuid('project_id').notNull().references(() => projects.id),
  goal_id: uuid('goal_id').notNull().references(() => goals.id),
});
```

**用途**: Project ←→ Goal の関連付け

---

#### D4: project_workspaces
```typescript
const project_workspaces = pgTable('project_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'), // Wiki/Notes形式の自由記述
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxProject: index('idx_workspaces_project').on(table.project_id),
}));
```

**用途**: プロジェクトのWiki/Notes

---

### 1.5 グループE: Cost・Budget（4テーブル）

#### E1: cost_events
```typescript
const cost_events = pgTable('cost_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  model: varchar('model', { length: 100 }).notNull(), // 'claude-3-opus', etc
  input_tokens: integer('input_tokens').notNull(),
  output_tokens: integer('output_tokens').notNull(),
  cost_usd: decimal('cost_usd', { precision: 10, scale: 4 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxAgent: index('idx_costs_agent').on(table.agent_id),
  idxCreatedAt: index('idx_costs_created_at').on(table.created_at),
}));
```

**用途**: ハートビート / タスク実行時のコスト記録

---

#### E2: budget_policies
```typescript
const budget_policies = pgTable('budget_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  limit_amount_usd: decimal('limit_amount_usd', { precision: 10, scale: 2 }).notNull(),
  period: varchar('period', { length: 20 }).default('monthly'), // 'monthly', 'yearly'
  alert_threshold: decimal('alert_threshold', { precision: 3, scale: 2 }).default('0.80'), // 80%
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_budget_company').on(table.company_id),
}));
```

**用途**: 月次予算ポリシー

---

#### E3: budget_incidents
```typescript
const budget_incidents = pgTable('budget_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id),
  exceeded_at: timestamp('exceeded_at').defaultNow(),
  amount_usd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
  auto_stopped: boolean('auto_stopped').default(false),
}, (table) => ({
  idxAgent: index('idx_incidents_agent').on(table.agent_id),
}));
```

**用途**: 予算超過アラート・自動停止ログ

---

#### E4: finance_events
```typescript
const finance_events = pgTable('finance_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  type: varchar('type', { length: 50 }).notNull(), // 'invoice_generated', 'payment_received', 'refund'
  amount_usd: decimal('amount_usd', { precision: 10, scale: 2 }),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_finance_company').on(table.company_id),
}));
```

**用途**: 請求・支払いイベント

---

### 1.6 グループF: Routines（3テーブル）

#### F1: routines
```typescript
const routines = pgTable('routines', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  cron_expression: varchar('cron_expression', { length: 100 }).notNull(), // '0 9 * * *'
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_routines_company').on(table.company_id),
}));
```

**用途**: 定期実行タスク

---

#### F2: routine_triggers
```typescript
const routine_triggers = pgTable('routine_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  routine_id: uuid('routine_id').notNull().references(() => routines.id),
  condition: json('condition').notNull(), // トリガー条件（JSON）
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxRoutine: index('idx_triggers_routine').on(table.routine_id),
}));
```

**用途**: ルーティンのトリガー条件

---

#### F3: routine_runs
```typescript
const routine_runs = pgTable('routine_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  routine_id: uuid('routine_id').notNull().references(() => routines.id),
  executed_at: timestamp('executed_at').defaultNow(),
  status: varchar('status', { length: 20 }).default('success'), // 'success', 'error'
  error_message: text('error_message'),
}, (table) => ({
  idxRoutine: index('idx_runs_routine').on(table.routine_id),
}));
```

**用途**: ルーティン実行履歴

---

### 1.7 グループG: Documents・Assets（6テーブル）

#### G1: documents
```typescript
const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('draft'), // 'draft', 'published'
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_documents_company').on(table.company_id),
}));
```

**用途**: ドキュメント（Wiki）

---

#### G2: document_revisions
```typescript
const document_revisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id').notNull().references(() => documents.id),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  changed_by: uuid('changed_by'),
  change_reason: text('change_reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxDocument: index('idx_revisions_document').on(table.document_id),
}));
```

**用途**: ドキュメント版管理

---

#### G3: assets
```typescript
const assets = pgTable('assets', {
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
```

**用途**: メディアファイル（画像・ドキュメント等）

---

### 1.8 グループH: Plugins・Audit（11テーブル）

#### H1: plugins
```typescript
const plugins = pgTable('plugins', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
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
```

**用途**: プラグイン登録

---

#### H2: plugin_config
```typescript
const plugin_config = pgTable('plugin_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id),
  config: json('config').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_plugin_config_plugin').on(table.plugin_id),
}));
```

**用途**: プラグイン設定

---

#### H3: plugin_state
```typescript
const plugin_state = pgTable('plugin_state', {
  plugin_id: uuid('plugin_id').primaryKey().references(() => plugins.id),
  enabled: boolean('enabled').default(true),
  last_run: timestamp('last_run'),
  error_count: integer('error_count').default(0),
}, (table) => ({
  fkPlugin: foreignKey({ columns: [table.plugin_id], foreignColumns: [plugins.id] }),
}));
```

**用途**: プラグイン状態

---

#### H4: plugin_entities
```typescript
const plugin_entities = pgTable('plugin_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id),
  entity_type: varchar('entity_type', { length: 100 }).notNull(),
  entity_id: uuid('entity_id'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_entities_plugin').on(table.plugin_id),
}));
```

**用途**: プラグイン管理エンティティ

---

#### H5: plugin_jobs
```typescript
const plugin_jobs = pgTable('plugin_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id),
  name: varchar('name', { length: 255 }).notNull(),
  schedule: varchar('schedule', { length: 100 }), // cron format
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_jobs_plugin').on(table.plugin_id),
}));
```

**用途**: プラグインジョブ定義

---

#### H6: plugin_job_runs
```typescript
const plugin_job_runs = pgTable('plugin_job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_id: uuid('job_id').notNull().references(() => plugin_jobs.id),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 20 }).default('running'), // 'running', 'success', 'error'
  error_message: text('error_message'),
}, (table) => ({
  idxJob: index('idx_runs_job').on(table.job_id),
}));
```

**用途**: プラグインジョブ実行履歴

---

#### H7: plugin_logs
```typescript
const plugin_logs = pgTable('plugin_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_run_id: uuid('job_run_id').notNull().references(() => plugin_job_runs.id),
  level: varchar('level', { length: 20 }).default('info'), // 'debug', 'info', 'warn', 'error'
  message: text('message').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxJobRun: index('idx_logs_jobrun').on(table.job_run_id),
}));
```

**用途**: プラグインログ

---

#### H8: plugin_webhooks
```typescript
const plugin_webhooks = pgTable('plugin_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  plugin_id: uuid('plugin_id').notNull().references(() => plugins.id),
  url: text('url').notNull(),
  events: json('events').notNull(), // ['issue.created', 'issue.updated']
  enabled: boolean('enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPlugin: index('idx_webhooks_plugin').on(table.plugin_id),
}));
```

**用途**: プラグインWebhook設定

---

#### H9: activity_log
```typescript
const activity_log = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id),
  actor_id: uuid('actor_id'),
  entity_type: varchar('entity_type', { length: 50 }).notNull(), // 'issue', 'agent', etc
  entity_id: uuid('entity_id'),
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete'
  changes: json('changes'), // 変更内容
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxCompany: index('idx_activity_company').on(table.company_id),
  idxCreatedAt: index('idx_activity_created_at').on(table.created_at),
}));
```

**用途**: 全操作ログ（監査証跡）

---

#### H10: feedback_votes
```typescript
const feedback_votes = pgTable('feedback_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity_id: uuid('entity_id').notNull(),
  user_id: uuid('user_id').notNull(),
  vote: integer('vote').notNull(), // 1=upvote, -1=downvote
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxEntity: index('idx_votes_entity').on(table.entity_id),
  idxUser: index('idx_votes_user').on(table.user_id),
}));
```

**用途**: フィードバック投票

---

#### H11: principal_permission_grants
```typescript
const principal_permission_grants = pgTable('principal_permission_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  principal_id: uuid('principal_id').notNull(),
  granted_to_id: uuid('granted_to_id').notNull(),
  permissions: json('permissions').notNull(), // ['read', 'write', 'admin']
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxPrincipal: index('idx_grants_principal').on(table.principal_id),
}));
```

**用途**: 権限委譲

---

## 2. APIエンドポイント詳細仕様

### 2.1 認証 API（/api/auth/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 | エラーコード |
|---|--------|---------|---------|----------|---------|-----------|
| 1 | `/api/auth/register` | POST | `{ email, password, name }` | `{ message, apiKey, companyId, companyName, userId, email, name, user, company, warning }` | 不要 | 400(invalid), 409(duplicate) |
| 2 | `/api/auth/login` | POST | `{ email, password }` | `{ apiKey, companyId, companyName, userId, email, name, user, company, companies }` | 不要 | 401(invalid), 422(missing) |
| 3 | `/api/auth/logout` | POST | `{}` | `{ success: true }` | Board key必須 | 401 |
| 4 | `/api/auth/refresh-token` | POST | `{ refresh_token }` | `{ token, expires_at }` | 不要 | 401(expired) |
| 5 | `/api/auth/verify-email` | POST | `{ token }` | `{ verified: true }` | 不要 | 400(invalid) |
| 6 | `/api/auth/cli-device-flow` | POST | `{ company_id }` | `{ device_code, user_code, expires_in }` | 不要 | 404(company) |
| 7 | `/api/auth/cli-device-approve` | POST | `{ device_code }` | `{ approved: true }` | Board key必須 | 404(code) |
| 8 | `/api/auth/cli-token-exchange` | POST | `{ device_code, grant_type }` | `{ access_token, token_type }` | 不要 | 400(invalid) |

---

### 2.2 組織 API（/api/org/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/org` | GET | `{}` | `{ id, name, members_count }` | Board key必須 |
| 2 | `/api/org` | PATCH | `{ name, description }` | `{ id, name, updated_at }` | Board key + admin |
| 3 | `/api/org/members` | GET | `{ limit, offset }` | `{ members: [...], total }` | Board key必須 |
| 4 | `/api/org/members` | POST | `{ email, role }` | `{ id, email, role, invite_token }` | Board key + admin |
| 5 | `/api/org/members/{id}` | PATCH | `{ role }` | `{ id, role }` | Board key + admin |
| 6 | `/api/org/members/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 7 | `/api/org/join-requests` | GET | `{}` | `{ requests: [...] }` | Board key + admin |
| 8 | `/api/org/join-requests/{id}/approve` | POST | `{ role }` | `{ id, status }` | Board key + admin |
| 9 | `/api/org/join-requests/{id}/deny` | POST | `{}` | `{ id, status }` | Board key + admin |

---

### 2.3 エージェント API（/api/agents/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/agents` | GET | `{ limit, offset }` | `{ agents: [...], total }` | Board key必須 |
| 2 | `/api/agents` | POST | `{ name, type, description }` | `{ id, name, type, api_key }` | Board key + admin |
| 3 | `/api/agents/{id}` | GET | `{}` | `{ id, name, type, status, config }` | Board key必須 |
| 4 | `/api/agents/{id}` | PATCH | `{ name, description, config }` | `{ id, updated_at }` | Board key + admin |
| 5 | `/api/agents/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 6 | `/api/agents/{id}/enable` | POST | `{}` | `{ enabled: true }` | Board key + admin |
| 7 | `/api/agents/{id}/disable` | POST | `{}` | `{ enabled: false }` | Board key + admin |
| 8 | `/api/agents/{id}/heartbeat` | POST | `{ result: JSON }` | `{ heartbeat_id, status }` | Agent key必須 |
| 9 | `/api/agents/{id}/wakeup` | POST | `{ priority }` | `{ wakeup_id, scheduled_at }` | Board key + admin |
| 10 | `/api/agents/{id}/heartbeats` | GET | `{ limit }` | `{ heartbeats: [...] }` | Board key必須 |

**エージェントタイプバリデーション（claude_api追加対応）**:
- `type` は以下の8種のいずれかであること: `['claude_local', 'claude_api', 'codex_local', 'cursor', 'gemini_local', 'openclaw_gateway', 'opencode_local', 'pi_local']`
- `type === 'claude_api'` の場合、`config.apiKey` が必須（未指定時: 400）

---

### 2.4 スキル API（/api/skills/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/skills` | GET | `{ limit }` | `{ skills: [...] }` | Board key必須 |
| 2 | `/api/skills` | POST | `{ name, description, yaml }` | `{ id, name, created_at }` | Board key + admin |
| 3 | `/api/skills/{id}` | GET | `{}` | `{ id, name, yaml, created_at }` | Board key必須 |
| 4 | `/api/skills/{id}` | PATCH | `{ name, yaml }` | `{ id, updated_at }` | Board key + admin |
| 5 | `/api/skills/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |

---

### 2.5 Issue API（/api/issues/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/issues` | GET | `{ status, limit, offset }` | `{ issues: [...], total }` | Board key必須 |
| 2 | `/api/issues` | POST | `{ title, description, priority }` | `{ id, identifier, created_at }` | Board key必須 |
| 3 | `/api/issues/{id}` | GET | `{}` | `{ id, identifier, title, status, comments: [...] }` | Board key必須 |
| 4 | `/api/issues/{id}` | PATCH | `{ title, status, assigned_to }` | `{ id, updated_at }` | Board key必須 |
| 5 | `/api/issues/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 6 | `/api/issues/{id}/comments` | POST | `{ body }` | `{ id, author_id, created_at }` | Board key必須 |
| 7 | `/api/issues/{id}/labels` | POST | `{ label_id }` | `{ issue_id, label_id }` | Board key必須 |
| 8 | `/api/issues/{id}/attachments` | POST | `{ file (form) }` | `{ id, filename, file_url }` | Board key必須 |
| 9 | `/api/issues/{id}/approve` | POST | `{ status, comment }` | `{ approval_id, status }` | Board key必須 |

---

### 2.6 ゴール API（/api/goals/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/goals` | GET | `{ limit }` | `{ goals: [...], total }` | Board key必須 |
| 2 | `/api/goals` | POST | `{ name, description, deadline }` | `{ id, name, created_at }` | Board key必須 |
| 3 | `/api/goals/{id}` | GET | `{}` | `{ id, name, status, progress: X% }` | Board key必須 |
| 4 | `/api/goals/{id}` | PATCH | `{ status, deadline }` | `{ id, updated_at }` | Board key必須 |
| 5 | `/api/goals/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |

---

### 2.7 プロジェクト API（/api/projects/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/projects` | GET | `{ limit }` | `{ projects: [...], total }` | Board key必須 |
| 2 | `/api/projects` | POST | `{ name, description }` | `{ id, name, created_at }` | Board key必須 |
| 3 | `/api/projects/{id}` | GET | `{}` | `{ id, name, goals: [...], workspace: { ...} }` | Board key必須 |
| 4 | `/api/projects/{id}` | PATCH | `{ name, description }` | `{ id, updated_at }` | Board key必須 |
| 5 | `/api/projects/{id}/goals` | POST | `{ goal_id }` | `{ project_id, goal_id }` | Board key必須 |

---

### 2.8 承認 API（/api/approvals/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/approvals` | GET | `{ status, limit }` | `{ approvals: [...] }` | Board key必須 |
| 2 | `/api/approvals/{id}` | GET | `{}` | `{ id, issue_id, approver_id, status, comments }` | Board key必須 |
| 3 | `/api/approvals/{id}/approve` | POST | `{ comment }` | `{ status: approved, decided_at }` | Board key必須 |
| 4 | `/api/approvals/{id}/reject` | POST | `{ comment }` | `{ status: rejected, decided_at }` | Board key必須 |

---

### 2.9 コスト API（/api/costs/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/costs/summary` | GET | `{ period: 'monthly'/'yearly' }` | `{ total_usd, by_agent: [...], budget_remaining }` | Board key必須 |
| 2 | `/api/costs/by-agent/{id}` | GET | `{ start_date, end_date }` | `{ agent_id, total_usd, events: [...] }` | Board key必須 |
| 3 | `/api/costs/events` | GET | `{ limit, offset }` | `{ events: [...], total }` | Board key必須 |
| 4 | `/api/budgets` | GET | `{}` | `{ policies: [...], incidents: [...] }` | Board key必須 |
| 5 | `/api/budgets` | PATCH | `{ limit_amount_usd, alert_threshold }` | `{ id, updated_at }` | Board key + admin |

---

### 2.10 アクティビティ API（/api/activity/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/activity` | GET | `{ entity_type, limit, offset }` | `{ logs: [...], total }` | Board key必須 |
| 2 | `/api/activity/{id}` | GET | `{}` | `{ id, actor_id, action, entity_type, changes }` | Board key必須 |

---

### 2.11 ルーティン API（/api/routines/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/routines` | GET | `{ limit }` | `{ routines: [...], total }` | Board key必須 |
| 2 | `/api/routines` | POST | `{ name, cron_expression, enabled }` | `{ id, name, created_at }` | Board key + admin |
| 3 | `/api/routines/{id}` | GET | `{}` | `{ id, name, cron_expression, enabled, last_run }` | Board key必須 |
| 4 | `/api/routines/{id}` | PATCH | `{ name, cron_expression }` | `{ id, updated_at }` | Board key + admin |
| 5 | `/api/routines/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 6 | `/api/routines/{id}/runs` | GET | `{ limit }` | `{ runs: [...] }` | Board key必須 |

---

### 2.12 プラグイン API（/api/plugins/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/plugins` | GET | `{ limit }` | `{ plugins: [...], total }` | Board key必須 |
| 2 | `/api/plugins` | POST | `{ name, repository_url, version }` | `{ id, name, enabled }` | Board key + admin |
| 3 | `/api/plugins/{id}` | GET | `{}` | `{ id, name, config, state, jobs: [...] }` | Board key必須 |
| 4 | `/api/plugins/{id}` | PATCH | `{ config }` | `{ id, updated_at }` | Board key + admin |
| 5 | `/api/plugins/{id}/enable` | POST | `{}` | `{ enabled: true }` | Board key + admin |
| 6 | `/api/plugins/{id}/disable` | POST | `{}` | `{ enabled: false }` | Board key + admin |
| 7 | `/api/plugins/{id}/webhooks` | POST | `{ url, events }` | `{ id, url, enabled }` | Board key + admin |
| 8 | `/api/plugins/{id}/jobs` | GET | `{}` | `{ jobs: [...] }` | Board key必須 |
| 9 | `/api/plugins/{id}/jobs/{job_id}/runs` | GET | `{ limit }` | `{ runs: [...] }` | Board key必須 |

---

### 2.13 シークレット API（/api/secrets/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/secrets` | GET | `{ limit }` | `{ secrets: [...] }` | Board key + admin |
| 2 | `/api/secrets` | POST | `{ name, value }` | `{ id, name }` | Board key + admin |
| 3 | `/api/secrets/{id}` | PATCH | `{ value }` | `{ id, updated_at }` | Board key + admin |
| 4 | `/api/secrets/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 5 | `/api/secrets/{id}/versions` | GET | `{}` | `{ versions: [...] }` | Board key + admin |

---

### 2.14 API キー管理（/api/api-keys/*）

| # | エンドポイント | メソッド | リクエスト | レスポンス | 認証要件 |
|---|--------|---------|---------|----------|---------|
| 1 | `/api/api-keys/board` | GET | `{}` | `{ keys: [...] }` | Board key + admin |
| 2 | `/api/api-keys/board` | POST | `{ name, expires_at }` | `{ id, key, key_prefix }` | Board key + admin |
| 3 | `/api/api-keys/board/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |
| 4 | `/api/api-keys/agent` | GET | `{ agent_id }` | `{ keys: [...] }` | Board key必須 |
| 5 | `/api/api-keys/agent` | POST | `{ agent_id, name }` | `{ id, key, key_prefix }` | Board key + admin |
| 6 | `/api/api-keys/agent/{id}` | DELETE | `{}` | `{ success: true }` | Board key + admin |

---

### 2.15 設定 API（/api/settings/*）

#### GET /api/settings
組織設定を取得する。

**認証**: Board APIキー必須

**レスポンス 200**:
```json
{
  "defaultAgentType": "claude_local",
  "anthropicApiKey": "***masked***",
  "orgName": "My Company",
  "orgDescription": "説明",
  "backup": {
    "enabled": false,
    "scheduleType": "daily",
    "scheduleTime": "03:00",
    "retentionDays": 30,
    "destinationType": "local",
    "localPath": "/backups/company",
    "s3Bucket": null,
    "s3Region": null,
    "gcsBucket": null,
    "compressionType": "gzip",
    "encryptionEnabled": false,
    "includeActivityLog": false,
    "notifyEmail": null,
    "notifyOnFailure": true,
    "notifyOnSuccess": false
  }
}
```

**注意**: `anthropicApiKey` は設定済みの場合 `"***masked***"` として返却する（平文返却禁止）。

---

#### PATCH /api/settings
組織設定を部分更新する（マージ方式）。

**認証**: Board APIキー必須

**リクエストボディ**（全フィールド任意）:
```json
{
  "defaultAgentType": "claude_api",
  "anthropicApiKey": "sk-ant-...",
  "orgName": "Updated Company",
  "orgDescription": "更新された説明",
  "backup": {
    "enabled": true,
    "scheduleType": "daily",
    "scheduleTime": "03:00",
    "retentionDays": 30,
    "destinationType": "s3",
    "s3Bucket": "my-backup-bucket",
    "s3Region": "ap-northeast-1",
    "compressionType": "gzip",
    "encryptionEnabled": true,
    "notifyEmail": "admin@example.com",
    "notifyOnFailure": true,
    "notifyOnSuccess": false
  }
}
```

**バリデーション**:
| フィールド | ルール | エラー |
|-----------|-------|--------|
| `defaultAgentType` | `['claude_local','claude_api','codex_local','cursor','gemini_local','openclaw_gateway','opencode_local','pi_local']` のいずれか | 400 |
| `backup.scheduleType` | `['daily','weekly','monthly']` のいずれか | 400 |
| `backup.scheduleTime` | `HH:mm` 形式（正規表現 `/^([01][0-9]\|2[0-3]):[0-5][0-9]$/`）| 400 |
| `backup.retentionDays` | `[7,14,30,60,90,180,365]` のいずれか | 400 |
| `backup.destinationType` | `['local','s3','gcs']` のいずれか | 400 |
| `backup.localPath`（local選択時） | 必須・`../` 禁止（パストラバーサル防止）| 400 |
| `backup.s3Bucket`（s3選択時） | 必須 | 400 |
| `backup.s3Region`（s3選択時） | 必須 | 400 |
| `backup.gcsBucket`（gcs選択時） | 必須 | 400 |
| `backup.compressionType` | `['none','gzip']` のいずれか | 400 |
| `backup.notifyEmail` | `@` を含む形式 | 400 |

**一貫性チェック（マージ後）**:
- `defaultAgentType === 'claude_api'` かつ `anthropicApiKey` が空/未設定 → 400

**レスポンス 200**: 更新後の設定（GET と同じ形式）

---

## 3. エラーレスポンス仕様

全エンドポイントは以下のエラーレスポンス形式を採用する。

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "入力値が不正です",
    "fields": [
      { "field": "email", "message": "メールアドレスが不正です" }
    ],
    "timestamp": "2026-04-03T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

### エラーコード一覧

| ステータス | コード | 説明 |
|---------|-------|------|
| 400 | VALIDATION_FAILED | リクエストバリデーション失敗 |
| 400 | INVALID_REQUEST | リクエスト形式が不正 |
| 401 | UNAUTHORIZED | 認証失敗 / APIキー無効 |
| 401 | TOKEN_EXPIRED | トークン有効期限切れ |
| 403 | FORBIDDEN | 権限不足 |
| 404 | NOT_FOUND | リソースが見つからない |
| 409 | CONFLICT | リソース重複（メールアドレス等） |
| 422 | UNPROCESSABLE_ENTITY | リクエスト処理不可 |
| 429 | RATE_LIMITED | レート制限超過 |
| 500 | INTERNAL_ERROR | サーバーエラー |
| 503 | SERVICE_UNAVAILABLE | サービス利用不可 |

---

## 4. 認証要件の定義

### Board Key（Web ダッシュボード用）

- **形式**: `Bearer <JWT token>` または `comp_xxxxxxxxxxxx` (API Key)
- **発行**: `/api/auth/login` または手動生成
- **有効期限**: 24 時間（リフレッシュ可能）
- **権限**: company_id の配下リソースに限定（RBAC）

### Agent Key（エージェント用）

- **形式**: `Bearer agent_xxxxxxxxxxxxxx`
- **発行**: `/api/agents/{id}` 作成時に返却（1度のみ）
- **有効期限**: 無期限（失効までの期間指定可能）
- **権限**: 対象エージェント自身のハートビート送信のみ

### authMiddleware の userId セット機構

APIキーのクライアント側から渡されるキーには以下の情報を埋め込む：

**board_api_keys の name フォーマット**: `user:{userId}:label`

authMiddleware の処理フロー：
1. `extractUserIdFromKeyName(name)` 関数で `user:{userId}:label` パターンからuserIdを抽出
2. `req.userId` にsuserIdをセット
3. `req.authKeyId`, `req.authKeyName` にAPIキーのIDと名前をセット
4. 目的: 監査ログの `actor_id` フィールドにuserIdを記録可能にする

**実装例**:
```typescript
function extractUserIdFromKeyName(name: string): string | null {
  // "user:uuid:label" パターンをマッチ
  const match = name.match(/^user:([a-f0-9\-]+):/);
  return match ? match[1] : null;
}

// authMiddleware 内で使用
const userId = extractUserIdFromKeyName(authKeyName);
if (userId) {
  req.userId = userId;
}
```

---

## 5. マイグレーション戦略

### Drizzle Kit での自動マイグレーション

```bash
# 1. スキーマ定義から SQL を生成
drizzle-kit generate:pg --schema=./src/schema.ts --out=./migrations

# 2. マイグレーション実行
drizzle-kit migrate:pg --schema=./src/schema.ts

# 3. 本番環境（Docker/ネイティブ双方）で実行
# docker compose up で自動的に migration:latest が実行される
```

### マイグレーション順序

1. グループA（組織・認証）
2. グループB（エージェント・スキル）
3. グループC（Issue・ゴール）
4. グループD（Goals・Projects）
5. グループE（Cost・Budget）
6. グループF（Routines）
7. グループG（Documents・Assets）
8. グループH（Plugins・Audit）

---

## 改訂履歴

| 版 | 作成日 | 変更内容 | 担当 |
|----|--------|---------|------|
| v2.2 | 2026-04-03 | PR#1 LoginResponse/RegisterResponse型変更・login saveConfig全ケース対応を反映（開発部）|
| v2.1 | 2026-04-03 | PR#1 変更内容を反映：board_api_keys name フォーマット追加、authMiddleware userId セットロジック、extractUserIdFromKeyName 関数説明、issues API のテナントチェック・サニタイズ・created_by フィールド追加 | 開発部第1課（Omar） |
| v2.0 | 2026-04-03 | companies テーブルに settings カラム追加、claude_api エージェントタイプ対応、/api/settings エンドポイント新規追加 | 開発部第4課（Hana） |
| v1.0 | 2026-04-03 | 初版作成：全61テーブルDDL確定 + 100+ エンドポイント仕様確定 | 開発部第1課（Omar × Hana） |

---

**このドキュメントは開発部第1課（Omar）と第4課（Hana）で確定版です。実装開始前にDavid Park（部長）による最終レビューを必須とします。**
