# company-cli

> **AIエージェントによる業務自動化を、既存システムと連携しながら安全に運用するためのバックエンド基盤**
>
> *A secure backend platform for running AI agent workflows integrated with your existing business systems.*

---

## 日本語

### 背景・解決する課題

AIエージェントを業務に導入しようとすると、次の問題に直面します。

- **「AIが何をしているかわからない」** — 動作ログが残らず、トラブル時に原因が追えない
- **「コストが膨らむ」** — API費用が青天井になるリスクがあり、現場に任せにくい
- **「既存ツールと繋がらない」** — SlackやNotionとの連携に毎回カスタム開発が必要
- **「承認なしに動いてしまう」** — AIが人間の確認なしにタスクを実行し、誤操作のリスクがある

**company-cli** はこれらを一括で解決する、AIエージェント管理バックエンドです。

> ゼロから構築する場合と比べ、AIエージェント管理基盤の立ち上げ工数を大幅に削減できます。
> REST APIで接続するため、既存の社内システムやツールをそのまま活かせます。

---

### できること（ビジネス価値）

#### 1. AIエージェントの安全な運用管理

複数のAIエージェント（Claude・GPT・Gemini など）を一元管理します。

- **自動再起動**: エージェントがクラッシュしても即時復旧。夜間・休日も無人で稼働継続
- **予算上限による自動停止**: APIコストが設定値を超えると自動でエージェントを停止。コスト超過ゼロ
- **Heartbeat監視**: 60秒ごとに稼働状態を確認。異常を即時検知して担当者に通知

> **効果**: AIの「暴走」「放置」「コスト超過」を仕組みで防止。夜間・休日の監視コストをゼロに近づけられます。

#### 2. タスク・承認フローの自動化

タスク（Issue）を登録すると、適切なエージェントへ**自動でアサイン**されます。

- **自動担当割り当て**: 空きエージェントにタスクを自動配分。担当決めの手間ゼロ
- **人間による承認フロー**: AIが実行する前に担当者の承認を必須にするフローを設定可能
- **目標との紐付け**: 各タスクを上位目標に連携。「なぜそのタスクをやるか」が常に明確

> **効果**: 「AIに任せたいが、重要な判断は人間がしたい」というニーズに対応。安心して自動化を進められる。

#### 3. 目標達成率のリアルタイム可視化

「売上目標達成率」「Issue解決率」など、KPIを登録しておくと**タスク完了に連動して自動更新**されます。

- 手動での進捗集計が不要になる
- 経営陣・クライアントへのレポートをリアルタイムデータで即座に出力できる

> **効果**: 週次・月次の進捗集計を自動化。手作業によるデータ集計ミスをゼロにし、報告準備にかかる時間を大幅に短縮できます。

#### 4. 外部サービスとのノーコード連携

Slack・Notion・GitHub・Zapier など、Webhookに対応する任意のサービスと連携できます。

- 「エージェントがタスクを完了 → Slackで通知」
- 「予算アラート → 担当者にメール」
- 「Issue作成 → GitHubにチケット起票」

設定はAPIを叩くだけ。カスタム開発は不要です。

> **効果**: 既存の業務ツールをそのまま活かしながら、AIワークフローを追加できる。

#### 5. 全操作の監査ログ自動記録

誰が・いつ・何をしたかを全て自動で記録します。

- AIエージェントの操作履歴も完全にトレース可能
- 「AIがいつ何を変更したか」を後から調査できるため、コンプライアンス対応や障害調査が容易

> **効果**: AI導入後の「説明責任」と「ガバナンス」を確保。監査・内部統制にも対応。

---

### 導入事例イメージ

| シナリオ | 使い方 |
|---------|--------|
| **社内ヘルプデスク自動化** | Issueにユーザーの問い合わせを登録 → AIエージェントが自動で回答案を作成 → 担当者が承認して送信 |
| **定期レポート自動生成** | 毎週月曜にルーティンを設定 → AIが先週のデータを収集・整形 → Slackに自動投稿 |
| **コスト管理の効率化** | プロジェクトごとにAI APIの使用コストを記録 → 月次コストレポートを自動集計 |
| **マルチエージェント協調** | 調査エージェント・執筆エージェント・レビューエージェントを連携させて、コンテンツ制作を自動化 |

---

### システム要件・技術仕様

| 項目 | 仕様 |
|------|------|
| **APIプロトコル** | REST API（JSON）|
| **認証方式** | APIキー認証（Bearer トークン）|
| **互換性** | 標準 REST API（JSON）|
| **データベース** | PostgreSQL 17 |
| **サーバー** | Node.js 18+ / Express.js |
| **フロントエンド** | React + Vite（Web管理画面付属）|
| **多言語** | 日本語・英語（react-i18next）|
| **デプロイ** | Docker / Docker Compose 対応 |
| **ライセンス** | MIT |

---

### セキュリティ対策

企業利用を前提としたセキュリティを標準実装しています。

| 対策 | 内容 |
|------|------|
| XSS対策 | 全入力値のHTMLエンティティエスケープ |
| SQLインジェクション対策 | Drizzle ORM のパラメータ化クエリ（全エンドポイント） |
| レート制限 | 15分あたり100リクエスト（認証エンドポイントは10回） |
| セキュリティヘッダー | Helmet.js による CSP・X-Content-Type-Options・X-Frame-Options 等 |
| CORS制御 | 許可オリジンのホワイトリスト管理 |
| データ暗号化 | AES-256-GCM による機密データの暗号化保存 |
| 依存関係 | `pnpm audit` で既知の脆弱性ゼロを確認済み |

---

### セットアップ

#### 必要なもの

- [Node.js 18以上](https://nodejs.org/)
- [pnpm](https://pnpm.io/)（`npm install -g pnpm`）
- [Docker](https://www.docker.com/)

#### インストール手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/naotantan/company-cli.git
cd company-cli

# 2. 依存関係をインストール
pnpm install

# 3. 環境変数を設定
cp .env.example packages/api/.env
# packages/api/.env を編集して API_KEY_SALT と ENCRYPTION_KEY を設定

# 4. データベースを起動
docker compose up -d

# 5. マイグレーションを実行
pnpm --filter @company/db migrate

# 6. APIサーバーを起動（ポート3000）
pnpm --filter @company/api dev

# 7. Web管理画面を起動（ポート5173・オプション）
pnpm --filter @company/ui dev
```

動作確認: `http://localhost:3000/health` → `{"status":"ok","database":"connected"}`

#### 最初の会社登録・APIキー取得

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "株式会社Example", "email": "admin@example.com", "password": "yourpassword"}'
```

レスポンスの `apiKey`（`comp_live_...`）を保存してください。以降の全リクエストで使用します。

---

### 主要APIエンドポイント

| メソッド | パス | 用途 |
|---------|------|------|
| GET | `/health` | 死活監視（認証不要） |
| POST | `/api/auth/register` | 会社・ユーザー登録 |
| POST | `/api/auth/login` | ログイン・APIキー取得 |
| GET/POST | `/api/agents` | エージェント一覧・登録 |
| GET/POST | `/api/issues` | タスク一覧・作成（自動アサイン） |
| GET/POST | `/api/goals` | 目標一覧・設定 |
| POST | `/api/goals/:id/recalculate` | 達成率を再計算 |
| GET/POST | `/api/projects` | プロジェクト管理 |
| GET/POST | `/api/costs` | コスト記録・集計 |
| GET/POST | `/api/plugins` | プラグイン管理 |
| GET/POST | `/api/plugins/:id/webhooks` | Webhook設定 |
| GET | `/api/activity` | 全操作ログ取得 |

---

### お問い合わせ・導入相談

導入検討・技術的なご質問は [GitHub Issues](https://github.com/naotantan/company-cli/issues) からお気軽にどうぞ。

> まずは `docker compose up -d && pnpm dev` でローカル環境を動かしてみてください。
> 5分でAPIが立ち上がり、実際の動作を確認できます。

---

---

## English

### The Problem

Adopting AI agents in business operations often runs into the same obstacles:

- **No visibility** — Agents run silently, and when something goes wrong there's no trace of what happened
- **Runaway costs** — API fees accumulate with no automatic safeguard to stop overspending
- **Integration friction** — Connecting AI workflows to Slack, Notion, or GitHub requires custom development every time
- **No human oversight** — Agents execute tasks without human approval, creating risk of errors going unnoticed

**company-cli** addresses all of these in a single backend platform.

> Built on standard REST APIs, it connects to your existing systems without rebuilding your stack.
> Deploy it yourself and reduce the time-to-launch for an AI operations layer from months to days.

---

### Business Value

#### 1. Safe, Reliable AI Agent Operations

Manage multiple AI agents (Claude, GPT, Gemini, etc.) from one place.

- **Auto-restart on crash**: Agents recover immediately without human intervention — run 24/7 with confidence
- **Budget-based auto-stop**: Set a spending limit and agents halt automatically when it's reached — no surprise invoices
- **Heartbeat monitoring**: Status is checked every 60 seconds; anomalies are detected and surfaced instantly

> **Impact**: Eliminate "runaway AI," unattended processes, and cost overruns — structurally, not by manual monitoring.

#### 2. Task Automation with Human-in-the-Loop Approval

Create a task (Issue) and it is **automatically assigned** to an available agent.

- **Auto-assignment**: No manual delegation — the system routes work to the right agent
- **Approval gates**: Require human sign-off before an agent executes a task — keep critical decisions in human hands
- **Goal linkage**: Every task is connected to a business objective, so nothing is done without a reason

> **Impact**: Automate confidently without surrendering control. Teams can set the threshold for when human review is required.

#### 3. Real-Time Goal Progress Tracking

Register KPIs such as "resolve 90% of issues this week" or "keep monthly AI spend under $500."
Progress **updates automatically** as tasks are completed — no manual aggregation.

- Eliminate weekly status-reporting overhead
- Provide live data for management dashboards and client reporting

> **Impact**: Save hours of manual reporting per week. Eliminate spreadsheet errors.

#### 4. No-Code Integration with Existing Tools

Connect to Slack, Notion, GitHub, Zapier, or any Webhook-capable service.

- Agent completes a task → send Slack notification
- Budget threshold hit → email the team lead
- Issue created → open a GitHub ticket automatically

Configuration is API-only. No custom code required.

> **Impact**: Plug AI workflows into the tools your team already uses — no rearchitecting required.

#### 5. Immutable Audit Trail

Every operation — human or AI — is logged automatically with a timestamp.

- Full traceability of what each agent changed and when
- Supports compliance, incident investigation, and internal audits

> **Impact**: Maintain accountability and governance as AI takes on more operational responsibility.

---

### Use Cases

| Scenario | How it works |
|----------|-------------|
| **Internal helpdesk automation** | Log user queries as Issues → AI agent drafts responses → human approves and sends |
| **Automated weekly reports** | Schedule a Routine every Monday → agent collects data → posts summary to Slack |
| **AI cost governance** | Record API spend per project → auto-generate monthly cost reports |
| **Multi-agent pipelines** | Chain research, writing, and review agents to automate content production end-to-end |

---

### Technical Specifications

| Item | Spec |
|------|------|
| **API Protocol** | REST API (JSON) |
| **Authentication** | API key (Bearer token) |
| **Compatibility** | Standard REST API (JSON) |
| **Database** | PostgreSQL 17 |
| **Server** | Node.js 18+ / Express.js |
| **Frontend** | React + Vite (Web dashboard included) |
| **Internationalization** | Japanese / English (react-i18next) |
| **Deployment** | Docker / Docker Compose ready |
| **License** | MIT |

---

### Security

Enterprise-grade security is built in by default.

| Measure | Implementation |
|---------|---------------|
| XSS Prevention | HTML entity escaping on all user inputs |
| SQL Injection Prevention | Parameterized queries via Drizzle ORM across all endpoints |
| Rate Limiting | 100 requests / 15 min global; 10 requests / 15 min on auth endpoints |
| Security Headers | Helmet.js — CSP, X-Content-Type-Options, X-Frame-Options, etc. |
| CORS Control | Whitelist-based allowed origins |
| Data Encryption | AES-256-GCM for sensitive data at rest |
| Dependency Audit | Zero known vulnerabilities verified by `pnpm audit` |

---

### Getting Started

#### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- [Docker](https://www.docker.com/)

#### Installation

```bash
# 1. Clone the repository
git clone https://github.com/naotantan/company-cli.git
cd company-cli

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example packages/api/.env
# Edit packages/api/.env — set API_KEY_SALT and ENCRYPTION_KEY

# 4. Start the database
docker compose up -d

# 5. Run database migrations
pnpm --filter @company/db migrate

# 6. Start the API server (port 3000)
pnpm --filter @company/api dev

# 7. Start the Web dashboard (port 5173 — optional)
pnpm --filter @company/ui dev
```

Verify: `http://localhost:3000/health` → `{"status":"ok","database":"connected"}`

#### Register Your Organization

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com", "password": "yourpassword"}'
```

Save the `apiKey` from the response (prefix: `comp_live_`). All subsequent requests require this key.

---

### API Reference

All authenticated requests require: `Authorization: Bearer <api_key>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/api/auth/register` | Register organization + user |
| POST | `/api/auth/login` | Login and retrieve API key |
| GET/POST | `/api/agents` | List / register agents |
| GET/POST | `/api/issues` | List / create tasks (auto-assigned) |
| POST | `/api/issues/:id/goals` | Link task to goal |
| GET/POST | `/api/goals` | List / create goals |
| POST | `/api/goals/:id/recalculate` | Recalculate goal progress |
| GET/POST | `/api/projects` | List / manage projects |
| GET/POST | `/api/costs` | List / record costs |
| GET/POST | `/api/plugins` | List / create plugins |
| GET/POST | `/api/plugins/:id/webhooks` | Configure webhooks |
| GET | `/api/activity` | Retrieve full activity log |

---

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://company:changeme@localhost:5432/company` |
| `PORT` | API server port | `3000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `ENABLE_ENGINE` | Enable heartbeat engine | `false` |
| `API_KEY_SALT` | Salt for API key hashing | **Required** |
| `ENCRYPTION_KEY` | Encryption key (32+ characters) | **Required** |
| `RATE_LIMIT_MAX` | Max requests per 15 min | `100` (prod) / `1000` (dev) |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |

---

### Project Structure

```
company-cli/
├── packages/
│   ├── shared/     # Shared types and utilities
│   ├── db/         # Drizzle ORM schema and migrations
│   ├── api/        # Express.js REST API server
│   ├── cli/        # Command-line interface
│   ├── ui/         # React web dashboard
│   ├── adapters/   # AI adapter integrations (Claude, GPT, Gemini, etc.)
│   └── i18n/       # Localization files (ja / en)
├── docker-compose.yml
└── .env.example
```

---

### Contact & Inquiries

For enterprise inquiries, integration questions, or technical support, open an issue on [GitHub](https://github.com/naotantan/company-cli/issues).

> **Try it in 5 minutes**: `docker compose up -d && pnpm dev` spins up a fully working local environment.
> No account or sign-up required.
