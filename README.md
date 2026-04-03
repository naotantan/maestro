# company-cli

**AIエージェント対応の会社業務管理システム**

AI-powered company management system compatible with Paperclip v0.3.1

---

## 日本語

### これは何？

会社の日常業務を管理するWebシステムです。
「誰がどの仕事をしているか」「プロジェクトの進み具合」「コストの記録」などを一元管理できます。
Paperclip（AIエージェントを使って会社を運営するツール）と同じAPIを持っており、AIエージェントからも操作できます。

### 何ができるの？

#### AIエージェント管理
複数のAIエージェント（Claude・GPT・Gemini など）をひとつの画面で登録・監視できます。
エージェントが落ちたら**自動で再起動**し、予算上限を超えたら**自動で停止**します。
「どのエージェントが今何をしているか」をリアルタイムで把握できるので、AIを使った業務自動化を安心して任せられます。

#### Issue（タスク）管理
タスクを登録すると、登録済みのエージェントに**自動で担当を割り当て**ます。
タスクには承認フローを設定でき、「AIが実行していいか人間が確認する」という安全なワークフローを作れます。
また、タスクを目標（Goal）と紐付けることで「この作業は何のためにやっているか」が明確になります。

#### Goal（目標）管理
「月間コスト削減10%」「Issue解決率90%以上」といった目標を登録しておくと、タスクの完了状況から**達成率を自動で計算**して更新します。
「目標に対して今どこまで進んでいるか」が常に数字で見えるため、進捗報告の手間がなくなります。

#### Project・コスト管理
プロジェクトごとにAIの使用コスト（API費用など）を記録・追跡できます。
毎日・毎週など定期的に繰り返すタスク（ルーティン）も登録でき、「忘れがちな定期作業」を自動化できます。

#### Plugin・Webhook連携
Slack・Notion・GitHub など外部サービスへのWebhookを設定できます。
「エージェントがタスクを完了したらSlackに通知する」といった連携が、コードを書かずにAPIだけで実現できます。

#### 全操作の自動ログ記録
誰が・いつ・何をしたか、全ての操作を自動で記録します。
「AIがいつ何を変更したか」のトレースができるため、AIが誤動作した際の原因調査が容易になります。

### 使っている技術

初めての人向けに説明すると、こんな技術で作られています：

- **バックエンド（サーバー）**: Node.js + TypeScript + Express.js
- **データベース**: PostgreSQL（Docker で簡単に起動できます）
- **フロントエンド（画面）**: React + Vite
- **CLI（コマンドライン）**: Node.js コマンドラインツール
- **パッケージ管理**: pnpm（高速なパッケージマネージャー）

### セットアップ（始め方）

#### 必要なもの

- [Node.js 18以上](https://nodejs.org/) — JavaScriptを動かす環境
- [pnpm](https://pnpm.io/) — パッケージマネージャー（`npm install -g pnpm` でインストール）
- [Docker](https://www.docker.com/) — データベースを動かすために必要

#### 手順

**1. このリポジトリをダウンロード**
```bash
git clone https://github.com/naotantan/company-cli.git
cd company-cli
```

**2. 必要なパッケージをインストール**
```bash
pnpm install
```

**3. 設定ファイルを作成**
```bash
cp .env.example packages/api/.env
```

`.env` ファイルを開いて、以下を設定してください：

```env
# データベース接続先（そのままでOK）
DATABASE_URL=postgresql://company:changeme@localhost:5432/company

# セキュリティ用キー（自分で決めた文字列を設定）
API_KEY_SALT=ここに好きな文字列を入力
ENCRYPTION_KEY=32文字以上の好きな文字列を入力してください
```

**4. データベースを起動**
```bash
docker compose up -d
```

**5. データベースの初期設定**
```bash
pnpm --filter @company/db migrate
```

**6. APIサーバーを起動**
```bash
pnpm --filter @company/api dev
```

ブラウザで `http://localhost:3000/health` を開いて `{"status":"ok"}` と表示されれば成功です！

**7. Web管理画面を起動（オプション）**
```bash
pnpm --filter @company/ui dev
```

ブラウザで `http://localhost:5173` を開くと管理画面が表示されます。

### 最初のユーザー登録

```bash
# 会社を登録してAPIキーを取得
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My Company", "email": "admin@example.com", "password": "yourpassword"}'
```

レスポンスに含まれる `apiKey`（`comp_live_...` で始まる文字列）を控えておいてください。
以降のAPIリクエストは全てこのキーを使います。

```bash
# APIキーを使ってエージェント一覧を取得
curl http://localhost:3000/api/agents \
  -H "Authorization: Bearer comp_live_YOUR_KEY_HERE"
```

### 主要なAPI一覧

| HTTPメソッド | パス | 説明 |
|------------|------|------|
| GET | `/health` | サーバーの動作確認（認証不要） |
| POST | `/api/auth/register` | ユーザー・会社の新規登録 |
| POST | `/api/auth/login` | ログイン・APIキー取得 |
| GET/POST | `/api/agents` | エージェント一覧・新規作成 |
| GET/POST | `/api/issues` | タスク一覧・新規作成 |
| GET/POST | `/api/goals` | 目標一覧・新規作成 |
| GET/POST | `/api/projects` | プロジェクト一覧・新規作成 |
| GET/POST | `/api/costs` | コスト一覧・記録 |
| GET/POST | `/api/plugins` | プラグイン一覧・作成 |

### テストの実行

```bash
# 全テストを実行
pnpm test

# カバレッジ付きテスト（packages/api のみ）
pnpm --filter @company/api test --coverage
```

### セキュリティについて

このシステムはW9セキュリティ強化フェーズで以下のセキュリティ対策を実装しています：

- **XSS対策**: 全入力値のHTMLエンティティエスケープ
- **SQLインジェクション対策**: Drizzle ORM のパラメータ化クエリ
- **レート制限**: 15分あたり100リクエスト（認証エンドポイントは10回）
- **セキュリティヘッダー**: Helmet.js による CSP・X-Content-Type-Options 等
- **CORS**: 許可オリジンのホワイトリスト制御
- **依存関係**: pnpm audit で脆弱性ゼロを確認済み

### よくある質問

**Q: Docker を使わずに動かせる？**
A: PostgreSQL を直接インストールしても使えます。`DATABASE_URL` に接続先を設定してください。

**Q: ポートを変えたい**
A: `.env` ファイルの `PORT` を変更してください（デフォルト: 3000）。

**Q: データを全部消してやり直したい**
A: `docker compose down -v` でコンテナとデータを削除してから `docker compose up -d` で再起動できます。

---

## English

### What is this?

company-cli is a full-stack company management system compatible with the Paperclip v0.3.1 API.
It provides tools to manage AI agents, tasks (issues), goals, projects, and costs — all through a REST API and a React web interface.

This is especially useful if you want to build and run a "virtual company" powered by AI agents.

### Features

#### AI Agent Management
Register and monitor multiple AI agents (Claude, GPT, Gemini, etc.) from a single interface.
If an agent crashes, it **automatically restarts**. If it exceeds your budget, it **automatically stops**.
You always know which agent is doing what — so you can safely hand off automated work to AI without worrying about runaway processes or costs.

#### Issue (Task) Tracking
Create a task and it gets **automatically assigned** to a registered agent.
You can add an approval step so a human confirms before the AI acts — useful when you want AI to do the work but keep humans in the loop.
Link tasks to goals to keep every piece of work tied to a bigger purpose.

#### Goal Management
Define a goal like "reduce monthly API cost by 10%" or "resolve 90% of issues this week."
As tasks get completed, the **progress percentage updates automatically** — no manual reporting needed.
You can always see exactly how far along you are toward each goal.

#### Project & Cost Tracking
Track AI API costs per project so you always know what you're spending.
Set up recurring routines (daily summaries, weekly reviews, etc.) so nothing falls through the cracks.

#### Plugin & Webhook Integration
Connect to Slack, Notion, GitHub, or any service that accepts webhooks.
For example: "notify Slack when an agent completes a task" — no custom code required, just configure it through the API.

#### Full Activity Log
Every action — who did what, when — is recorded automatically.
When something goes wrong, you can trace exactly what the AI changed and when, making debugging fast and reliable.

### Tech Stack

| Layer | Technology |
|-------|------------|
| API Server | Node.js + TypeScript + Express.js |
| Database | PostgreSQL 17 (Docker) + Drizzle ORM |
| Frontend | React + Vite + TypeScript |
| CLI | Node.js command-line tool |
| Auth | API key authentication (Bearer token) |
| Package Manager | pnpm (monorepo) |

### Getting Started

#### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — Install with `npm install -g pnpm`
- [Docker](https://www.docker.com/) — For the PostgreSQL database

#### Installation

**Step 1: Clone the repository**
```bash
git clone https://github.com/naotantan/company-cli.git
cd company-cli
```

**Step 2: Install dependencies**
```bash
pnpm install
```

**Step 3: Configure environment variables**
```bash
cp .env.example packages/api/.env
```

Edit `packages/api/.env` and set the following required values:

```env
# Database connection (default works with Docker setup)
DATABASE_URL=postgresql://company:changeme@localhost:5432/company

# Security keys (set your own strings)
API_KEY_SALT=any-random-string-here
ENCRYPTION_KEY=must-be-at-least-32-characters-long
```

**Step 4: Start the database**
```bash
docker compose up -d
```

**Step 5: Run database migrations**
```bash
pnpm --filter @company/db migrate
```

**Step 6: Start the API server**
```bash
pnpm --filter @company/api dev
```

Visit `http://localhost:3000/health` — you should see `{"status":"ok","database":"connected"}`.

**Step 7 (Optional): Start the Web UI**
```bash
pnpm --filter @company/ui dev
```

Visit `http://localhost:5173` to access the management dashboard.

### First Steps: Register Your Company

```bash
# Register a new company and get your API key
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My Company", "email": "admin@example.com", "password": "yourpassword"}'
```

Save the `apiKey` from the response (it starts with `comp_live_`). You'll need it for all API calls.

```bash
# Use your API key to list agents
curl http://localhost:3000/api/agents \
  -H "Authorization: Bearer comp_live_YOUR_KEY_HERE"
```

### API Reference

All authenticated endpoints require the header: `Authorization: Bearer <api_key>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| POST | `/api/auth/register` | Register company + user |
| POST | `/api/auth/login` | Login and get API key |
| GET/POST | `/api/agents` | List / create agents |
| GET/POST | `/api/issues` | List / create issues (auto-assigns to agents) |
| POST | `/api/issues/:id/goals` | Link issue to a goal |
| GET/POST | `/api/goals` | List / create goals |
| POST | `/api/goals/:id/recalculate` | Recalculate goal progress |
| GET/POST | `/api/projects` | List / create projects |
| GET/POST | `/api/costs` | List / record costs |
| GET/POST | `/api/routines` | List / create routines |
| GET | `/api/approvals` | List approval requests |
| GET | `/api/activity` | Activity log |
| GET/POST | `/api/plugins` | List / create plugins |
| GET/POST | `/api/plugins/:id/webhooks` | List / create webhooks |

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage (api package only)
pnpm --filter @company/api test --coverage
```

### Project Structure

```
company-cli/
├── packages/
│   ├── shared/     # Shared types and utilities
│   ├── db/         # Drizzle ORM schema and migrations
│   ├── api/        # Express.js REST API server
│   ├── cli/        # Command-line interface
│   ├── ui/         # React web frontend
│   ├── adapters/   # External AI adapter integrations
│   └── i18n/       # Internationalization (ja/en)
├── docker-compose.yml
├── .env.example
└── package.json
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://company:changeme@localhost:5432/company` |
| `PORT` | API server port | `3000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `ENABLE_ENGINE` | Enable heartbeat engine | `false` |
| `API_KEY_SALT` | Salt for API key hashing | **Required** |
| `ENCRYPTION_KEY` | Key for data encryption (32+ chars) | **Required** |
| `RATE_LIMIT_MAX` | Max requests per 15 min window | `100` (prod) / `1000` (dev) |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |

### Security

This system has been hardened in the W9 security phase:

- **XSS Prevention**: All inputs are HTML-entity escaped
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **Rate Limiting**: 100 requests / 15 min (10 for auth endpoints)
- **Security Headers**: Helmet.js with CSP, X-Content-Type-Options, etc.
- **CORS**: Whitelist-based origin control
- **Dependencies**: Zero known vulnerabilities (verified by `pnpm audit`)

### License

MIT

---

## パッケージ構成 / Package Structure

```
packages/
├── shared/     # 共通型・ユーティリティ / Shared types & utils
├── db/         # DB スキーマ・マイグレーション / Schema & migrations
├── api/        # REST API サーバー / REST API server (port 3000)
├── cli/        # CLI ツール / CLI tool
├── ui/         # Web UI (React) / Web UI (port 5173)
├── adapters/   # AIアダプター / AI adapters
└── i18n/       # 多言語対応 / i18n (ja/en)
```
