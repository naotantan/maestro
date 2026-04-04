# maestro

[![CI](https://github.com/naotantan/maestro/actions/workflows/ci.yml/badge.svg)](https://github.com/naotantan/maestro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **AIエージェントを「試すだけ」から「業務で使える」に変えるバックエンド基盤**
>
> *The backend infrastructure that turns AI agent experiments into reliable business operations.*

---

## 日本語

### 一言で言うと

**AIエージェントを安全に・コストをコントロールしながら・既存ツールと連携して動かすための、すぐに使えるバックエンドシステムです。**

技術担当者はAPIを叩くだけで導入でき、経営・管理層は「AIが今何をしているか・いくら使っているか」をリアルタイムで把握できます。

---

### 導入前・後の比較

| 導入前の状況 | maestro 導入後 |
|---|---|
| AIが何をしているか分からない | 全操作をログで追跡できる |
| API費用が月末まで分からない | 予算上限を超えたら自動停止 |
| Slackへの通知に毎回コードを書く | Webhookを設定するだけで自動連携 |
| 重要な処理もAIが勝手に実行する | 人間の承認を必須にするフローを設定可能 |
| AIが落ちたら誰かが手動で再起動する | クラッシュを検知して自動再起動 |
| 進捗報告のたびにデータを手作業で集計する | タスク完了率から達成率を自動計算 |

---

### できること（ビジネス価値）

#### 1. AIエージェントの安全な運用管理

複数のAIエージェント（Claude・GPT・Gemini など）をひとつのシステムで登録・監視します。

- **自動再起動**: エージェントがクラッシュしても即時復旧。夜間・休日も無人で稼働継続
- **予算上限による自動停止**: APIコストが設定値を超えると自動でエージェントを停止。コスト超過ゼロ
- **Heartbeat監視**: 30秒ごとに稼働状態を確認し、異常を即時検知

> **導入効果の目安**: 夜間・休日の手動監視を廃止できます。エージェントの異常停止に気づかないまま翌朝を迎えるリスクがなくなります。

#### 2. タスク・承認フローの自動化

タスク（Issue）を登録すると、空いているエージェントへ**自動でアサイン**されます。

- **自動担当割り当て**: 担当者を手動で決める手間がゼロになります
- **人間による承認ゲート**: AIが実行する前に担当者の承認を必須にするフローを設定可能。「任せつつも重要な判断は人間が確認する」体制を作れます
- **目標との紐付け**: 各タスクを上位目標に連携することで、優先度の判断が明確になります

> **導入効果の目安**: タスク振り分けや担当確認のやりとりがなくなり、チームのコミュニケーションコストを削減できます。

#### 3. 目標達成率のリアルタイム可視化

「Issue解決率90%以上」「月間コスト〇万円以内」といったKPIを登録しておくと、タスクの完了状況から**達成率が自動で更新**されます。

- 週次・月次の進捗集計が自動化され、報告資料の作成時間を大幅に短縮できます
- 経営層・クライアントへの進捗共有がAPIレスポンスで即座に取得可能になります

> **導入効果の目安**: 毎週の進捗集計・報告資料作成にかかる時間を、手作業ゼロに近づけられます。

#### 4. 外部サービスとのノーコード連携

Slack・Notion・GitHub・Zapier など、Webhookに対応する任意のサービスと連携できます。

- 「エージェントがタスクを完了 → Slackで通知」
- 「予算アラート → 担当者にメール」
- 「Issue作成 → GitHubにチケット起票」

接続設定はAPIを叩くだけ。カスタム開発・専任エンジニアは不要です。

> **導入効果の目安**: 社内で使っているSlack・Notion・GitHubなどの既存ツールをそのまま活かしながら、AIワークフローを追加できます。

#### 5. 全操作の監査ログ自動記録

誰が・いつ・何をしたかを全操作について自動で記録します。

- AIエージェントの操作履歴も完全にトレース可能
- 障害発生時の原因調査が迅速になります
- セキュリティ監査・内部統制・コンプライアンス対応の証跡として活用できます

> **導入効果の目安**: 「AIがいつ何を変更したか」を後から調査できるため、AI導入後の説明責任とガバナンスを担保できます。

#### 6. Web設定画面からの一元管理

すべての設定を **ブラウザの設定画面から変更できます**。コマンドラインや設定ファイルの編集は不要です。

| 設定カテゴリ | 設定できる内容 |
|---|---|
| **エージェント実行モード** | Claudeサブスクリプション / Anthropic APIキーの切り替え |
| **組織情報** | 組織名・説明の編集 |
| **バックアップ** | スケジュール・保存先・保持期間・通知先の設定 |
| **言語** | 日本語 / English の切り替え |

> **導入効果の目安**: 設定変更のたびにサーバーに接続したりファイルを編集する手間がなくなります。管理者以外のメンバーでも設定変更が安全に行えます。

---

#### 7. データベースの自動バックアップ

スケジュール・保存先・保持期間をWeb画面から設定するだけで、データベースのバックアップが自動で実行されます。

**バックアップ先の選択肢:**

| 保存先 | 説明 |
|---|---|
| **ローカルパス** | サーバー上の任意のディレクトリ（NAS・外部ストレージも可） |
| **Amazon S3** | バケット名・リージョンを指定してクラウド保存 |
| **Google Cloud Storage** | GCSバケットに直接保存 |

**主な設定項目:**
- スケジュール: 毎日 / 毎週 / 毎月、実行時刻（HH:mm）
- 保持期間: 7日 / 14日 / 30日 / 60日 / 90日 / 180日 / 365日
- 圧縮: gzip（ストレージ節約）
- 暗号化: AES-256
- 通知: バックアップ成功・失敗時にメール通知

> **導入効果の目安**: 手動バックアップ作業をゼロにできます。障害発生時もスケジュールに従って取得されたバックアップからすぐに復旧できます。

#### 8. AIエージェントの実行モード選択

AIエージェントをどの課金方式・ツールで動かすかを**Web設定画面から選択できます**。追加コードは不要です。

| モード | エージェント種別 | 説明 | 向いている用途 |
|--------|----------------|------|----------------|
| **Claudeサブスクリプション**（デフォルト） | `claude_local` | Claude Proなどのサブスクプランで動作。従量課金なし | 個人・小チームでAPIコストをかけずに使いたい場合 |
| **Anthropic APIキー** | `claude_api` | 入力したAPIキーで直接呼び出し。従量課金 | エンタープライズ利用・大量処理が必要な場合 |
| **OpenAI Codex CLI** | `codex_local` | ChatGPT Pro/Plusサブスクで動作。`npm install -g @openai/codex` が必要 | OpenAIのモデルを活用したい場合 |
| **Google Gemini API** | `gemini_local` | Google Gemini APIキーで動作。**APIキー必須・従量課金** | Google AIを利用したい場合（APIキー保有者のみ） |

設定変更は Web管理画面の **エージェント登録画面** から選択するだけで完了します。

> **導入効果の目安**: 「まずClaudeサブスクで試して、本格導入時にAPIキーやCodexへ移行」という段階的な運用が設定変更だけで実現できます。

---

### こんな企業・チームに向いています

- AIエージェントを業務自動化に使い始めたが、コストや動作の管理が課題になっている
- 複数のAIを並列で動かしたいが、監視・管理の仕組みがない
- Slack・Notionなど既存ツールと連携したいが、毎回開発コストがかかっている
- AI操作の履歴・承認フローが必要で、コンプライアンス・監査に対応したい

---

### 導入事例イメージ

| シナリオ | 使い方 |
|---------|--------|
| **社内ヘルプデスク自動化** | 問い合わせをIssueとして登録 → AIが回答案を作成 → 担当者が承認して送信 |
| **定期レポート自動生成** | 毎週月曜にルーティンを設定 → AIがデータを収集・整形 → Slackに自動投稿 |
| **AI利用コスト管理** | プロジェクトごとにAPIコストを記録・追跡。予算超過をシステムで防止 |
| **マルチエージェント協調** | 調査・執筆・レビューの各エージェントを連携させてコンテンツ制作を自動化 |

---

### よくある懸念と回答

**Q: DevOps担当がいなくても動かせますか？**
Docker が使えれば `docker compose up -d` の1コマンドでデータベースが起動します。APIサーバーも `pnpm dev` の1コマンドで立ち上がります。専任のインフラ担当は不要です。

**Q: 既存のシステムに影響しますか？**
独立したバックエンドとして動作するため、既存システムへの影響はありません。REST APIで接続する形なので、既存の社内システムやツールとの共存が可能です。

**Q: セキュリティは大丈夫ですか？**
XSS・SQLインジェクション・レート制限・暗号化など、企業利用に必要なセキュリティ対策を標準実装しています。依存パッケージの既知の脆弱性はゼロを確認済みです（詳細は下記セキュリティ欄を参照）。

---

### システム要件・技術仕様

| 項目 | 仕様 |
|------|------|
| **APIプロトコル** | REST API（JSON）|
| **認証方式** | APIキー認証（Bearer トークン）|
| **データベース** | PostgreSQL 17 |
| **サーバー** | Node.js 20+ / Express.js |
| **フロントエンド** | React + Vite（Web管理画面付属）|
| **多言語** | 日本語・英語（react-i18next）|
| **デプロイ** | Docker / Docker Compose 対応 |
| **ライセンス** | MIT |

---

### セキュリティ対策

| 対策 | 内容 |
|------|------|
| XSS対策 | 全入力値のHTMLエンティティエスケープ |
| SQLインジェクション対策 | パラメータ化クエリによる全エンドポイント保護 |
| レート制限 | 15分あたり100リクエスト（認証エンドポイントは10回） |
| セキュリティヘッダー | CSP・X-Content-Type-Options・X-Frame-Options 等 |
| CORS制御 | 許可オリジンのホワイトリスト管理 |
| データ暗号化 | AES-256-GCM による機密データの暗号化保存 |
| 依存関係 | 既知の脆弱性ゼロを確認済み |

---

### セットアップ

#### 必要なもの

- **Node.js 20以上** — [nvm](https://github.com/nvm-sh/nvm)（推奨）または [公式サイト](https://nodejs.org/)
- **pnpm** — パッケージマネージャー
- **Docker**（推奨）または **PostgreSQL 14以上**（直インストール）

#### インストール（Docker 推奨）

以下をまとめてコピー＆実行するだけでサーバーが起動します。

```bash
# Node.js 20 と pnpm のセットアップ（未インストールの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc  # または source ~/.zshrc
nvm install 20 && nvm use 20
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc  # または source ~/.zshrc

# maestro のセットアップ
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install                          # .env と packages/api/.env を自動生成
# API_KEY_SALT と ENCRYPTION_KEY を任意の文字列に変更（セキュリティ上必須）
nano .env

# データベース起動 → マイグレーション → APIサーバー起動
docker compose up -d
pnpm db:migrate
pnpm --filter @maestro/api dev
```

**起動確認**: `curl http://localhost:3000/health` → `{"status":"ok"}` が返れば成功です。

#### インストール（Docker を使わない場合）

PostgreSQL がすでにインストール済みの環境向けです。

```bash
# Node.js 20 と pnpm のセットアップ（未インストールの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc  # または source ~/.zshrc
nvm install 20 && nvm use 20
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc  # または source ~/.zshrc

# maestro のセットアップ
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install                          # .env と packages/api/.env を自動生成

# PostgreSQL にデータベースとユーザーを作成
sudo -u postgres psql -c "CREATE USER maestro WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE maestro_dev OWNER maestro;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE maestro_dev TO maestro;"

# .env の DATABASE_URL・API_KEY_SALT・ENCRYPTION_KEY を編集
nano .env

# マイグレーション → APIサーバー起動
pnpm db:migrate
pnpm --filter @maestro/api dev
```

> **補足**: `.env` の `DATABASE_URL` は `localhost` ではなく `127.0.0.1` を使ってください。環境によっては `localhost` が IPv6（`::1`）に解決され接続できない場合があります。

#### 最初の登録・APIキー取得

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "株式会社Example", "email": "admin@example.com", "password": "yourpassword"}'
```

レスポンスの `apiKey`（`comp_live_...` で始まる文字列）を保存してください。以降の全リクエストで使用します。

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
| GET/POST | `/api/costs/budget` | 予算ポリシー一覧・作成 |
| GET/POST | `/api/plugins` | プラグイン管理 |
| GET/POST | `/api/plugins/:id/webhooks` | Webhook設定 |
| GET | `/api/activity` | 全操作ログ取得 |
| GET/PATCH | `/api/settings` | 組織設定（エージェント実行モード・APIキー） |
| GET/PATCH | `/api/org` | 組織情報の取得・更新 |
| POST/GET | `/api/tasks` | エージェントにタスクを直接実行・履歴取得 |
| POST/GET | `/api/handoffs` | エージェント間引き継ぎ登録・一覧 |
| GET | `/api/handoffs/:id` | 引き継ぎ詳細 |
| PATCH | `/api/handoffs/:id/cancel` | 引き継ぎキャンセル（pending のみ） |

#### `POST /api/costs/budget` の入力ルール

- `limit_amount_usd`: 必須。`0` より大きい数値
- `period`: 任意。未指定時は `monthly`
- `alert_threshold`: 任意。`0.00` から `1.00` の比率、または `0` から `100` の百分率で指定可能
- API は `alert_threshold: 80` を受け取った場合、保存時には `0.80` として正規化します

#### エージェント登録時の `type` フィールド

| type | 説明 | 必要なもの |
|------|------|------------|
| `claude_local` | Claudeサブスクリプションで動作（**デフォルト推奨**） | Claude Pro/Teamプラン |
| `claude_api` | Anthropic APIキーで動作 | `config.apiKey`（必須） |
| `gemini_local` | Google Gemini（**APIキー必須・有料**） | Google Gemini APIキーが必須。従量課金のため、APIキー保有者のみ利用可能 |
| `codex_local` | OpenAI Codex CLI（サブスク方式） | ChatGPT Pro/Plus プラン・`npm install -g @openai/codex` |

---

### タスク直接実行・エージェント間引き継ぎ

#### タスク直接実行

エージェントにプロンプトを投げ、結果を同期で受け取ります:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "<uuid>", "prompt": "プロジェクトの現状を要約してください"}'
```

#### エージェント間引き継ぎ（Handoff）

Agent A の結果を context として Agent B に自動で渡します。エンジンが 30 秒ごとに `pending` を実行します:

```bash
curl -X POST http://localhost:3000/api/handoffs \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent_id": "<agent-a-uuid>",
    "to_agent_id": "<agent-b-uuid>",
    "prompt": "前の回答を踏まえて日本語で要約してください"
  }'
```

#### 多段チェーン（A → B → C）

`next_agent_id` を指定すると、完了後に自動で次の引き継ぎが生成されます:

```bash
curl -X POST http://localhost:3000/api/handoffs \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent_id": "<agent-a-uuid>",
    "to_agent_id": "<agent-b-uuid>",
    "prompt": "Step 1: テーマを調査してください",
    "next_agent_id": "<agent-c-uuid>",
    "next_prompt": "Step 2: 調査結果をレポートにまとめてください"
  }'
```

`GET /api/handoffs?chain_id=<chain_id>` で連鎖全体を追跡できます。

#### API仕様書

完全な OpenAPI 3.0 仕様書: [`docs/openapi.yaml`](docs/openapi.yaml)

---

### 環境変数一覧

| 変数名 | 説明 | デフォルト |
|--------|------|---------|
| `DATABASE_URL` | PostgreSQL接続URL | `postgresql://maestro:changeme@localhost:5432/maestro_dev` |
| `PORT` | APIサーバーポート | `3000` |
| `NODE_ENV` | 環境（development/production） | `development` |
| `ENABLE_ENGINE` | Heartbeatエンジン有効化 | `false` |
| `API_KEY_SALT` | APIキーのハッシュソルト | **必須** |
| `ENCRYPTION_KEY` | 暗号化キー（32文字以上） | **必須** |
| `RATE_LIMIT_MAX` | 15分あたり最大リクエスト数 | `100`（本番）/ `1000`（開発） |
| `CORS_ORIGIN` | 許可するCORSオリジン（カンマ区切り） | `http://localhost:5173` |

---

### お問い合わせ・導入相談

技術的なご質問・導入検討のご相談は [GitHub Issues](https://github.com/naotantan/maestro/issues) からお気軽にどうぞ。

> **まずは5分で試せます**: `docker compose up -d && pnpm dev` でローカル環境が立ち上がります。
> アカウント登録・申し込みは不要です。

---

## English

### In One Line

**maestro is a ready-to-deploy backend that lets you run AI agents safely, with budget controls and seamless integration into your existing tools.**

Non-technical stakeholders see real-time visibility into what AI is doing and how much it costs. Technical teams get a clean REST API and a working system in under a day.

---

### Before and After

| Before | After maestro |
|--------|-------------------|
| No idea what AI agents are doing | Full activity log with timestamps |
| API costs discovered at month-end | Auto-stop when budget limit is hit |
| New Slack integration requires dev work | Webhook configured via API — no code needed |
| AI executes critical tasks without review | Approval gates enforced before execution |
| Someone manually restarts crashed agents | Automatic crash detection and recovery |
| Progress reports assembled manually | Goal completion rates calculated automatically |

---

### Business Value

#### 1. Reliable AI Agent Operations

Manage multiple AI agents (Claude, GPT, Gemini, etc.) from a single system.

- **Auto-restart on crash**: Agents recover immediately — no manual intervention, no missed downtime
- **Budget-based auto-stop**: Set a spending ceiling; agents halt automatically when it's reached
- **Heartbeat monitoring**: Status checked every 30 seconds; anomalies surfaced instantly

> **Expected impact**: Eliminate overnight monitoring shifts. Eliminate surprise AI-related invoices. Eliminate "the agent was down all weekend and nobody noticed."

#### 2. Task Automation with Controlled Human Oversight

Create a task and it is automatically assigned to an available agent.

- **Auto-assignment**: No manual delegation — the system routes work to the right agent
- **Approval gates**: Require human sign-off before an agent acts on sensitive tasks
- **Goal linkage**: Every task is connected to a business objective, making prioritization straightforward

> **Expected impact**: Remove the coordination overhead of manually assigning work to AI. Keep humans in control of decisions that matter.

#### 3. Real-Time Goal Progress Tracking

Define KPIs — "resolve 90% of issues this week," "stay under $500 in AI spend" — and progress updates automatically as tasks are completed.

- Weekly and monthly progress reports can be pulled instantly from the API
- No more manually aggregating spreadsheets before a status meeting

> **Expected impact**: Convert progress reporting from a weekly manual exercise into a real-time API call.

#### 4. No-Code Integration with Existing Tools

Connect to Slack, Notion, GitHub, Zapier, or any Webhook-capable service.

- Agent completes a task → Slack notification sent automatically
- Budget threshold reached → email the responsible manager
- Issue created → GitHub ticket opened in the right repo

Configuration is API-only. No custom code. No new infrastructure.

> **Expected impact**: AI workflows plug into the tools your team already uses. No need to ask engineering to build a new integration every time.

#### 5. Immutable Audit Trail

Every operation — human or AI — is logged automatically with a full timestamp.

- Trace exactly what each agent changed and when
- Supports internal audits, incident investigation, and compliance reporting

> **Expected impact**: Establish accountability and governance over AI operations without additional tooling. Required by many enterprise security and compliance frameworks.

#### 6. All Settings Configurable from the Web Dashboard

Every setting is manageable from the browser. No CLI, no config files.

| Category | What you can configure |
|---|---|
| **Agent execution mode** | Switch between Claude subscription and Anthropic API key |
| **Organization info** | Edit organization name and description |
| **Backup** | Schedule, storage destination, retention period, notification email |
| **Language** | Japanese / English |

> **Expected impact**: Admins can change any setting without touching the server. Non-technical team members can manage settings safely without CLI access.

---

#### 7. Automated Database Backups

Configure schedule, storage destination, and retention period from the Web dashboard. Backups run automatically without any manual intervention.

**Storage destinations:**

| Destination | Description |
|---|---|
| **Local path** | Any directory on the server (NAS and external storage supported) |
| **Amazon S3** | Cloud storage via bucket name and region |
| **Google Cloud Storage** | Direct upload to a GCS bucket |

**Key settings:**
- Schedule: Daily / Weekly / Monthly, at a configurable time (HH:mm)
- Retention: 7 / 14 / 30 / 60 / 90 / 180 / 365 days
- Compression: gzip (reduces storage usage)
- Encryption: AES-256
- Notifications: Email alerts on backup success or failure

> **Expected impact**: Eliminate manual backup tasks entirely. In the event of a failure, restore from the most recent scheduled backup immediately.

#### 8. AI Agent Execution Mode — Your Choice

Choose which AI tool and billing model to use — directly from the **agent registration page**. No code changes required.

| Mode | Agent Type | Description | Best for |
|------|-----------|-------------|----------|
| **Claude Subscription** (default) | `claude_local` | Runs on your Claude Pro/Team plan — no per-request cost | Individuals and small teams who want to avoid usage-based billing |
| **Anthropic API Key** | `claude_api` | Calls the Anthropic API directly with your key — pay-as-you-go | Enterprise workloads and high-volume processing |
| **OpenAI Codex CLI** | `codex_local` | Runs via ChatGPT Pro/Plus subscription — requires `npm install -g @openai/codex` | Teams wanting to leverage OpenAI models |
| **Google Gemini API** | `gemini_local` | Calls Google Gemini API with your key — **API key required, pay-as-you-go** | Google AI users (requires a valid Gemini API key) |

Select the agent type when registering an agent in the Web dashboard.

> **Expected impact**: Start with your existing Claude subscription, add Codex for OpenAI coverage, then scale to API keys for production — all without code changes.

---

### Who This Is For

- Teams using AI agents for automation but struggling to manage costs, visibility, or reliability
- Organizations that want to run multiple AI agents in parallel with a single management layer
- Businesses that need human approval workflows and audit logs before deploying AI in production
- Engineering teams that want a working AI operations backend without building one from scratch

---

### Use Cases

| Scenario | How it works |
|----------|-------------|
| **Internal helpdesk automation** | Log support queries as Issues → AI drafts responses → human approves and sends |
| **Automated weekly reports** | Schedule a Routine every Monday → agent collects data → posts summary to Slack |
| **AI cost governance** | Record API spend per project → auto-generate monthly cost reports → auto-stop on overage |
| **Multi-agent content pipeline** | Chain research, writing, and review agents to automate content production end-to-end |

---

### Common Concerns

**Q: Do we need a dedicated DevOps engineer?**
No. Docker brings up the database with one command (`docker compose up -d`). The API server starts with one command (`pnpm dev`). If you can run a terminal, you can run this.

**Q: Will it interfere with our existing systems?**
No. maestro is a standalone backend. It connects to your existing tools via REST API and Webhooks without touching or replacing anything you already have.

**Q: How is security handled?**
Enterprise-grade security is built in by default — XSS prevention, SQL injection protection, rate limiting, AES-256-GCM encryption, and security headers. All dependencies have been audited for known vulnerabilities (see Security section below).

---

### Technical Specifications

| Item | Spec |
|------|------|
| **API Protocol** | REST API (JSON) |
| **Authentication** | API key (Bearer token) |
| **Database** | PostgreSQL 17 |
| **Server** | Node.js 20+ / Express.js |
| **Frontend** | React + Vite (Web dashboard included) |
| **Internationalization** | Japanese / English (react-i18next) |
| **Deployment** | Docker / Docker Compose ready |
| **License** | MIT |

---

### Security

| Measure | Implementation |
|---------|---------------|
| XSS Prevention | HTML entity escaping on all user inputs |
| SQL Injection Prevention | Parameterized queries across all endpoints |
| Rate Limiting | 100 requests / 15 min global; 10 requests / 15 min on auth endpoints |
| Security Headers | CSP, X-Content-Type-Options, X-Frame-Options, and more |
| CORS Control | Whitelist-based allowed origins |
| Data Encryption | AES-256-GCM for sensitive data at rest |
| Dependency Audit | Zero known vulnerabilities confirmed |

---

### Getting Started

#### Prerequisites

- **Node.js 20+** — [nvm](https://github.com/nvm-sh/nvm) (recommended) or [official installer](https://nodejs.org/)
- **pnpm** — package manager
- **Docker** (recommended) or **PostgreSQL 14+** (direct install)

#### Installation (Docker — recommended)

Copy and run the entire block below. The server will be ready when it completes.

```bash
# Set up Node.js 20 and pnpm (skip if already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc   # or source ~/.zshrc on macOS
nvm install 20 && nvm use 20
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc   # or source ~/.zshrc on macOS

# Set up maestro
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install                           # auto-generates .env and packages/api/.env
# Set API_KEY_SALT and ENCRYPTION_KEY to any strings you choose (required for security)
nano .env

# Start the database, run migrations, and start the API server
docker compose up -d
pnpm db:migrate
pnpm --filter @maestro/api dev
```

**Verify**: `curl http://localhost:3000/health` should return `{"status":"ok"}`.

#### Installation (without Docker)

For environments where PostgreSQL is already installed.

```bash
# Set up Node.js 20 and pnpm (skip if already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc   # or source ~/.zshrc on macOS
nvm install 20 && nvm use 20
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc   # or source ~/.zshrc on macOS

# Set up maestro
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install                           # auto-generates .env and packages/api/.env

# Create the database and user in PostgreSQL
sudo -u postgres psql -c "CREATE USER maestro WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE maestro_dev OWNER maestro;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE maestro_dev TO maestro;"

# Edit DATABASE_URL, API_KEY_SALT, and ENCRYPTION_KEY in .env
nano .env

# Run migrations and start the API server
pnpm db:migrate
pnpm --filter @maestro/api dev
```

> **Note**: Use `127.0.0.1` instead of `localhost` in `DATABASE_URL`. On some systems `localhost` resolves to IPv6 (`::1`) and the connection will fail.

#### Register Your Organization

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com", "password": "yourpassword"}'
```

Save the `apiKey` from the response (prefix: `comp_live_`). All subsequent API calls require this key.

---

### API Reference

All authenticated requests require: `Authorization: Bearer <api_key>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| POST | `/api/auth/register` | Register organization and user |
| POST | `/api/auth/login` | Login and retrieve API key |
| GET/POST | `/api/agents` | List / register agents |
| GET/POST | `/api/issues` | List / create tasks (auto-assigned to agents) |
| POST | `/api/issues/:id/goals` | Link a task to a goal |
| GET/POST | `/api/goals` | List / create goals |
| POST | `/api/goals/:id/recalculate` | Recalculate goal progress from tasks |
| GET/POST | `/api/projects` | List / manage projects |
| GET/POST | `/api/costs` | List / record costs |
| GET/POST | `/api/costs/budget` | List / create budget policies |
| GET/POST | `/api/plugins` | List / create plugins |
| GET/POST | `/api/plugins/:id/webhooks` | Configure webhooks |
| GET | `/api/activity` | Retrieve full activity log |
| GET/PATCH | `/api/settings` | Organization settings (agent mode, API key) |
| GET/PATCH | `/api/org` | Organization info (name, description) |
| POST/GET | `/api/tasks` | Execute a task directly on an agent / list history |
| POST/GET | `/api/handoffs` | Register / list agent-to-agent handoffs |
| GET | `/api/handoffs/:id` | Handoff detail |
| PATCH | `/api/handoffs/:id/cancel` | Cancel a pending handoff |

#### `POST /api/costs/budget` Input Rules

- `limit_amount_usd`: Required. Must be a number greater than `0`
- `period`: Optional. Defaults to `monthly`
- `alert_threshold`: Optional. Accepts either a ratio from `0.00` to `1.00` or a percentage from `0` to `100`
- When the API receives `alert_threshold: 80`, it normalizes and stores the value as `0.80`

#### Agent `type` Values

| type | Description | Requires |
|------|-------------|----------|
| `claude_local` | Runs on Claude subscription via CLI (**recommended default**) | Claude Pro/Team plan |
| `claude_api` | Calls Anthropic API directly | `config.apiKey` (required) |
| `gemini_local` | Google Gemini (**API key required — paid**) | Google Gemini API key required. Pay-as-you-go billing. Only available to users with an API key. |
| `codex_local` | OpenAI Codex CLI (subscription) | ChatGPT Pro/Plus plan — `npm install -g @openai/codex` |

---

### Agent Tasks & Handoffs

#### Direct Task Execution

Send a prompt directly to an agent and receive the result synchronously:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "<uuid>", "prompt": "Summarize the project status"}'
```

Response includes `output`, `finish_reason`, `started_at`, and `completed_at`.

#### Agent-to-Agent Handoff

Hand off a task from one agent to another. The result of the first agent becomes the `context` for the second:

```bash
curl -X POST http://localhost:3000/api/handoffs \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent_id": "<agent-a-uuid>",
    "to_agent_id": "<agent-b-uuid>",
    "prompt": "Write a one-sentence summary of the previous output"
  }'
```

The handoff engine runs every 30 seconds and processes `pending` handoffs automatically.

#### Handoff Chains (A → B → C)

Chain multiple agents by specifying `next_agent_id`. Each agent's output becomes the next agent's context:

```bash
curl -X POST http://localhost:3000/api/handoffs \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent_id": "<agent-a-uuid>",
    "to_agent_id": "<agent-b-uuid>",
    "prompt": "Step 1: research the topic",
    "next_agent_id": "<agent-c-uuid>",
    "next_prompt": "Step 2: write a report based on the research"
  }'
```

Track the entire chain with `GET /api/handoffs?chain_id=<chain_id>`.

---

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://maestro:changeme@localhost:5432/maestro_dev` |
| `PORT` | API server port | `3000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `ENABLE_ENGINE` | Enable heartbeat engine | `false` |
| `API_KEY_SALT` | Salt for API key hashing | **Required** |
| `ENCRYPTION_KEY` | Encryption key (32+ characters) | **Required** |
| `RATE_LIMIT_MAX` | Max requests per 15 min window | `100` (prod) / `1000` (dev) |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |

---

### Project Structure

```
maestro/
├── packages/
│   ├── shared/     # Shared types and utilities
│   ├── db/         # Database schema and migrations
│   ├── api/        # REST API server
│   ├── cli/        # Command-line interface
│   ├── ui/         # React web dashboard
│   ├── adapters/   # AI adapter integrations (Claude, GPT, Gemini, etc.)
│   └── i18n/       # Localization (Japanese / English)
├── .github/
│   └── workflows/
│       └── ci.yml  # CI pipeline (typecheck + test)
├── docker-compose.yml
├── .env.example
├── LICENSE
├── CHANGELOG.md
└── CONTRIBUTING.md
```

---

### Contact & Enterprise Inquiries

For enterprise inquiries, integration questions, or technical support, open an issue on [GitHub](https://github.com/naotantan/maestro/issues).

> **Try it in 5 minutes**: `docker compose up -d && pnpm dev` starts a fully working local environment.
> No account, sign-up, or credit card required.
