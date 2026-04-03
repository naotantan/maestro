# .company CLI 基本設計書（W2）

**作成日**: 2026-04-03
**担当**: 開発部（David部長）× 戦略顧問室（Kenji主査）
**版**: v2.0
**ステータス**: 基本設計確定版

---

## 1. システム構成図

### 1.1 Docker方式（推奨・開発環境も同一）

```
┌─────────────────────────────────────────────────────────┐
│         クライアント層 (ホスト)                            │
│  ┌──────────────────────┐                               │
│  │  CLI: company        │                               │
│  │  Commander.js        │────┐                          │
│  │  (TypeScript)        │    │                          │
│  │  Node.js 20+         │    │                          │
│  └──────────────────────┘    │                          │
│                              │                          │
│  ┌──────────────────────┐    │                          │
│  │  Web UI Browser      │    │                          │
│  │  (localhost:5173)    │────┤                          │
│  │  Vite + React        │    │                          │
│  └──────────────────────┘    │                          │
└──────────────────────────────┼──────────────────────────┘
                               │
                    Docker Network (bridge)
                               │
┌──────────────────────────────┼──────────────────────────┐
│         Docker Compose             │                    │
│                                    ▼                    │
│  ┌────────────────────────────────────────┐             │
│  │  db: PostgreSQL 17                     │             │
│  │  ├─ Database: company                  │             │
│  │  ├─ Port: 5432 (内部)                  │             │
│  │  ├─ Volume: pgdata/ (永続化)           │             │
│  │  └─ Health check: pg_isready           │             │
│  └────────────────────────────────────────┘             │
│           ▲                                              │
│           │                                              │
│  ┌────────┴─────────────────────────────┐              │
│  │  api: Express.js APIサーバー           │              │
│  │  ├─ Port: 3000 (内部)                 │              │
│  │  ├─ Routes: /api/** (9グループ)       │              │
│  │  ├─ ORM: Drizzle (PostgreSQL)         │              │
│  │  ├─ Auth: Better Auth (APIキー)       │              │
│  │  └─ Health: GET /api/health           │              │
│  └────────────────────────────────────────┘             │
│           ▲                                              │
│           │                                              │
│           └─ CLI / Web UI が HTTP接続                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

【動作フロー】
1. docker compose up -d          → PostgreSQL + Express起動
2. company ui                    → Vite開発サーバー起動
3. Web UI (localhost:5173)       → Express API (localhost:3000)
4. CLI コマンド                  → Express API (localhost:3000/api/...)
```

### 1.2 ネイティブ方式（既存PostgreSQL接続）

```
┌──────────────────────────────┐
│      ホスト環境              │
│  Node.js 20+                 │
│  npm install -g @company/cli │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  CLI Client (Commander.js)           │
├──────────────────────────────────────┤
│  ~/.company-cli/config.json          │
│  ├─ インストール方式: native         │
│  ├─ DB接続URL: <user指定>           │
│  └─ 言語設定: ja (デフォルト)       │
└──────────┬───────────────────────────┘
           │
           ▼
   TCP接続 (ローカル)
           │
           ▼
┌──────────────────────────────────────┐
│  PostgreSQL 17 (既存・外部)          │
│  user@localhost:5432/company_db     │
│                                      │
│  対応: マイグレーション実行済み      │
│  (drizzle migrations)                │
└──────────────────────────────────────┘

【初期化フロー】
1. company init --native --db-url "postgresql://..."
2. Drizzle migrations を自動実行
3. 組織データベース初期化（.company/CLAUDE.md読み込み）
4. company agent list → 成功
```

---

## 2. pnpm Monorepo パッケージ構成

```
company-cli/                          ← monorepo root
├── pnpm-workspace.yaml               ← workspace定義
├── package.json                      ← ルートスクリプト（dev/build/test）
│
├── packages/
│   │
│   ├── api/                          ← Express.js APIサーバー
│   │   ├── src/
│   │   │   ├── index.ts              ← サーバーエントリー
│   │   │   ├── server.ts             ← Express.app()初期化
│   │   │   ├── middleware/           ← 認証・CORS・エラーハンドリング
│   │   │   └── routes/               ← 8グループのルートハンドラ
│   │   │       ├── companies.ts      ← /api/companies/*
│   │   │       ├── agents.ts         ← /api/agents/*（80+ endpoints）
│   │   │       ├── issues.ts         ← /api/issues/*
│   │   │       ├── goals.ts          ← /api/goals/*
│   │   │       ├── projects.ts       ← /api/projects/*
│   │   │       ├── costs.ts          ← /api/costs/*
│   │   │       ├── routines.ts       ← /api/routines/*
│   │   │       ├── approvals.ts      ← /api/approvals/*
│   │   │       ├── plugins.ts        ← /api/plugins/*
│   │   │       ├── activity.ts       ← /api/activity/*
│   │   │       ├── settings.ts        ← /api/settings（組織設定・バックアップ設定）
│   │   │       ├── auth.ts           ← /api/auth/*（Better Auth連携）
│   │   │       └── health.ts         ← /api/health （ヘルスチェック）
│   │   ├── tsconfig.json
│   │   └── package.json (express, drizzle, better-auth)
│   │
│   ├── cli/                          ← Commander.js CLIクライアント
│   │   ├── src/
│   │   │   ├── cli.ts                ← main() entry point
│   │   │   ├── commands/             ← subcommand definitions
│   │   │   │   ├── init.ts           ← company init (--docker, --native)
│   │   │   │   ├── org.ts            ← company org (show/import/export)
│   │   │   │   ├── agent.ts          ← company agent (add/list/start/stop)
│   │   │   │   ├── issue.ts          ← company issue (create/list/assign)
│   │   │   │   ├── goal.ts           ← company goal (create/list)
│   │   │   │   ├── project.ts        ← company project (create/list)
│   │   │   │   ├── routine.ts        ← company routine (create/run)
│   │   │   │   ├── approval.ts       ← company approval (approve/reject)
│   │   │   │   ├── costs.ts          ← company costs (show/export)
│   │   │   │   ├── plugin.ts         ← company plugin (add/enable/list)
│   │   │   │   ├── ui.ts             ← company ui (open browser)
│   │   │   │   ├── doctor.ts         ← company doctor (診断コマンド)
│   │   │   │   ├── backup.ts         ← company backup (pg_dump)
│   │   │   │   ├── update.ts         ← company update (自己アップデート)
│   │   │   │   └── uninstall.ts      ← company uninstall
│   │   │   ├── api-client.ts         ← HTTP client (node-fetch/axios)
│   │   │   ├── config.ts             ← ~/.company-cli/config.json 管理
│   │   │   ├── i18n.ts               ← 多言語対応（COMPANY_LANG env）
│   │   │   └── utils/                ← logger, spinner, prompt等
│   │   ├── tsconfig.json
│   │   └── package.json (commander, chalk, ora)
│   │
│   ├── ui/                           ← Vite + React Web UI（40画面）
│   │   ├── src/
│   │   │   ├── main.tsx              ← React entry point
│   │   │   ├── App.tsx               ← root component
│   │   │   ├── pages/                ← 40画面 全て実装
│   │   │   │   ├── auth/
│   │   │   │   │   ├── Auth.tsx
│   │   │   │   │   ├── BoardClaim.tsx
│   │   │   │   │   ├── CliAuth.tsx
│   │   │   │   │   ├── InviteLanding.tsx
│   │   │   │   │   └── Onboarding.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── Dashboard.tsx
│   │   │   │   │   └── Inbox.tsx
│   │   │   │   ├── agents/
│   │   │   │   │   ├── Agents.tsx
│   │   │   │   │   ├── AgentDetail.tsx
│   │   │   │   │   ├── NewAgent.tsx
│   │   │   │   │   ├── Org.tsx
│   │   │   │   │   └── OrgChart.tsx
│   │   │   │   ├── issues/
│   │   │   │   │   ├── Issues.tsx
│   │   │   │   │   ├── IssueDetail.tsx
│   │   │   │   │   └── MyIssues.tsx
│   │   │   │   ├── goals/
│   │   │   │   │   ├── Goals.tsx
│   │   │   │   │   └── GoalDetail.tsx
│   │   │   │   ├── projects/
│   │   │   │   │   ├── Projects.tsx
│   │   │   │   │   ├── ProjectDetail.tsx
│   │   │   │   │   └── ProjectWorkspaceDetail.tsx
│   │   │   │   ├── routines/
│   │   │   │   │   ├── Routines.tsx
│   │   │   │   │   └── RoutineDetail.tsx
│   │   │   │   ├── approvals/
│   │   │   │   │   ├── Approvals.tsx
│   │   │   │   │   └── ApprovalDetail.tsx
│   │   │   │   ├── costs/
│   │   │   │   │   └── Costs.tsx
│   │   │   │   ├── activity/
│   │   │   │   │   └── Activity.tsx
│   │   │   │   ├── skills/
│   │   │   │   │   └── CompanySkills.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   ├── CompanySettings.tsx
│   │   │   │   │   ├── InstanceGeneralSettings.tsx (言語切替)
│   │   │   │   │   ├── InstanceSettings.tsx
│   │   │   │   │   └── InstanceExperimentalSettings.tsx
│   │   │   │   ├── plugins/
│   │   │   │   │   ├── PluginManager.tsx
│   │   │   │   │   ├── PluginPage.tsx
│   │   │   │   │   └── PluginSettings.tsx
│   │   │   │   ├── companies/
│   │   │   │   │   ├── Companies.tsx
│   │   │   │   │   ├── CompanyExport.tsx
│   │   │   │   │   └── CompanyImport.tsx
│   │   │   │   └── other/
│   │   │   │       ├── NotFound.tsx
│   │   │   │       ├── DesignGuide.tsx
│   │   │   │       └── ExecutionWorkspaceDetail.tsx
│   │   │   ├── components/            ← 再利用可能コンポーネント
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Form.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── Breadcrumb.tsx
│   │   │   │   ├── Pagination.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── Alert.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   ├── hooks/                ← カスタムhooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useApi.ts
│   │   │   │   ├── useI18n.ts
│   │   │   │   └── useLocalStorage.ts
│   │   │   ├── services/             ← API呼び出し
│   │   │   │   ├── api.ts            ← fetch wrapper
│   │   │   │   └── services/*.ts     ← 機能別APIクライアント
│   │   │   ├── store/                ← Zustand or Context
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── uiStore.ts
│   │   │   │   └── dataStore.ts
│   │   │   ├── styles/
│   │   │   │   ├── globals.css       ← 全体スタイル (Tailwind)
│   │   │   │   └── components.css    ← コンポーネント固有
│   │   │   ├── i18n/                 ← react-i18next設定
│   │   │   │   ├── index.ts
│   │   │   │   └── locales/
│   │   │   │       ├── ja.json       ← 日本語（デフォルト）
│   │   │   │       └── en.json       ← 英語
│   │   │   ├── types/                ← TypeScript型定義
│   │   │   │   ├── api.ts
│   │   │   │   ├── domain.ts
│   │   │   │   └── ui.ts
│   │   │   └── utils/                ← ユーティリティ
│   │   │       ├── date.ts
│   │   │       ├── number.ts
│   │   │       └── format.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json (vite, react, react-i18next, tailwindcss)
│   │
│   ├── db/                           ← Drizzle ORM スキーマ・マイグレーション
│   │   ├── src/
│   │   │   ├── schema/               ← 61テーブル Drizzle定義
│   │   │   │   ├── index.ts          ← export all tables
│   │   │   │   ├── companies.ts      ← 組織・メンバーシップ・認証（10テーブル）
│   │   │   │   ├── agents.ts         ← エージェント関連（7テーブル）
│   │   │   │   ├── issues.ts         ← タスク・コメント・ラベル（10テーブル）
│   │   │   │   ├── goals.ts          ← ゴール・プロジェクト（4テーブル）
│   │   │   │   ├── costs.ts          ← コスト・予算（4テーブル）
│   │   │   │   ├── routines.ts       ← ルーティン（3テーブル）
│   │   │   │   ├── documents.ts      ← ドキュメント・スキル（6テーブル）
│   │   │   │   └── plugins.ts        ← プラグイン・監査（11テーブル）
│   │   │   ├── migrations/           ← Drizzle migrations
│   │   │   │   ├── 0001_init.sql     ← initial schema
│   │   │   │   ├── 0002_auth.sql     ← Better Auth tables
│   │   │   │   └── NNNN_*.sql        ← incremental
│   │   │   ├── db.ts                 ← Drizzle client初期化
│   │   │   └── seed.ts               ← 初期データ（オプション）
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts         ← Drizzle設定
│   │   └── package.json (drizzle-orm, postgres)
│   │
│   ├── adapters/                     ← 8種エージェントアダプター
│   │   ├── src/
│   │   │   ├── index.ts              ← AdapterRegistry初期化
│   │   │   ├── base.ts               ← AgentAdapter インターフェース定義
│   │   │   ├── adapters/
│   │   │   │   ├── claude-local.ts   ← Claude Code (--bare なし)
│   │   │   │   ├── claude-api.ts     ← Anthropic API（従量課金・@anthropic-ai/sdk）
│   │   │   │   ├── codex-local.ts    ← OpenAI Codex
│   │   │   │   ├── cursor.ts         ← Cursor
│   │   │   │   ├── gemini-local.ts   ← Gemini CLI
│   │   │   │   ├── openclaw-gateway.ts ← OpenClaw
│   │   │   │   ├── opencode-local.ts ← OpenCode
│   │   │   │   └── pi-local.ts       ← Pi
│   │   │   ├── utils/
│   │   │   │   ├── cli-detect.ts     ← CLI自動検出
│   │   │   │   ├── config-manager.ts ← アダプター設定管理
│   │   │   │   └── heartbeat.ts      ← ハートビート実行エンジン
│   │   │   └── types/
│   │   │       ├── adapter.ts        ← AdapterType, AdapterConfig
│   │   │       ├── heartbeat.ts      ← HeartbeatContext, HeartbeatResult
│   │   │       └── errors.ts         ← AdapterError
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── i18n/                         ← 多言語対応（react-i18next）
│   │   ├── locales/
│   │   │   ├── ja.json               ← 日本語（全キー）
│   │   │   ├── en.json               ← 英語（全キー）
│   │   │   └── [lang].json           ← 新言語（自動認識）
│   │   ├── index.ts                  ← i18next初期化
│   │   ├── types.ts                  ← 翻訳キーの型定義（TypeScript完全型付け）
│   │   └── package.json (i18next, react-i18next)
│   │
│   └── shared/                       ← 共通型定義・ユーティリティ
│       ├── src/
│       │   ├── types/
│       │   │   ├── api.ts            ← APIリクエスト/レスポンス型
│       │   │   ├── domain.ts         ← 業務オブジェクト型
│       │   │   ├── heartbeat.ts      ← ハートビート型
│       │   │   ├── error.ts          ← エラー型
│       │   │   └── config.ts         ← 設定型
│       │   ├── utils/
│       │   │   ├── error-handler.ts
│       │   │   ├── logger.ts
│       │   │   ├── date.ts
│       │   │   ├── validation.ts
│       │   │   └── crypto.ts
│       │   └── constants/
│       │       ├── errors.ts
│       │       ├── status.ts
│       │       └── config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docker-compose.yml               ← Docker Compose設定（開発・Docker方式用）
│   ├─ db: PostgreSQL 17 (image: postgres:17-alpine)
│   ├─ api: Express.js (build: ./packages/api)
│   └─ 環境変数・ボリューム・ヘルスチェック定義
│
├── Dockerfile.api                   ← APIサーバー用Dockerfile
│   ├─ Stage 1: Build (Node 20, pnpm)
│   ├─ Stage 2: Runtime (Node 20-slim, non-root)
│   └─ EXPOSE 3000
│
├── Dockerfile.cli                   ← CLIバイナリ用Dockerfile（オプション）
│   ├─ pkg でバイナリ化（Linux/macOS/Windows対応）
│   └─ サイズ最適化（2-5MB）
│
├── .github/workflows/
│   ├── test.yml                     ← Vitest + Playwright E2E
│   ├── build.yml                    ← pnpm build (全packages)
│   ├── docker.yml                   ← Docker イメージビルド・レジストリpush
│   └── release.yml                  ← npm publish + GitHub Release
│
├── tsconfig.json                    ← ルートtsconfig (extends)
├── pnpm-lock.yaml                   ← 依存関係ロック
└── README.md                         ← インストール・クイックスタート・FAQ
```

### パッケージ間の依存関係

```
shared
  ↑
  ├─ api (依存)
  ├─ cli (依存)
  ├─ ui (依存)
  ├─ db (依存)
  └─ adapters (依存)

db
  ↓
  api (Drizzle client使用)

i18n
  ↓
  ui (React hooks)
  ↓
  cli (environment variable読み込み)

adapters
  ↓
  api (heartbeat routes)
```

---

## 3. 画面遷移図（40画面・階層構造）

```
【認証フロー】
┌─────────────┐
│  Auth.tsx   │
└──────┬──────┘
       │
       ├─→ 新規アカウント登録 ──→ Onboarding.tsx
       │
       ├─→ APIキー認証 ──────→ BoardClaim.tsx
       │
       ├─→ CLI from device ──→ CliAuth.tsx
       │
       └─→ 招待リンク ────────→ InviteLanding.tsx
                                    │
                                    └──→ Onboarding.tsx
                                           │
                                           └──→ Dashboard.tsx

【メインフロー】（認証後）
┌─────────────────────┐
│  Dashboard.tsx      │
│  (ダッシュボード)    │
│  - エージェント状態  │
│  - 最新Issue        │
│  - ハートビート結果  │
└──────┬──────────────┘
       │
       ├──→ Inbox.tsx
       │    - Issue notifications
       │    - Approvals pending
       │    - System alerts
       │
       ├─────────────────────────────────┬──────────────────────────┐
       │                                  │                          │
   【エージェント】                    【タスク管理】           【目標・プロジェクト】
       │                                  │                          │
       ├─→ Agents.tsx ──┐           ├─→ Issues.tsx ──┐        ├─→ Goals.tsx
       │   - 一覧・登録  │           │   - 一覧・検索  │        │   - 一覧・作成
       │   - 状態監視    │           │   - ID採番表示  │        │   - 達成率表示
       │                │           │   - ステータス  │        │
       └─→ AgentDetail  │           └─→ IssueDetail   │        └─→ GoalDetail
           .tsx ────────┤               .tsx ────────┤            .tsx
           - 実行履歴    │               - コメント    │            - 紐付Issue
           - ハートビート│               - ラベル      │            - 進捗
           - 設定編集    │               - 添付ファイル│            - 期限
                        │               - 承認フロー  │
       ┌─→ NewAgent     │                             │        ┌─→ Projects.tsx
       │   .tsx ────────┘                             └────────┤   - 一覧・作成
       │   - アダプター                                        │   - ロードマップ
       │     選択                                              │
       │   - 設定入力                                   ┌──────┴─→ ProjectDetail
       │                                               │         .tsx
       ├─→ Org.tsx ──────────────────────────────────│        - Wiki
       │   - 組織チャート                              │        - Issues紐付
       │   - メンバー一覧                              │        - ガントチャート
       │   - 権限管理                                  │
       │                                               └──────→ ProjectWorkspace
       └─→ OrgChart.tsx                                       Detail.tsx
           - ビジュアル表示

【ルーティン・承認・コスト】
       │
       ├─→ Routines.tsx ──┐
       │   - 定期実行      │
       │   - トリガー      │
       │                  └─→ RoutineDetail.tsx
       │                      - スケジュール設定
       │                      - 実行履歴
       │
       ├─→ Approvals.tsx ┐
       │   - 承認待ち     │
       │   - 却下履歴     │
       │                  └─→ ApprovalDetail.tsx
       │                      - approve/reject
       │                      - コメント追加
       │
       ├─→ Costs.tsx
       │   - コスト集計（エージェント別）
       │   - 予算ポリシー表示
       │   - 月次推移グラフ
       │
       └─→ Activity.tsx
           - 全操作ログ表示
           - 検索・フィルタ

【スキル・プラグイン・設定】
       │
       ├─→ CompanySkills.tsx
       │   - 登録済みスキル一覧
       │   - エージェント適用
       │
       ├─→ PluginManager.tsx ──┐
       │   - プラグイン一覧     │
       │   - enable/disable     │
       │                        └─→ PluginPage.tsx
       │                            - マーケットプレイス的表示
       │
       │                        ┌─→ PluginSettings.tsx
       │                        │   - 個別設定
       │
       ├─→ CompanySettings.tsx
       │   - 組織情報編集
       │
       ├─→ InstanceGeneralSettings.tsx
       │   - 言語切替（日本語 / 英語）
       │   - UIテーマ選択
       │
       ├─→ InstanceSettings.tsx
       │   - DB接続情報表示
       │   - バックアップ設定
       │
       ├─→ InstanceExperimentalSettings.tsx
       │   - 実験的機能フラグ
       │   - デバッグモード
       │
       ├─→ Companies.tsx ──────┐
       │   - 複数組織管理       │
       │                        └─→ CompanyExport.tsx (データ出力)
       │                        ├─→ CompanyImport.tsx (データ取込)
       │
       ├─→ ExecutionWorkspaceDetail.tsx
       │   - エージェント作業スペース
       │
       ├─→ NotFound.tsx
       │   - 404ページ
       │
       └─→ DesignGuide.tsx
           - コンポーネント見本帳
```

---

## 4. APIルート設計概要

### 4.1 ルートグループ一覧（100+ endpoints）

```
【A: 認証】/api/auth/*
├─ POST /api/auth/register            ← 新規アカウント
├─ POST /api/auth/login               ← ログイン
├─ POST /api/auth/logout              ← ログアウト
├─ POST /api/auth/refresh-token       ← トークン更新
├─ GET  /api/auth/me                  ← 現在ユーザー情報
├─ POST /api/auth/api-key/create      ← Board APIキー生成
├─ GET  /api/auth/api-keys            ← Board APIキー一覧
├─ DELETE /api/auth/api-key/:id       ← Board APIキー削除
└─ POST /api/auth/verify-cli-challenge ← CLI認証チャレンジ

【B: 企業・組織】/api/companies/*
├─ GET  /api/companies                ← 企業一覧（マルチテナント対応）
├─ GET  /api/companies/:id            ← 企業情報取得
├─ POST /api/companies                ← 企業作成
├─ PUT  /api/companies/:id            ← 企業情報更新
├─ DELETE /api/companies/:id          ← 企業削除
├─ GET  /api/companies/:id/members    ← メンバー一覧
├─ POST /api/companies/:id/members    ← メンバー招待
├─ DELETE /api/companies/:id/members/:memberId ← メンバー削除
├─ GET  /api/companies/:id/roles      ← ロール一覧
├─ PUT  /api/companies/:id/roles/:roleId ← ロール設定変更
├─ GET  /api/companies/:id/settings   ← 企業設定取得
├─ PUT  /api/companies/:id/settings   ← 企業設定更新
├─ POST /api/companies/:id/export     ← エクスポート
└─ POST /api/companies/:id/import     ← インポート

【C: エージェント】/api/agents/* (80+ endpoints)
├─ POST /api/agents                   ← 新規登録
├─ GET  /api/agents                   ← 一覧取得
├─ GET  /api/agents/:id               ← 詳細取得
├─ PUT  /api/agents/:id               ← 情報更新
├─ DELETE /api/agents/:id             ← 削除
├─ POST /api/agents/:id/start         ← ハートビート開始
├─ POST /api/agents/:id/stop          ← 停止
├─ GET  /api/agents/:id/status        ← 状態取得（リアルタイム）
├─ GET  /api/agents/:id/heartbeats    ← ハートビート履歴
├─ GET  /api/agents/:id/config        ← 設定取得
├─ PUT  /api/agents/:id/config        ← 設定更新
├─ GET  /api/agents/:id/tasks         ← 割り当てタスク
├─ POST /api/agents/:id/wakeup-request ← 強制起動リクエスト
├─ GET  /api/agents/:id/runtime-state ← 実行時状態
├─ POST /api/agents/:id/runtime-state ← 状態保存
├─ GET  /api/agents/:id/test-config   ← 設定テスト実行
├─ GET  /api/agents/:id/detect-model  ← モデル自動検出
├─ POST /api/agents/:id/api-key/create ← Agent APIキー生成（秘密暗号化）
├─ GET  /api/agents/:id/api-keys      ← 発行済みキー一覧
└─ DELETE /api/agents/:id/api-key/:keyId ← キー削除

【D: Issue・タスク】/api/issues/*
├─ POST /api/issues                   ← 新規Issue作成（COMP-1形式自動採番）
├─ GET  /api/issues                   ← 一覧取得（フィルタ・ソート対応）
├─ GET  /api/issues/:id               ← 詳細取得
├─ PUT  /api/issues/:id               ← 情報更新
├─ DELETE /api/issues/:id             ← 削除
├─ GET  /api/issues/:id/comments      ← コメント一覧
├─ POST /api/issues/:id/comments      ← コメント追加
├─ PUT  /api/issues/:id/comments/:commentId ← コメント編集
├─ DELETE /api/issues/:id/comments/:commentId ← コメント削除
├─ POST /api/issues/:id/assign        ← エージェント割り当て
├─ POST /api/issues/:id/unassign      ← 割り当て解除
├─ GET  /api/issues/:id/labels        ← ラベル取得
├─ POST /api/issues/:id/labels        ← ラベル追加
├─ DELETE /api/issues/:id/labels/:labelId ← ラベル削除
├─ POST /api/issues/:id/attachments   ← ファイル添付
├─ GET  /api/issues/:id/attachments   ← 添付ファイル一覧
├─ DELETE /api/issues/:id/attachments/:fileId ← ファイル削除
└─ PUT  /api/issues/:id/status        ← ステータス遷移（backlog→in_progress→done）

【E: Goal・Project】/api/goals/* & /api/projects/*
├─ POST /api/goals                    ← ゴール作成
├─ GET  /api/goals                    ← ゴール一覧
├─ GET  /api/goals/:id                ← ゴール詳細
├─ PUT  /api/goals/:id                ← ゴール更新
├─ DELETE /api/goals/:id              ← ゴール削除
├─ GET  /api/goals/:id/progress       ← 達成率計算・表示
├─ GET  /api/goals/:id/issues         ← 関連Issue一覧
├─ POST /api/projects                 ← プロジェクト作成
├─ GET  /api/projects                 ← プロジェクト一覧
├─ GET  /api/projects/:id             ← プロジェクト詳細
├─ PUT  /api/projects/:id             ← プロジェクト更新
├─ DELETE /api/projects/:id           ← プロジェクト削除
├─ POST /api/projects/:id/goals       ← ゴール紐付
├─ DELETE /api/projects/:id/goals/:goalId ← 紐付解除
├─ GET  /api/projects/:id/workspace   ← ワークスペース取得
└─ PUT  /api/projects/:id/workspace   ← ワークスペース更新

【F: Cost・Budget】/api/costs/*
├─ GET  /api/costs/events             ← コスト履歴（フィルタ対応）
├─ GET  /api/costs/summary            ← 月次集計（エージェント別）
├─ GET  /api/costs/by-agent/:id       ← エージェント別詳細
├─ GET  /api/costs/budget-policies    ← 予算ポリシー一覧
├─ POST /api/costs/budget-policies    ← 予算ポリシー作成
├─ PUT  /api/costs/budget-policies/:id ← ポリシー更新
├─ DELETE /api/costs/budget-policies/:id ← ポリシー削除
├─ GET  /api/costs/incidents          ← 予算超過履歴
└─ POST /api/costs/test-threshold     ← 予算閾値テスト

【G: Routine】/api/routines/*
├─ POST /api/routines                 ← ルーティン作成
├─ GET  /api/routines                 ← ルーティン一覧
├─ GET  /api/routines/:id             ← ルーティン詳細
├─ PUT  /api/routines/:id             ← ルーティン更新
├─ DELETE /api/routines/:id           ← ルーティン削除
├─ POST /api/routines/:id/triggers    ← トリガー設定
├─ GET  /api/routines/:id/run-history ← 実行履歴
├─ POST /api/routines/:id/run-now     ← 即時実行
└─ GET  /api/routines/:id/status      ← 次回実行予定

【H: Approval】/api/approvals/*
├─ GET  /api/approvals                ← 承認待ち一覧
├─ GET  /api/approvals/:id            ← 承認詳細
├─ POST /api/approvals/:id/approve    ← 承認
├─ POST /api/approvals/:id/reject     ← 却下
├─ POST /api/approvals/:id/comments   ← コメント追加
├─ GET  /api/approvals/history        ← 承認履歴
└─ GET  /api/approvals/statistics     ← 承認統計

【I: Plugin】/api/plugins/*
├─ GET  /api/plugins                  ← プラグイン一覧
├─ POST /api/plugins                  ← プラグイン登録
├─ GET  /api/plugins/:id              ← プラグイン詳細
├─ PUT  /api/plugins/:id              ← プラグイン更新
├─ DELETE /api/plugins/:id            ← プラグイン削除
├─ POST /api/plugins/:id/enable       ← 有効化
├─ POST /api/plugins/:id/disable      ← 無効化
├─ GET  /api/plugins/:id/config       ← 設定取得
├─ PUT  /api/plugins/:id/config       ← 設定更新
├─ POST /api/plugins/:id/test         ← 動作テスト
├─ GET  /api/plugins/:id/jobs         ← プラグインジョブ一覧
├─ POST /api/plugins/:id/webhook      ← Webhook受信
├─ GET  /api/plugins/:id/logs         ← ジョブログ
├─ GET  /api/plugins/:id/entities     ← プラグイン管理エンティティ
└─ GET  /api/plugins/marketplace      ← マーケットプレイス（将来）

【J: Activity / Audit】/api/activity/*
├─ GET  /api/activity                 ← 全操作ログ（タイムスタンプ・ユーザー・操作・対象）
├─ GET  /api/activity?entity=:type    ← エンティティ別フィルタ
├─ GET  /api/activity?actor=:userId   ← ユーザー別フィルタ
├─ GET  /api/activity?since=:timestamp ← 日時範囲指定
└─ GET  /api/activity/export          ← ログエクスポート

【K: Health】/api/health
├─ GET  /api/health                   ← ヘルスチェック（DB・メモリ・詳細）
└─ GET  /api/health/detailed          ← 詳細診断

### リアルタイム更新（WebSocket）
├─ /ws/agents/:id/status              ← エージェント状態更新（リアルタイム）
├─ /ws/heartbeat/:id                  ← ハートビートリアルタイムログ
├─ /ws/issues/:id/comments            ← Issue コメント追加通知
└─ /ws/notifications                  ← 全体通知ストリーム
```

### 4.2 API設計ポリシー

```
【リクエスト】
- 全て JSON (Content-Type: application/json)
- 認証: Bearer Token (JWT or Better Auth session)
- ページネーション: limit, offset query params (デフォルト: limit=50, offset=0)
- フィルタ: ?status=done&label=bug のような形式

【レスポンス】
- 正常系 (2xx): { data: {...}, status: "success" }
- 作成時 (201): Location ヘッダに新リソースのURL
- クライアントエラー (4xx): { error: {...}, message: "説明" }
- サーバーエラー (5xx): { error: {...}, message: "説明", traceId: "..." }

【パラメータ】
- ID: UUID v4 (全エンティティ共通)
- タイムスタンプ: ISO 8601 (UTC)
- ステータス: enum (backlog, in_progress, done, archived等)

【監査・セキュリティ】
- 全CRUD操作を activity_log に記録（Actor・操作・対象・タイムスタンプ）
- APIキー: bcryptハッシュ化（平文DBに保存しない）
- シークレット: AES-256-GCMで暗号化（iv・ciphertextともに保存）
- SQL: Drizzle ParameterizedQuery 必須（インジェクション対策）
```

---

## 5. DB設計概要（61テーブル）

### 5.1 テーブルグループ別アーキテクチャ

```
【グループA: 組織・認証・権限】(10テーブル)
┌─────────────────────────────────────┐
│ companies (id, name, settings, created_at) │ ← 企業マスタ
├─────────────────────────────────────┤
│ company_memberships                 │ ← メンバーシップ
│ (id, company_id FK, user_id FK)     │
├─────────────────────────────────────┤
│ users (id, email, password_hash)    │ ← ユーザー
├─────────────────────────────────────┤
│ board_api_keys                      │ ← Board用APIキー
│ (id, company_id FK, key_hash)       │
├─────────────────────────────────────┤
│ agent_api_keys                      │ ← Agent用APIキー（秘密暗号化）
│ (id, agent_id FK, key_hash)         │
├─────────────────────────────────────┤
│ cli_auth_challenges                 │ ← CLI認証チャレンジ
├─────────────────────────────────────┤
│ permission_grants                   │ ← 権限管理
│ (id, role, company_id, resource)    │
├─────────────────────────────────────┤
│ company_invites                     │ ← 招待リンク
├─────────────────────────────────────┤
│ join_requests                       │ ← 参加リクエスト
└─────────────────────────────────────┘

【グループB: エージェント・ハートビート】(7テーブル)
┌─────────────────────────────────────┐
│ agents                              │ ← エージェントマスタ
│ (id, company_id FK, name, type)     │
├─────────────────────────────────────┤
│ agent_config_revisions              │ ← 設定変更履歴
│ (id, agent_id FK, config JSON)      │
├─────────────────────────────────────┤
│ agent_runtime_state                 │ ← 実行時状態（最新1件）
│ (agent_id PK, state JSON)           │
├─────────────────────────────────────┤
│ heartbeat_runs                      │ ← ハートビート実行
│ (id, agent_id FK, started_at)       │
├─────────────────────────────────────┤
│ heartbeat_run_events                │ ← ハートビートイベント
│ (id, heartbeat_run_id FK, log)      │
├─────────────────────────────────────┤
│ agent_task_sessions                 │ ← タスク実行セッション
│ (id, agent_id FK, task_id FK)       │
├─────────────────────────────────────┤
│ agent_wakeup_requests               │ ← 強制起動リクエスト
│ (id, agent_id FK, requested_at)     │
└─────────────────────────────────────┘

【グループC: Issues・タスク管理】(10テーブル)
┌─────────────────────────────────────┐
│ issues                              │ ← Issue (COMP-001 自動採番)
│ (id, company_id FK, identifier)     │
├─────────────────────────────────────┤
│ issue_comments                      │ ← コメント
│ (id, issue_id FK, author_id)        │
├─────────────────────────────────────┤
│ issue_labels                        │ ← ラベル
│ (id, name, color)                   │
├─────────────────────────────────────┤
│ issue_label_assignments             │ ← Issue←→Label紐付
│ (issue_id, label_id)                │
├─────────────────────────────────────┤
│ issue_attachments                   │ ← ファイル添付
│ (id, issue_id FK, file_url)         │
├─────────────────────────────────────┤
│ approvals                           │ ← 承認フロー
│ (id, issue_id FK, status)           │
├─────────────────────────────────────┤
│ approval_comments                   │ ← 承認コメント
│ (id, approval_id FK, comment)       │
├─────────────────────────────────────┤
│ work_products                       │ ← 成果物リンク
│ (id, issue_id FK, artifact_url)     │
├─────────────────────────────────────┤
│ issue_read_states                   │ ← 既読状態管理
│ (user_id, issue_id, read_at)        │
├─────────────────────────────────────┤
│ inbox_archives                      │ ← インボックスアーカイブ
│ (id, user_id FK, issue_id FK)       │
└─────────────────────────────────────┘

【グループD: Goals・Projects】(4テーブル)
┌─────────────────────────────────────┐
│ goals                               │ ← ゴール
│ (id, company_id FK, name, deadline) │
├─────────────────────────────────────┤
│ projects                            │ ← プロジェクト
│ (id, company_id FK, name)           │
├─────────────────────────────────────┤
│ project_goals                       │ ← Project←→Goal
│ (project_id, goal_id)               │
├─────────────────────────────────────┤
│ project_workspaces                  │ ← プロジェクトWiki/Notes
│ (id, project_id FK, content)        │
└─────────────────────────────────────┘

【グループE: Cost・Budget】(4テーブル)
┌─────────────────────────────────────┐
│ cost_events                         │ ← コスト記録
│ (id, agent_id FK, model, tokens)    │
├─────────────────────────────────────┤
│ budget_policies                     │ ← 予算ポリシー
│ (id, company_id FK, limit_amount)   │
├─────────────────────────────────────┤
│ budget_incidents                    │ ← 超過アラート
│ (id, agent_id FK, exceeded_at)      │
├─────────────────────────────────────┤
│ finance_events                      │ ← 請求イベント
│ (id, company_id FK, type)           │
└─────────────────────────────────────┘

【グループF: Routines】(3テーブル)
┌─────────────────────────────────────┐
│ routines                            │ ← 定期実行タスク
│ (id, company_id FK, name, cron)     │
├─────────────────────────────────────┤
│ routine_triggers                    │ ← トリガー条件
│ (id, routine_id FK, condition)      │
├─────────────────────────────────────┤
│ routine_runs                        │ ← 実行履歴
│ (id, routine_id FK, executed_at)    │
└─────────────────────────────────────┘

【グループG: Documents・Skills・Secrets】(6テーブル)
┌─────────────────────────────────────┐
│ documents                           │ ← ドキュメント
│ (id, company_id FK, title, content) │
├─────────────────────────────────────┤
│ document_revisions                  │ ← 版管理
│ (id, document_id FK, version)       │
├─────────────────────────────────────┤
│ assets                              │ ← メディアファイル
│ (id, url, mime_type, size)          │
├─────────────────────────────────────┤
│ company_skills                      │ ← 登録スキル
│ (id, company_id FK, name, yaml)     │
├─────────────────────────────────────┤
│ company_secrets                     │ ← シークレット
│ (id, company_id FK, encrypted_value) │
├─────────────────────────────────────┤
│ secret_versions                     │ ← シークレット版管理
│ (id, secret_id FK, encrypted_value) │
└─────────────────────────────────────┘

【グループH: Plugins・Audit】(11テーブル)
┌─────────────────────────────────────┐
│ plugins                             │ ← プラグイン登録
│ (id, company_id FK, name)           │
├─────────────────────────────────────┤
│ plugin_config                       │ ← プラグイン設定
│ (id, plugin_id FK, config JSON)     │
├─────────────────────────────────────┤
│ plugin_state                        │ ← プラグイン状態
│ (plugin_id PK, enabled, last_run)   │
├─────────────────────────────────────┤
│ plugin_entities                     │ ← プラグイン管理エンティティ
│ (id, plugin_id FK, entity_type)     │
├─────────────────────────────────────┤
│ plugin_jobs                         │ ← プラグインジョブ定義
│ (id, plugin_id FK, schedule)        │
├─────────────────────────────────────┤
│ plugin_job_runs                     │ ← ジョブ実行履歴
│ (id, job_id FK, status, started_at) │
├─────────────────────────────────────┤
│ plugin_logs                         │ ← ジョブログ
│ (id, job_run_id FK, level, message) │
├─────────────────────────────────────┤
│ plugin_webhooks                     │ ← Webhook設定
│ (id, plugin_id FK, url, events)     │
├─────────────────────────────────────┤
│ activity_log                        │ ← 全操作ログ（監査）
│ (id, actor_id, entity_type, action) │
├─────────────────────────────────────┤
│ feedback_votes                      │ ← フィードバック投票
│ (id, entity_id, user_id, vote)      │
├─────────────────────────────────────┤
│ principal_permission_grants         │ ← 権限委譲
│ (id, principal_id, granted_to_id)   │
└─────────────────────────────────────┘
```

### 5.2 ER図（主要関連）

```
companies (1) ──────────→ (N) company_memberships ←──────── (1) users
     │
     ├─ (1) ──→ (N) agents
     │           │
     │           ├─ (1) ──→ (N) heartbeat_runs
     │           │           │
     │           │           └─ (1) ──→ (N) heartbeat_run_events
     │           │
     │           ├─ (1) ──→ (N) agent_config_revisions
     │           │
     │           └─ (1) ──→ (1) agent_runtime_state
     │
     ├─ (1) ──→ (N) issues ←──────────── (1) agent_task_sessions
     │           │
     │           ├─ (1) ──→ (N) issue_comments
     │           ├─ (1) ──→ (N) issue_attachments
     │           ├─ (1) ──→ (1) approvals ──→ (N) approval_comments
     │           └─ (1) ──→ (N) issue_label_assignments ←─── (1) issue_labels
     │
     ├─ (1) ──→ (N) goals
     │           │
     │           └─ (1) ──→ (N) project_goals ←──────── (1) projects
     │                           │
     │                           └─ (1) ──→ (N) project_workspaces
     │
     ├─ (1) ──→ (N) cost_events (agent_id FK)
     ├─ (1) ──→ (N) budget_policies
     ├─ (1) ──→ (N) routines
     ├─ (1) ──→ (N) documents ──→ (N) document_revisions
     ├─ (1) ──→ (N) company_skills
     ├─ (1) ──→ (N) company_secrets ──→ (N) secret_versions
     ├─ (1) ──→ (N) plugins ───────────────────┐
     │                                         │
     │           ┌──────────────────────────────┘
     │           ├─ (1) ──→ (N) plugin_config
     │           ├─ (1) ──→ (1) plugin_state
     │           ├─ (1) ──→ (N) plugin_entities
     │           ├─ (1) ──→ (N) plugin_jobs ──→ (N) plugin_job_runs ──→ (N) plugin_logs
     │           └─ (1) ──→ (N) plugin_webhooks
     │
     ├─ (1) ──→ (N) budget_incidents (agent_id FK)
     ├─ (1) ──→ (N) finance_events
     ├─ (1) ──→ (N) company_invites
     ├─ (1) ──→ (N) join_requests
     ├─ (1) ──→ (N) board_api_keys
     ├─ (1) ──→ (N) permission_grants
     └─ (1) ──→ (N) activity_log
```

### 5.3 重要な実装パターン

```
【Issue 識別子の自動採番】
- COMP-001, COMP-002, ... の形式
- INSERT 時に Trigger で自動採番
  SELECT MAX(CAST(SUBSTRING(identifier, 6) AS INT)) + 1
     FROM issues WHERE company_id = ? AND identifier LIKE ?

【シークレット暗号化】
company_secrets.encrypted_value = AES-256-GCM(
  plaintext: "api_key_value",
  key: DERIVED_KEY (company_id + salt),
  iv: random_bytes(16),
  aad: company_id (Additional Authenticated Data)
)
保存: { iv, ciphertext, tag } を JSON化

【ハートビート実行の排他制御】
BEGIN TRANSACTION
  SELECT * FROM agents WHERE id = ? FOR UPDATE (row lock)
  UPDATE agents SET last_heartbeat_at = NOW()
  INSERT INTO heartbeat_runs (agent_id, started_at)
COMMIT
→ 同時実行で2度目のハートビートを防止

【権限管理】
principal_permission_grants テーブル:
  principal_id (user/role) → granted_to_id (company/project/issue)
  resource: "companies" / "agents" / "issues" ...
  action: "read" / "write" / "admin" / "delete"
→ ポリシーエンジン（eg. Open Policy Agent）で検証可能な設計
```

---

## 6. 多言語対応設計

### 6.1 react-i18next アーキテクチャ

```
packages/i18n/
├── locales/
│   ├── ja.json          ← 日本語（マスタ言語）
│   │   {
│   │     "common": {
│   │       "appName": ".company CLI",
│   │       "welcome": "ようこそ {{name}} さん"
│   │     },
│   │     "pages": {
│   │       "dashboard": "ダッシュボード",
│   │       "agents": "エージェント"
│   │     },
│   │     "buttons": {
│   │       "create": "作成",
│   │       "delete": "削除",
│   │       "confirm": "確認"
│   │     },
│   │     "errors": {
│   │       "required": "{{field}} は必須です",
│   │       "invalid_email": "メールアドレスが不正です"
│   │     }
│   │   }
│   │
│   ├── en.json          ← 英語（同じキー構造）
│   │   {
│   │     "common": {
│   │       "appName": ".company CLI",
│   │       "welcome": "Welcome {{name}}"
│   │     },
│   │     ...
│   │   }
│   │
│   └── [lang].json      ← 新言語は自動認識（ファイル置くだけ）
│
├── index.ts            ← i18next初期化・言語自動検出
│   ```typescript
│   import i18n from 'i18next'
│   import { initReactI18next } from 'react-i18next'
│   import ja from './locales/ja.json'
│   import en from './locales/en.json'
│
│   i18n.use(initReactI18next).init({
│     resources: { ja: { translation: ja }, en: { translation: en } },
│     lng: localStorage.getItem('language') || 'ja',
│     fallbackLng: 'ja',
│     interpolation: { escapeValue: false }
│   })
│   ```
│
├── types.ts            ← TypeScript完全型付け
│   ```typescript
│   type TranslationKeys = {
│     common: { appName: string; welcome: string }
│     pages: { dashboard: string; agents: string }
│     // ...
│   }
│   export type I18nNamespace = keyof TranslationKeys
│   ```
│
└── formatters.ts       ← ロケール固有フォーマッタ
    ```typescript
    export const formatDate = (locale: string, date: Date) => {
      return new Intl.DateTimeFormat(locale).format(date)
    }
    export const formatNumber = (locale: string, num: number) => {
      return new Intl.NumberFormat(locale).format(num)
    }
    ```
```

### 6.2 UI言語切替フロー

```
【React Components内での使用】
import { useTranslation } from 'react-i18next'

function InstanceGeneralSettings() {
  const { i18n, t } = useTranslation()

  return (
    <div>
      <h1>{t('pages.settings')}</h1>
      <select onChange={(e) => {
        i18n.changeLanguage(e.target.value)
        // 即時反映・全画面再レンダリング
        localStorage.setItem('language', e.target.value)
      }}>
        <option value="ja">{t('languages.japanese')}</option>
        <option value="en">{t('languages.english')}</option>
      </select>
    </div>
  )
}

【APIレスポンスも言語対応】
- UI: Accept-Language ヘッダ or ?lang=en query param
- API: 言語設定に基づいてエラーメッセージを返す
```

### 6.3 CLI言語制御

```
【環境変数による言語切替】
$ COMPANY_LANG=en company agent list
← CLI出力が全て英語

【config.jsonへの永続化】
~/.company-cli/config.json:
{
  "language": "ja",  ← デフォルト: 日本語
  "installationMethod": "docker",
  ...
}

【CLIヘルプの多言語対応】
$ company --help
→ COMPANY_LANG 環境変数の値で日本語/英語を切り替える

【非機能：機械翻訳化は将来】
- 初期リリース: ja / en のみ
- 新言語追加: locales/[lang].json をコミュー
```

### 6.4 DB言語設定の永続化

```
【companies テーブルの settings カラム】
- `settings`: JSON — 組織設定（defaultAgentType, anthropicApiKey, backup等）
  構造: {
    "defaultAgentType": "claude_local" | "claude_api",
    "anthropicApiKey": "sk-ant-...",
    "backup": {
      "enabled": boolean,
      "scheduleType": "daily" | "weekly" | "monthly",
      "scheduleTime": "HH:mm",
      "retentionDays": 7 | 14 | 30 | 60 | 90 | 180 | 365,
      "destinationType": "local" | "s3" | "gcs",
      "localPath": "/path/to/backup",
      "s3Bucket": "bucket-name",
      "s3Region": "ap-northeast-1",
      "gcsBucket": "bucket-name",
      "compressionType": "gzip" | "brotli",
      "encryptionEnabled": boolean,
      "includeActivityLog": boolean,
      "notifyEmail": "admin@example.com",
      "notifyOnFailure": boolean,
      "notifyOnSuccess": boolean
    }
  }

【instance_settings テーブル】
CREATE TABLE instance_settings (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'ja',  ← 'ja' or 'en'
  theme VARCHAR(20),
  other_setting VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
)

【初期化フロー】
1. company init 実行
2. 言語選択プロンプト → instance_settings に保存
3. 以降、Web UI InstanceGeneralSettings から変更可能
4. 変更時: instance_settings.language を更新 → 全画面即時反映
```

---

## 7. エージェントアダプター設計

### 7.1 共通インターフェース（TypeScript）

```typescript
// packages/adapters/src/base.ts

export enum AdapterType {
  CLAUDE_LOCAL = 'claude_local',
  CODEX_LOCAL = 'codex_local',
  CURSOR = 'cursor',
  GEMINI_LOCAL = 'gemini_local',
  OPENCLAW_GATEWAY = 'openclaw_gateway',
  OPENCODE_LOCAL = 'opencode_local',
  PI_LOCAL = 'pi_local'
}

export interface AdapterConfig {
  type: AdapterType
  cliPath?: string          ← CLI実行ファイルのパス
  apiKey?: string           ← APIキー（暗号化済み）
  customParams?: Record<string, unknown>
}

export interface HeartbeatContext {
  agentId: string
  agentName: string
  taskDescription: string
  previousState?: any
  config: AdapterConfig
  timeoutMs?: number       ← デフォルト: 30秒
}

export interface HeartbeatResult {
  success: boolean
  output: string            ← CLI実行の標準出力
  exitCode: number
  duration: number          ← 実行時間（ms）
  tokens?: {                ← トークン使用量（モデル別）
    model: string
    input: number
    output: number
    total: number
  }
  errors?: string[]
  logs: HeartbeatEvent[]
}

export interface HeartbeatEvent {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

export interface AgentAdapter {
  type: AdapterType

  // ハートビート実行（main operation）
  execute(context: HeartbeatContext): Promise<HeartbeatResult>

  // 設定テスト（接続確認）
  test(config: AdapterConfig): Promise<boolean>

  // モデル自動検出（インストール済みモデル一覧）
  detectModel(config: AdapterConfig): Promise<string | null>

  // アダプター固有の設定値検証
  validateConfig(config: AdapterConfig): Promise<{ valid: boolean; errors?: string[] }>

  // CLI自動検出（インストール済みCLIを検索）
  detectCli(): Promise<string | null>
}
```

### 7.2 アダプター実装パターン

```typescript
// packages/adapters/src/adapters/claude-local.ts

export class ClaudeLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.CLAUDE_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    const logs: HeartbeatEvent[] = []

    try {
      // 1. CLI パスの確認
      const cliPath = context.config.cliPath || (await this.detectCli())
      if (!cliPath) throw new Error('Claude Code CLI not found')

      // 2. コマンド構築
      const cmd = `${cliPath} --bare -p <<EOF\n${context.taskDescription}\nEOF`

      // 3. 実行（タイムアウト付き）
      const { stdout, stderr, exitCode } = await execAsync(cmd, {
        timeout: context.timeoutMs || 30000,
        maxBuffer: 10 * 1024 * 1024
      })

      // 4. トークン使用量計算（Claude APIではなく、ローカル実行なので0）
      const tokens = { model: 'claude-local', input: 0, output: 0, total: 0 }

      // 5. 結果構築
      return {
        success: exitCode === 0,
        output: stdout,
        exitCode,
        duration: Date.now() - startTime,
        tokens,
        logs
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        duration: 0,
        errors: [error.message],
        logs
      }
    }
  }

  async test(config: AdapterConfig): Promise<boolean> {
    try {
      const cliPath = config.cliPath || (await this.detectCli())
      const result = await execAsync(`${cliPath} --version`, { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async detectModel(config: AdapterConfig): Promise<string | null> {
    // Claude Code is always 'claude-local'
    return 'claude-local'
  }

  async detectCli(): Promise<string | null> {
    // which claude 実行 → パス返却
    const result = await execAsync('which claude', { timeout: 2000 })
    return result.exitCode === 0 ? result.stdout.trim() : null
  }

  async validateConfig(config: AdapterConfig): Promise<...> {
    // 設定値の妥当性チェック
  }
}
```

### 7.3 アダプター管理・レジストリ

```typescript
// packages/adapters/src/index.ts

class AdapterRegistry {
  private adapters: Map<AdapterType, AgentAdapter> = new Map()

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.type, adapter)
  }

  getAdapter(type: AdapterType): AgentAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) throw new Error(`Adapter not found: ${type}`)
    return adapter
  }

  async listAvailable(): Promise<AdapterType[]> {
    // インストール済みアダプターだけをリスト
    const available: AdapterType[] = []
    for (const [type, adapter] of this.adapters) {
      if (await adapter.detectCli()) {
        available.push(type)
      }
    }
    return available
  }

  async executeHeartbeat(
    agentId: string,
    config: AdapterConfig,
    context: HeartbeatContext
  ): Promise<HeartbeatResult> {
    const adapter = this.getAdapter(config.type)
    const result = await adapter.execute(context)

    // DB保存（heartbeat_runs テーブル）
    await db.insert(heartbeat_runs).values({
      agent_id: agentId,
      started_at: new Date(),
      exit_code: result.exitCode,
      output: result.output,
      duration_ms: result.duration,
      tokens_input: result.tokens?.input || 0,
      tokens_output: result.tokens?.output || 0,
      errors: result.errors?.join(', ')
    })

    // イベントログ保存（heartbeat_run_events テーブル）
    for (const event of result.logs) {
      await db.insert(heartbeat_run_events).values({
        heartbeat_run_id: runId,
        timestamp: event.timestamp,
        level: event.level,
        message: event.message
      })
    }

    return result
  }
}

export const adapterRegistry = new AdapterRegistry()

// 初期化時に全アダプターを登録
adapterRegistry.register(new ClaudeLocalAdapter())
adapterRegistry.register(new CodexLocalAdapter())
// ... etc
```

---

## 8. 認証・セキュリティ設計概要

### 8.1 Better Auth APIキー方式

```
【2種類のAPIキー】

1. Board APIキー（人間用・Web UIアクセス）
   ├─ 用途: Web UIのREST APIアクセス
   ├─ 発行: /api/auth/api-key/create
   ├─ 格納: browser localStorage (secure flag, httpOnly 推奨)
   ├─ 有効期限: 90日（自動更新可能）
   └─ 権限: Full CRUD （除外: Agent config編集・APIキー削除は要2FA）

2. Agent APIキー（CLI/エージェント用・秘密）
   ├─ 用途: CLI コマンド・ハートビート実行
   ├─ 発行: /api/agents/:id/api-key/create
   ├─ 格納: ~/.company-cli/config.json の secret セクション (AES-256-GCM暗号化)
   ├─ 有効期限: 無制限（手動削除まで）
   └─ 権限: そのエージェント専用（他エージェント・企業へのアクセス不可）

【Better Auth統合】
- Better Auth + PostgreSQL バックエンド
- User, Session, VerificationToken テーブル自動管理
- OAuth2サポート（GitHub/Google・将来）
```

### 8.2 APIキー実装

```typescript
// packages/api/src/middleware/auth.ts

export async function authenticateRequest(req: Request): Promise<{
  userId: string
  companyId: string
  apiKeyType: 'board' | 'agent'
}> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header')
  }

  const keyString = authHeader.slice(7)

  // 1. DB で キーハッシュ を検索
  const keyRecord = await db
    .select()
    .from(board_api_keys)
    .where(eq(board_api_keys.key_hash, bcrypt.hash(keyString)))
    .limit(1)

  if (!keyRecord.length) {
    throw new UnauthorizedError('Invalid API key')
  }

  // 2. 有効期限チェック
  if (keyRecord[0].expires_at && keyRecord[0].expires_at < new Date()) {
    throw new ForbiddenError('API key expired')
  }

  // 3. 利用回数・レート制限チェック
  const usageToday = await redis.incr(`api-key-usage:${keyString}:${TODAY}`)
  if (usageToday > API_RATE_LIMIT) {
    throw new TooManyRequestsError('Rate limit exceeded')
  }

  return {
    userId: keyRecord[0].user_id,
    companyId: keyRecord[0].company_id,
    apiKeyType: 'board'
  }
}

// Agent APIキーの場合
export async function authenticateAgentRequest(req: Request): Promise<{
  agentId: string
  companyId: string
}> {
  // 同様にハッシュ値を検索して復号化
  // ← コスト管理に使用（tokenカウント）
}
```

### 8.3 シークレット暗号化（AES-256-GCM）

```typescript
// packages/shared/src/utils/crypto.ts

import crypto from 'crypto'

export interface EncryptedSecret {
  iv: string        ← Base64 encoded
  ciphertext: string ← Base64 encoded
  tag: string       ← Base64 encoded
  algorithm: 'aes-256-gcm'
}

export function encryptSecret(
  plaintext: string,
  companyId: string,
  masterKey: string
): EncryptedSecret {
  const iv = crypto.randomBytes(16)

  // Derive unique key from company_id + master_key
  const derivedKey = crypto
    .createHmac('sha256', masterKey)
    .update(companyId)
    .digest()  // 32 bytes

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    ciphertext,
    tag: tag.toString('base64'),
    algorithm: 'aes-256-gcm'
  }
}

export function decryptSecret(
  encrypted: EncryptedSecret,
  companyId: string,
  masterKey: string
): string {
  const iv = Buffer.from(encrypted.iv, 'base64')
  const tag = Buffer.from(encrypted.tag, 'base64')

  const derivedKey = crypto
    .createHmac('sha256', masterKey)
    .update(companyId)
    .digest()

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv)
  decipher.setAuthTag(tag)

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

// 使用例
const secret = 'my_api_key_secret'
const encrypted = encryptSecret(secret, companyId, MASTER_KEY)
await db.insert(company_secrets).values({
  company_id: companyId,
  name: 'openai_api_key',
  encrypted_value: encrypted  ← JSON化して保存
})
```

---

## 9. Docker / ネイティブ インストール設計

### 9.1 Docker方式のインストール・初期化フロー

```
【Step 1: CLI インストール】
$ npm install -g @company/cli
→ ~/.npm/lib/node_modules/@company/cli に展開

【Step 2: 初期化（Docker方式）】
$ company init --docker

  → 以下の対話的セットアップ：
    1. 企業名入力: "Acme Corp"
    2. DBパスワード設定: (自動生成 or 入力)
    3. .company/CLAUDE.md から組織メタデータ読み込み
       └ company_name, members等を自動インポート

  → ~/.company-cli/ ディレクトリ作成
    ├── config.json (接続設定保存)
    ├── docker-compose.yml (コピー・カスタマイズ)
    ├── .env (DB_PASSWORD等)
    └── pgdata/ (ボリューム用)

  → docker compose up -d を自動実行
    ├─ db: PostgreSQL 17 コンテナ起動（volume: pgdata/）
    ├─ api: Express APIサーバー起動（port 3000）
    └─ 健全性チェック（10秒×5回まで）

  → 環境変数解決（2026-04-03 Codex修正）
    ├─ packages/api/src/index.ts が path.resolve(__dirname, '../../../') でリポジトリルートを解決
    ├─ packages/db/src/client.ts が同様にリポジトリルートを解決
    ├─ packages/db/src/migrate.ts が同様にリポジトリルートを解決
    ├─ packages/db/drizzle.config.ts が同様にリポジトリルートを解決
    └─ ルート .env と .env.development を明示的に読み込む
       理由: packages/api をカレントディレクトリにして起動すると、リポジトリルートの .env.development を読めなかった

  → Drizzle migrations 自動実行（変更後）
    └─ 旧方式: pnpm --filter @company/db migrate → tsx src/migrate.ts → Drizzle migrator（src/migrations が必要）
    └─ 新方式: pnpm --filter @company/db migrate → drizzle-kit push:pg（migration assets不要・即座に反映）
       理由: meta/_journal.json が存在せず旧方式ではセットアップ不可だった

  → 初期データ投入
    ├─ 企業レコード（input: Acme Corp）
    ├─ Admin ユーザー（自動生成）
    └─ デフォルト権限ロール

  → 設定ファイル保存（~/.company-cli/config.json）
    {
      "installationMethod": "docker",
      "companyName": "Acme Corp",
      "dbUrl": "postgresql://company:***@db:5432/company",
      "apiUrl": "http://localhost:3000",
      "language": "ja",
      "createdAt": "2026-04-03T..."
    }

【Step 3: Web UI確認】
$ company ui

  → ブラウザ自動起動（ローカルホスト:5173）
    ├─ Vite開発サーバー起動
    ├─ Reactアプリケーション読み込み
    └─ http://localhost:3000 の API に接続

【Step 4: 動作確認】
$ company agent list
→ Agents: (none) ← Admin権限でアクセス可

$ company doctor
→ Environment Check: ✅ All OK
  ├─ Docker: ✅ Running
  ├─ PostgreSQL: ✅ Responsive
  ├─ API Server: ✅ Healthy
  ├─ Version: CLI v1.0.0, API v1.0.0
  └─ .company/CLAUDE.md: ✅ Read
```

### 9.2 docker-compose.yml設定

```yaml
version: '3.8'

services:
  db:
    image: postgres:17-alpine
    container_name: company-db
    environment:
      POSTGRES_USER: company
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: company
    ports:
      - "5432:5432"
    volumes:
      - ./pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U company"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - company-network

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: company-api
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://company:${DB_PASSWORD}@db:5432/company
      JWT_SECRET: ${JWT_SECRET}
      MASTER_KEY: ${MASTER_KEY}
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - company-network
    user: "1000:1000"  ← non-root ユーザー

networks:
  company-network:
    driver: bridge

volumes:
  pgdata:
    driver: local
```

### 9.3 ネイティブ方式のインストール・初期化フロー

```
【前提】
- Node.js 20+ インストール済み
- PostgreSQL 17 サーバー起動済み（ローカル・クラウド等）

【Step 1: CLI インストール】
$ npm install -g @company/cli
→ ~/.npm/lib/node_modules/@company/cli に展開

【Step 2: 初期化（ネイティブ方式）】
$ company init --native \
  --db-url "postgresql://user:pass@localhost:5432/company_db"

  → 以下の対話的セットアップ：
    1. DB接続テスト（successful）
    2. 企業名入力: "Acme Corp"
    3. .company/CLAUDE.md から組織メタデータ読み込み

  → ~/.company-cli/ ディレクトリ作成
    ├── config.json
    └── logs/

  → 環境変数解決（2026-04-03 Codex修正）
    ├─ packages/api/src/index.ts が path.resolve(__dirname, '../../../') でリポジトリルートを解決
    ├─ packages/db/src/client.ts が同様にリポジトリルートを解決
    ├─ packages/db/src/migrate.ts が同様にリポジトリルートを解決
    ├─ packages/db/drizzle.config.ts が同様にリポジトリルートを解決
    └─ ルート .env と .env.development を明示的に読み込む

  → Drizzle migrations 実行（変更後）
    $ pnpm --filter @company/db migrate
    ├─ drizzle-kit push:pg を実行（migration assets不要）
    ├─ 61テーブル作成
    ├─ index・外部キー作成
    └─ trigger作成（Issue自動採番等）
       理由: meta/_journal.json が存在しなかったため、旧方式の Drizzle migrator では失敗していた

  → 初期データ投入（同一フロー）

  → 設定ファイル保存
    {
      "installationMethod": "native",
      "companyName": "Acme Corp",
      "dbUrl": "postgresql://user:pass@localhost:5432/company_db",
      "apiUrl": null,  ← サーバープロセスなし（CLI-only）
      "language": "ja"
    }

【Step 3: CLI直接実行（サーバープロセス不要）】
$ company agent list
→ CLI が直接PostgreSQL に接続して結果を取得
  ├─ HTTP不要（ローカルCLI使用）
  ├─ JSON出力
  └─ レスポンス: Agent (none)

【Step 4: Web UI（オプション・非対応）】
$ company ui
→ Error: Web UI requires Docker installation or separate API server
  → Recommendation: Use --docker method for Web UI support

【Step 5: 動作確認】
$ company doctor --native
→ Environment Check: ✅ All OK (Native Mode)
  ├─ Node.js: v20.11.0 ✅
  ├─ PostgreSQL: ✅ Responsive at localhost:5432
  ├─ Schema: ✅ 61 tables initialized
  └─ .company/CLAUDE.md: ✅ Read
```

### 9.4 Dockerfile.api（マルチステージビルド）

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm のインストール
RUN npm install -g pnpm

# ソースコピー
COPY . .

# 依存関係インストール
RUN pnpm install --frozen-lockfile

# TypeScript コンパイル & ビルド
RUN pnpm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# セキュリティ: non-root ユーザー作成
RUN addgroup -g 1000 company && \
    adduser -D -u 1000 -G company company

# pnpm インストール
RUN npm install -g pnpm

# Builder から成果物をコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle ./drizzle

# 権限設定
RUN chown -R company:company /app

# ユーザー切り替え
USER company

# ヘルスチェック
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# ポート公開
EXPOSE 3000

# サーバー起動
CMD ["node", "dist/api/src/index.js"]
```

---

## 10. 評価ループ設計（フェーズ別）

### 10.1 Phase 1: Core Foundation チェックリスト

```
【実装完了後の評価】
□ npm install -g @company/cli できる（Docker + ネイティブ両方）
□ company init --docker で PostgreSQL + API サーバー起動できる
  └ 60秒以内に起動完了・ヘルスチェック成功
□ company init --native --db-url で外部DB接続できる
  └ Drizzle migrations 自動実行・61テーブル作成確認
□ company org show で組織情報表示できる（Admin権限）
□ .company/CLAUDE.md から組織設定を読み込めて DB に保存できる
□ 日本語/英語の i18n 基盤が動作する（UI + CLI）
  └ COMPANY_LANG=en company --help で英語出力確認

【品質基準（5軸・各5段階）】
| 軸 | 評価内容 | 通過基準 |
|----|---------|--------|
| 1 | 要件充足 | Phase 1 要件を全て満たしているか | 4点以上 |
| 2 | 構成の正確性 | Monorepo・パッケージ分割が仕様通りか | 4点以上 |
| 3 | CLI/API動作 | 各種コマンド・API呼び出しが正確に動作するか | 4点以上 |
| 4 | エラー処理 | 異常系（DB接続失敗・不正入力等）を適切に処理するか | 4点以上 |
| 5 | セットアップ手順 | README通りに進めば誰でも成功するか | 4点以上 |

**合計20点以上 かつ 各軸4点以上 で "通過" → Phase 2へ**
**24点以下は差し戻し → 改善して再評価**

【テスト方法】
$ npm test                 ← Vitest (単体テスト、80%カバレッジ目標)
$ docker compose up -d     ← Docker起動確認
$ company init --docker    ← 初期化フロー確認
$ company doctor           ← 環境診断実行
```

### 10.2 総合評価ループ（全Phase共通）

```
開発部が実装完了
  ↓
【1次チェック】開発部: 単体テスト100% pass確認
  ← Vitest coverage レポート出力
  ↓
【2次チェック】開発部・QA: 統合テスト（API実動作確認）
  ← Docker Compose 起動状態でのテスト
  ↓
【3次チェック】対象部署: ユーザーテスト（実際に使ってみる）
  ← Phase別に割り当て部署が異なる
    - Phase 1-2: 開発部・PM部がテスト
    - Phase 3-5: 業務部署（営業・インテリジェンス等）がテスト
  ↓
【4次チェック】文章管理部: ドキュメント確認
  ← README・API仕様・コマンドヘルプが適切か
  ↓
【5次チェック】戦略顧問室（Kenji主査）: 総合評価
  ← 5軸25点評価（通過ライン: 20点以上 かつ 各軸4点以上）
  ↓
  ├─ 24点以下 → 差し戻し + 改善指示
  │   ↓
  │   開発部が改善 → 再テスト（1次から繰り返し）
  │   ↓
  │   再評価（25点達成まで繰り返す）
  │
  └─ 25点達成 → 次フェーズへ移行・changelog記録
```

---

## 9. Web設定画面（Settings）

### 9.1 設定管理 API（`/api/settings`）

```
GET /api/settings
  → 組織設定を取得（APIキーはマスク返却）
  レスポンス例:
  {
    "defaultAgentType": "claude_local",
    "anthropicApiKey": "sk-ant-***...***",  ← マスク表示
    "backup": { ... }
  }

PATCH /api/settings
  → 組織設定を部分更新（マージ方式）
  リクエスト例:
  {
    "defaultAgentType": "claude_api",
    "anthropicApiKey": "sk-ant-v..."
  }
```

### 9.2 設定項目テーブル

| カテゴリ | 設定項目 | 型 |
|---------|---------|-----|
| エージェント実行モード | `defaultAgentType` | `"claude_local"` \| `"claude_api"` |
| APIキー | `anthropicApiKey` | string（`claude_api`選択時に必須） |
| 組織情報 | `name` | string |
| 組織情報 | `description` | string |
| バックアップ | `enabled` | boolean |
| バックアップ | `scheduleType` | `"daily"` \| `"weekly"` \| `"monthly"` |
| バックアップ | `scheduleTime` | `"HH:mm"` 形式 |
| バックアップ | `retentionDays` | 7 \| 14 \| 30 \| 60 \| 90 \| 180 \| 365 |
| バックアップ | `destinationType` | `"local"` \| `"s3"` \| `"gcs"` |
| バックアップ | `localPath` | string（パストラバーサル検出実装） |
| バックアップ | `s3Bucket` | string |
| バックアップ | `s3Region` | string |
| バックアップ | `gcsBucket` | string |
| バックアップ | `compressionType` | `"gzip"` \| `"brotli"` |
| バックアップ | `encryptionEnabled` | boolean |
| バックアップ | `includeActivityLog` | boolean |
| バックアップ | `notifyEmail` | string |
| バックアップ | `notifyOnFailure` | boolean |
| バックアップ | `notifyOnSuccess` | boolean |

### 9.3 バックアップ設定仕様

**保存方式**: `companies.settings` JSON カラムに保存（スキーマレス）

**バリデーション**:
- `scheduleTime` は `HH:mm` 形式（例: `"09:30"`）
- `retentionDays` は許可リスト `[7, 14, 30, 60, 90, 180, 365]` のみ
- `anthropicApiKey` は `sk-ant-` プレフィックスで検証

**セキュリティ**:
- パストラバーサル検出（`../` を含むパスは拒否）
- APIキーは DB 保存時に暗号化（AES-256-GCM）

**一貫性チェック**:
- `PATCH /api/settings` 後、`defaultAgentType` が `claude_api` かつ `anthropicApiKey` 未設定の場合は 400 エラーを返す
- エラーレスポンス: `{ "error": "validation_failed", "message": "claude_api requires anthropicApiKey" }`

---

## 改訂履歴

| 版 | 作成日 | 変更内容 | 担当 |
|----|--------|---------|------|
| v2.1 | 2026-04-03 | PR#1 変更内容を反映：env解決ポリシー変更（リポジトリルート明示的解決）、DB bootstrap方式変更（drizzle-kit push:pg に統一）、Docker・ネイティブ両方式でのセットアップ手順更新 | 開発部（Omar） |
| v2.0 | 2026-04-03 | claude_api アダプター・設定API・バックアップ設定機能を追加（/api/settings、companies.settings カラム） | 開発部（David） × 戦略顧問室（Kenji） |
| v1.0 | 2026-04-03 | 初版作成：システム構成図・パッケージ構成・画面遷移・APIルート・DB設計・多言語・アダプター・認証・インストール・評価ループ | 開発部（David） × 戦略顧問室（Kenji） |

---

## 自己チェックリスト（評価ループ用）

```
□ システム構成図: Docker方式・ネイティブ方式の2パターンを図示済み
□ Monorepo構成: packages/ 内に api・cli・ui・db・adapters・i18n・shared を明記
□ 画面遷移図: 認証フロー・メイン機能・ルーティン・設定まで全40画面を階層表記
□ APIルート: 9グループ×10-15エンドポイント、全100+ endpoints を網羅
□ DB設計: 61テーブルをグループA-H別に ER図を含めて明記
□ 多言語: react-i18next + CLI環境変数 + DB永続化の3層設計を記載
□ アダプター: 共通インターフェース定義 + 8種実装パターンを示唆
□ セキュリティ: 2種APIキー・シークレット暗号化（AES-256-GCM）を設計
□ インストール: Docker方式・ネイティブ方式の初期化フローを詳細記載
□ 評価ループ: Phase 1 チェックリスト + 5軸評価フォーマットを明記
□ 改訂履歴: 版番号・作成日・担当者を記録済み
```

---

## 次のステップ（Phase 2以降）

このW2基本設計書をベースに以下を実施：

1. **実装フェーズ（W3-W7）**
   - packages/ 各パッケージの詳細設計・実装
   - 単体テスト（Vitest）・統合テスト（Docker）
   - E2E テスト（Playwright）

2. **W8: 機能改善**
   - Paperclip既知バグ修正
   - パフォーマンス最適化
   - Clipmart（テンプレートマーケット）実装

3. **W9: セキュリティ強化**
   - OWASP Top 10全項目対応
   - 脆弱性スキャン・監査
   - 依存関係脆弱性ゼロ維持

---

**End of Design Document**
