# .company CLI 詳細設計書 Part2 — CLI詳細仕様 + アダプター実装仕様（W3）

**作成日**: 2026-04-03
**担当**: 開発部 第1課（Omar Hassan）× 第2課（Yena Park）
**版**: v2.0
**ステータス**: 詳細設計確定版

---

## 1. CLIコマンド詳細仕様

### 1.1 company login

#### 概要
既存アカウントでログインし、APIキーをローカル設定に保存する。

#### 基本構文
```bash
company login [--email <email>] [--quiet]
```

#### LoginResponse 型定義
```typescript
interface LoginResponse {
  apiKey: string;        // ログイン時に自動発行されるAPIキー
  companyId: string;
  companyName: string;
  userId: string;
  email: string;
  name: string;
  companies: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}
```

#### フロー
1. メールアドレス・パスワードをプロンプトで入力
2. POST /api/auth/login → `LoginResponse` を取得（認証と同時にAPIキーが発行される）
3. 全ケース（1社・複数社）共通で `loginResult.apiKey` を使って saveConfig を実行
4. 複数社の場合は警告メッセージを表示（先頭企業でAPIキーが発行されている旨）

#### 注意事項
- APIへのリクエスト時に apiKey を渡さない（undefined = Authorizationヘッダーなし）
- 旧実装では1社ケースで saveConfig が呼ばれていなかった（バグ修正済み: PR#1）

---

### 1.2 company register

#### 概要
新規アカウントを作成し、APIキーをローカル設定に保存する。

#### 基本構文
```bash
company register [--email <email>] [--name <name>] [--company <company>] [--quiet]
```

#### RegisterResponse 型定義
```typescript
interface RegisterResponse {
  apiKey: string;
  userId: string;
  companyId: string;
  email: string;
  name: string;
  companyName: string;
}
```

#### フロー
1. email / password / name / company をプロンプトで入力
2. POST /api/auth/register → `RegisterResponse` を取得
3. `result.apiKey` を使って saveConfig を実行
4. 表示: `result.name`, `result.companyName`, `result.email`

#### 注意事項
- APIへのリクエスト時に apiKey を渡さない（undefined = Authorizationヘッダーなし）

---

### 1.3 company init

#### 概要
新規インストールおよび初期化。Docker方式・ネイティブ方式の両方をサポート。

#### 基本構文
```bash
company init [--docker | --native] [--db-url <url>] [--api-key <key>] [--quiet]
```

#### オプション

| オプション | 説明 | デフォルト | 備考 |
|----------|------|----------|------|
| `--docker` | Docker Compose 方式で起動 | — | 推奨。PostgreSQL自動起動 |
| `--native` | ネイティブ方式。PostgreSQL外部接続 | — | 既存DBサーバ利用時 |
| `--db-url` | PostgreSQL接続文字列 | — | `--native` 必須。例: `postgresql://user:pass@localhost:5432/company` |
| `--api-key` | APIキー（手動指定） | 自動生成 | テスト時のみ使用 |
| `--quiet` | 非対話モード（プロンプト表示なし） | — | CI/CD用 |

#### 実行フロー（Docker方式）

```
1. 前提確認
   ├─ Docker がインストール済みか確認
   ├─ ポート 5432 / 3000 / 3001 が使用可能か確認
   └─ Docker Desktop が起動しているか確認

2. 設定取得
   ├─ プロンプト: 言語選択（ja / en）
   ├─ プロンプト: 組織名入力
   └─ プロンプト: メールアドレス入力

3. Docker Compose生成
   ├─ docker-compose.yml を ~/.company-cli/ に生成
   ├─ PostgreSQL 17 イメージを pull（最初の1回のみ）
   └─ Compose volume（pgdata/）を作成

4. DB初期化
   ├─ `docker compose up -d postgres` で起動
   ├─ マイグレーション実行（Drizzle）
   ├─ 組織レコード作成（companies テーブル）
   ├─ ユーザーレコード作成（users テーブル）
   └─ APIキー自動生成・保存（bcryptハッシュ化）

5. APIサーバー起動
   ├─ `docker compose up -d api` でサーバー起動
   └─ ヘルスチェック（GET /health）で確認

6. config.json 生成
   ├─ インストール方式：docker
   ├─ API URL：http://localhost:3000
   ├─ 言語設定：ja / en
   └─ 保存先：~/.company-cli/config.json

7. 完了メッセージ
   ├─ APIキーをターミナルに表示（1回のみ）
   ├─ ログファイルパス表示
   └─ 次のコマンド案内：`company ui` / `company agent list`
```

#### 実行フロー（ネイティブ方式）

```
1. 接続確認
   ├─ --db-url で指定されたPostgreSQLに接続
   └─ 接続失敗 → エラー終了・トラブルシューティング表示

2. スキーマ初期化
   ├─ 既存テーブルがある場合 → 警告・確認プロンプト
   ├─ マイグレーション実行（Drizzle）
   └─ 組織・ユーザー・APIキー作成（Docker方式と同じ）

3. config.json 生成
   ├─ インストール方式：native
   ├─ DB接続文字列：指定されたURL
   ├─ API URL：http://localhost:3000（ネイティブAPI起動時）
   └─ 保存先：~/.company-cli/config.json

4. 完了メッセージ（ネイティブ特有）
   ├─ APIサーバーのスタート方法を案内
   ├─ 例：`company api start`
   └─ ポート 3000 での起動を案内
```

#### Docker Compose YAML 完全版

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:17-alpine
    container_name: company-postgres
    environment:
      POSTGRES_USER: company
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: company
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U company -d company"]
      interval: 5s
      timeout: 10s
      retries: 5
    networks:
      - company-network

  api:
    build:
      context: ./packages/api
      dockerfile: Dockerfile
    container_name: company-api
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://company:${POSTGRES_PASSWORD:-changeme}@postgres:5432/company
      NODE_ENV: production
      PORT: 3000
      API_KEY_SALT: ${API_KEY_SALT}
    ports:
      - "3000:3000"
    networks:
      - company-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  pgdata:

networks:
  company-network:
    driver: bridge
```

#### 出力メッセージ例

**成功時（Docker）:**
```
✅ .company CLI が初期化されました

📋 設定情報:
  インストール方式: Docker
  データベース: PostgreSQL 17 (localhost:5432)
  API URL: http://localhost:3000
  言語: 日本語

🔑 APIキー（初回のみ表示）:
   comp_live_xxxxxxxxxxxxxxxxxxxx

⚠️  このキーを安全に保管してください。後で表示できません。

📂 データ保存先:
   ~/.company-cli/
   ├── config.json
   ├── docker-compose.yml
   └── pgdata/ (PostgreSQL データ)

📖 次のステップ:
   1. company ui              # Web UI をブラウザで開く
   2. company org show        # 組織情報を確認
   3. company agent list      # エージェント一覧を表示

💡 ヘルプを見るには: company --help
```

**失敗時:**
```
❌ Docker Desktop が起動していません。

対応:
  1. Docker Desktop を起動してください
  2. 再度 company init を実行してください

詳しくは: company doctor

ログ: ~/.company-cli/logs/init-2026-04-03.log
```

---

### 1.4 company org <subcommand>

組織情報の表示・更新・メンバー管理。

#### サブコマンド一覧

##### 1.2.1 company org show

```bash
company org show [--json] [--quiet]
```

組織情報を表示。

**出力（テーブル形式）:**
```
┌────────────────────────────┬──────────────────────┐
│ 項目                       │ 値                   │
├────────────────────────────┼──────────────────────┤
│ 組織ID                     │ org_123456789...     │
│ 組織名                     │ Acme Corp            │
│ メールアドレス（admin）    │ admin@acme.com       │
│ メンバー数                 │ 5                    │
│ エージェント数             │ 3                    │
│ 作成日                     │ 2026-04-03 10:30:00  │
│ タイムゾーン               │ Asia/Tokyo           │
└────────────────────────────┴──────────────────────┘
```

**出力（JSON）:**
```json
{
  "id": "org_123456789",
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "memberCount": 5,
  "agentCount": 3,
  "createdAt": "2026-04-03T10:30:00Z",
  "timeZone": "Asia/Tokyo"
}
```

##### 1.2.2 company org update

```bash
company org update --name <新名> [--timezone <tz>] [--json]
```

組織情報を更新。

**オプション:**
| オプション | 説明 | 例 |
|----------|------|-----|
| `--name` | 新しい組織名 | `--name "新社名"` |
| `--timezone` | タイムゾーン | `--timezone "Asia/Tokyo"` |

**出力:**
```
✅ 組織情報を更新しました

変更内容:
  組織名: Acme Corp → New Acme Corp
  タイムゾーン: Asia/Tokyo (変更なし)
```

##### 1.2.3 company org members

```bash
company org members [--format <table|json>] [--role <role>] [--limit 100]
```

メンバー一覧を表示。

**出力（テーブル）:**
```
┌─────┬──────────────────────┬──────────────────────┬───────────┬──────────────────────┐
│ # │ メール               │ 名前                 │ ロール    │ 参加日               │
├─────┼──────────────────────┼──────────────────────┼───────────┼──────────────────────┤
│ 1 │ admin@acme.com       │ Admin User           │ admin     │ 2026-04-03 10:30:00  │
│ 2 │ user1@acme.com       │ User One             │ member    │ 2026-04-03 11:00:00  │
│ 3 │ user2@acme.com       │ User Two             │ viewer    │ 2026-04-03 11:30:00  │
└─────┴──────────────────────┴──────────────────────┴───────────┴──────────────────────┘
```

##### 1.2.4 company org invite

```bash
company org invite <email> [--role <role>] [--message <text>]
```

メンバーを招待。

**ロール種別:**
| ロール | 権限 |
|--------|------|
| `admin` | すべての操作・メンバー管理可 |
| `member` | エージェント・Issue・プロジェクト管理可 |
| `viewer` | 閲覧のみ |

**実行:**
```
$ company org invite user3@acme.com --role member

✅ 招待を送信しました

招待リンク: https://company.example.com/invite/invite_token_xxx
有効期限: 7日間

メールが送信されました: user3@acme.com
```

##### 1.2.5 company org remove

```bash
company org remove <user_id> [--force]
```

メンバーを削除。

```
$ company org remove user_123

⚠️  確認: user1@acme.com をメンバーから削除しますか？

削除されたメンバーが保有する以下のリソースはどうしますか？
  • Issue 5件
  • プロジェクト 2件
  • エージェント 0個

→ 1: リソースも削除する
→ 2: 別のメンバーに譲渡する

選択: 2

譲渡先メンバーを選択: admin@acme.com

✅ メンバー user1@acme.com と関連リソースを処理しました
```

---

### 1.5 company agents <subcommand>

エージェント管理。

#### 1.3.1 company agents list

```bash
company agents list [--status <status>] [--format <table|json>] [--watch]
```

エージェント一覧を表示。

**出力（テーブル）:**
```
┌─────┬──────────────┬──────────┬───────────┬──────────────┬────────────────────┐
│ # │ 名前         │ タイプ   │ ステータス │ ハートビート │ 最終実行           │
├─────┼──────────────┼──────────┼───────────┼──────────────┼────────────────────┤
│ 1 │ claude-1     │ claude   │ running   │ 正常         │ 2分前               │
│ 2 │ code-gen     │ cursor   │ running   │ 正常         │ 10分前              │
│ 3 │ data-analyze │ gemini   │ stopped   │ —            │ 3日前               │
└─────┴──────────────┴──────────┴───────────┴──────────────┴────────────────────┘

合計: 3 エージェント（実行中: 2、停止中: 1）
```

**ステータス:**
| ステータス | 説明 |
|-----------|------|
| `running` | 実行中（ハートビート正常） |
| `idle` | 待機中（最後の実行から > 1時間） |
| `stopped` | 停止中 |
| `error` | エラー状態（ハートビート失敗） |

#### 1.3.2 company agents create

```bash
company agents create <name> --type <type> [--config <json>] [--cli-path <path>]
```

新規エージェントを作成。

**タイプ（アダプター）:**
| タイプ | CLI対象 |
|--------|---------|
| `claude_local` | Claude Code |
| `codex_local` | OpenAI Codex |
| `cursor` | Cursor |
| `gemini_local` | Gemini |
| `openclaw_gateway` | OpenClaw Gateway |
| `opencode_local` | OpenCode |
| `pi_local` | Pi |

**実行:**
```bash
$ company agents create my-claude --type claude_local

✅ エージェント「my-claude」を作成しました

ID: agent_abc123def456
タイプ: claude_local
ステータス: created (未実行)

次のステップ:
  company agents start my-claude       # ハートビート開始
  company agents config my-claude      # 設定確認
  company agents test my-claude        # テスト実行
```

#### 1.3.3 company agents start

```bash
company agents start <agent_name> [--heartbeat-interval <sec>] [--timeout <sec>]
```

エージェント・ハートビートを開始。

**オプション:**
| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--heartbeat-interval` | ハートビート間隔（秒） | 300（5分） |
| `--timeout` | タイムアウト（秒） | 30 |

**実行:**
```bash
$ company agents start my-claude --heartbeat-interval 600

🚀 my-claude のハートビートを開始しました

ID: agent_abc123def456
タイプ: claude_local
ハートビート間隔: 600秒 (10分)
タイムアウト: 30秒

ステータス確認: company agents status my-claude
ログ表示: company agents logs my-claude
```

#### 1.3.4 company agents stop

```bash
company agents stop <agent_name> [--force]
```

エージェント・ハートビートを停止。

```bash
$ company agents stop my-claude

✅ my-claude のハートビートを停止しました

Issue との関連:
  • 割り当てられたIssue: 3件
    （これらのIssueはロック解除され、割り当て可能になります）
```

#### 1.3.5 company agents status

```bash
company agents status <agent_name> [--json]
```

エージェントの詳細ステータス表示。

**出力:**
```
┌─────────────────────────┬──────────────────────┐
│ 項目                    │ 値                   │
├─────────────────────────┼──────────────────────┤
│ 名前                    │ my-claude            │
│ ID                      │ agent_abc123def456   │
│ タイプ                  │ claude_local         │
│ ステータス              │ running              │
│ ハートビート間隔        │ 600秒 (10分)         │
│ 最終実行                │ 2026-04-03 15:30:00  │
│ 総実行回数              │ 245                  │
│ 成功率                  │ 98.4%                │
│ 平均実行時間            │ 12.3秒               │
│ 現在のIssue             │ COMP-123             │
│ トークン使用量（本月）  │ 1,234,567            │
└─────────────────────────┴──────────────────────┘
```

#### 1.3.6 company agents logs

```bash
company agents logs <agent_name> [--lines 50] [--follow] [--grep <pattern>]
```

エージェントのログを表示。

**オプション:**
| オプション | 説明 |
|----------|------|
| `--lines` | 表示行数（デフォルト: 50） |
| `--follow` | リアルタイム監視（Ctrl+C で終了） |
| `--grep` | ログをフィルタ（正規表現対応） |

**実行:**
```bash
$ company agents logs my-claude --lines 20

2026-04-03T15:30:05.123Z [my-claude] ℹ️  Heartbeat started
2026-04-03T15:30:06.456Z [my-claude] 📝 Task: Review PR #123
2026-04-03T15:30:18.789Z [my-claude] ✅ Task completed in 12.3s
2026-04-03T15:30:19.012Z [my-claude] 📊 Tokens: input=1200, output=450, total=1650
2026-04-03T15:30:19.345Z [my-claude] ℹ️  Next heartbeat: 10分後

$ company agents logs my-claude --follow   # リアルタイム監視

2026-04-03T15:40:05.123Z [my-claude] ℹ️  Heartbeat started
2026-04-03T15:40:06.456Z [my-claude] 📝 Task: Generate documentation
... (リアルタイム更新)
```

#### 1.3.7 company agents heartbeat

```bash
company agents heartbeat <agent_name> [--task <description>]
```

手動でハートビートを実行。

```bash
$ company agents heartbeat my-claude --task "Review code quality"

🔄 Heartbeat を実行中... (タイムアウト: 30秒)

2026-04-03T15:35:10.123Z [my-claude] ✅ Task completed
Output: Code review completed. 3 issues found.

📊 実行結果:
  ├─ 実行時間: 5.2秒
  ├─ 成功: ✅
  ├─ トークン: input=800, output=320, total=1120
  └─ 次回実行: 10分後（自動スケジュール時）
```

---

### 1.6 company issues <subcommand>

Issue・タスク管理。

#### 1.4.1 company issues list

```bash
company issues list [--status <status>] [--assignee <name>] [--label <label>] [--limit 100]
```

Issue一覧を表示。

**出力:**
```
┌──────────┬─────────────────────┬──────────────┬──────────┬─────────────────┐
│ ID       │ タイトル            │ 担当者       │ ステータス│ 優先度          │
├──────────┼─────────────────────┼──────────────┼──────────┼─────────────────┤
│ COMP-001 │ Dashboard design    │ designer     │ done     │ 🔴 High        │
│ COMP-002 │ API authentication  │ claude-1     │ progress │ 🔴 High        │
│ COMP-003 │ Database migration  │ unassigned   │ backlog  │ 🟡 Medium       │
│ COMP-004 │ Bug: Login timeout  │ code-gen     │ progress │ 🔴 High        │
└──────────┴─────────────────────┴──────────────┴──────────┴─────────────────┘

合計: 4 Issues | 完了: 1 | 進行中: 2 | バックログ: 1
```

**ステータス:**
| ステータス | 説明 |
|-----------|------|
| `backlog` | バックログ（未着手） |
| `progress` | 進行中 |
| `review` | レビュー待ち |
| `done` | 完了 |

#### 1.4.2 company issues create

```bash
company issues create --title <title> [--description <desc>] [--assignee <user>] [--label <label>] [--priority <level>]
```

新規Issue作成。Issue識別子は `COMP-XXX` で自動採番。

**実行:**
```bash
$ company issues create --title "Implement user auth" \
  --description "OAuth 2.0 authentication system" \
  --assignee claude-1 \
  --label "feature" \
  --priority high

✅ Issue を作成しました

ID: COMP-005
タイトル: Implement user auth
ステータス: backlog
担当者: claude-1 (agent_xxx)
ラベル: feature
優先度: 🔴 High

URL: http://localhost:3001/issues/COMP-005
```

#### 1.4.3 company issues show

```bash
company issues show <issue_id> [--json]
```

Issue詳細を表示。

**出力:**
```
┌──────────────────────────┬──────────────────────────────┐
│ ID                       │ COMP-002                     │
│ タイトル                 │ API authentication           │
│ 説明                     │ Implement OAuth 2.0 flow     │
│ 担当者                   │ claude-1 (agent_abc123)      │
│ ステータス               │ progress                     │
│ 優先度                   │ 🔴 High                      │
│ ラベル                   │ feature, api, security       │
│ 作成日                   │ 2026-04-03 10:30:00          │
│ 期限                     │ 2026-04-10                   │
│ コメント数               │ 5                            │
│ 進捗                     │ 60%                          │
└──────────────────────────┴──────────────────────────────┘

【最新コメント】
2026-04-03 14:20:00 claude-1:
  "OAuth provider integration を完了しました。ただし、ロゴン検証ロジック要確認"
```

#### 1.4.4 company issues update

```bash
company issues update <issue_id> --status <status> [--assignee <user>] [--label <label>]
```

Issue情報を更新。

```bash
$ company issues update COMP-002 --status done

✅ Issue COMP-002 を更新しました

変更:
  ステータス: progress → done
  完了日: 2026-04-03 15:45:00

他に割り当てられたIssueはありません。
```

#### 1.4.5 company issues assign

```bash
company issues assign <issue_id> <agent_name>
```

エージェントにIssueをアサイン。

```bash
$ company issues assign COMP-003 data-analyze

✅ Issue COMP-003 を data-analyze にアサインしました

担当: data-analyze (agent_def789)
ステータス自動更新: backlog → progress
次のハートビート時に タスク実行が開始されます
```

#### 1.4.6 company issues close

```bash
company issues close <issue_id> [--reason <text>]
```

Issueを完了・クローズ。

```bash
$ company issues close COMP-001 --reason "Design approved by stakeholder"

✅ Issue COMP-001 をクローズしました

ステータス: progress → done
クローズ日: 2026-04-03 15:50:00
理由: Design approved by stakeholder
```

---

### 1.7 company skills <subcommand>

カスタムスキルの登録・管理。

#### 1.5.1 company skills list

```bash
company skills list [--assigned-to <agent>] [--format table|json]
```

登録済みスキル一覧を表示。

**出力:**
```
┌──────────────┬──────────────────────┬─────────┬────────────────────┐
│ スキル名     │ 説明                 │ 割当先  │ 最終更新           │
├──────────────┼──────────────────────┼─────────┼────────────────────┤
│ code-review  │ コードレビュー評価   │ claude-1 │ 2026-04-02 10:30:00│
│ bug-finder   │ バグ検出スキル       │ none    │ 2026-03-30 14:00:00│
│ doc-gen      │ ドキュメント生成     │ code-gen │ 2026-04-01 09:15:00│
└──────────────┴──────────────────────┴─────────┴────────────────────┘

合計: 3 スキル | 割当済み: 2 | 未割当: 1
```

#### 1.5.2 company skills create

```bash
company skills create --name <name> --file <yaml_path> [--version <ver>]
```

新規スキルを登録。YAMLファイルで定義。

**スキルYAML形式:**
```yaml
name: code-review
version: 1.0.0
description: AI-powered code review assistant
prompt: |
  You are an expert code reviewer.
  Analyze the following code and provide:
  1. Bug detection
  2. Performance issues
  3. Code quality improvements
  4. Security concerns

  Code:
  {{CODE}}

config:
  model: claude
  temperature: 0.3
  max_tokens: 2000
```

**実行:**
```bash
$ company skills create --name my-skill --file skills/my-skill.yaml

✅ スキル「my-skill」を登録しました

ID: skill_ghi012
バージョン: 1.0.0
割当可能: ✅

割り当てるには: company skills assign my-skill <agent>
```

#### 1.5.3 company skills show

```bash
company skills show <skill_name> [--json]
```

スキル詳細を表示。

#### 1.5.4 company skills update

```bash
company skills update <skill_name> --file <yaml_path> [--version <ver>]
```

スキルを更新（新バージョン）。

#### 1.5.5 company skills delete

```bash
company skills delete <skill_name> [--force]
```

スキルを削除。

#### 1.5.6 company skills assign

```bash
company skills assign <skill_name> <agent_name>
```

エージェントにスキルを割り当て。

```bash
$ company skills assign code-review claude-1

✅ スキル「code-review」を claude-1 に割り当てました

claude-1 のスキル一覧:
  • code-review (v1.0.0)

スキルはハートビート時に自動利用されます。
```

---

### 1.8 company goals <subcommand>

ゴール・目標管理。

#### 1.6.1 company goals list

```bash
company goals list [--status <status>] [--limit 100]
```

ゴール一覧を表示。

**出力:**
```
┌────────────┬──────────────────────┬──────────┬────────┐
│ ID         │ ゴール               │ 進捗     │ 期限   │
├────────────┼──────────────────────┼──────────┼────────┤
│ GOAL-001   │ MVP完成              │ 75%      │ 2026-05-01 │
│ GOAL-002   │ ベータ版リリース      │ 40%      │ 2026-06-15 │
│ GOAL-003   │ パフォーマンス改善    │ 20%      │ 2026-07-01 │
└────────────┴──────────────────────┴──────────┴────────┘
```

#### 1.6.2 company goals create

```bash
company goals create --title <title> [--description <desc>] [--deadline <date>]
```

新規ゴール作成。

#### 1.6.3 company goals show

```bash
company goals show <goal_id> [--json]
```

ゴール詳細を表示。

#### 1.6.4 company goals update

```bash
company goals update <goal_id> --progress <percent> [--deadline <date>]
```

ゴール進捗を更新。

#### 1.6.5 company goals delete

```bash
company goals delete <goal_id> [--force]
```

ゴールを削除。

---

### 1.9 company routines <subcommand>

定期実行タスク・ルーティン管理。

#### 1.7.1 company routines list

```bash
company routines list [--format table|json]
```

ルーティン一覧。

**出力:**
```
┌────────────┬──────────────────────┬──────────────┬──────────────┐
│ ID         │ 名前                 │ スケジュール │ ステータス   │
├────────────┼──────────────────────┼──────────────┼──────────────┤
│ ROUTINE-001│ Daily standup        │ 0 9 * * *    │ enabled      │
│ ROUTINE-002│ Weekly report        │ 0 17 * * FRI │ enabled      │
│ ROUTINE-003│ Monthly backup       │ 0 0 1 * *    │ disabled     │
└────────────┴──────────────────────┴──────────────┴──────────────┘
```

#### 1.7.2 company routines create

```bash
company routines create --name <name> --cron <cron_expr> --agent <agent_name> --task <description>
```

新規ルーティン作成。

**Cron形式:**
```
分 時 日 月 曜日
0   9  *   *  * = 毎日 9:00
0  17  *   * FRI = 毎週金曜 17:00
0   0  1   * * = 毎月1日 0:00
```

**実行:**
```bash
$ company routines create \
  --name "Daily code review" \
  --cron "0 9 * * *" \
  --agent claude-1 \
  --task "Review pending pull requests and provide feedback"

✅ ルーティン「Daily code review」を作成しました

ID: ROUTINE-004
スケジュール: 毎日 9:00
割当先: claude-1
ステータス: enabled

ログ確認: company routines logs ROUTINE-004
```

#### 1.7.3 company routines show

```bash
company routines show <routine_id> [--json]
```

ルーティン詳細表示。

#### 1.7.4 company routines toggle

```bash
company routines toggle <routine_id> [--enable|--disable]
```

ルーティンを有効/無効化。

```bash
$ company routines toggle ROUTINE-003 --enable

✅ ルーティン「Monthly backup」を有効にしました

次回実行: 2026-05-01 00:00 (予定)
```

---

### 1.10 company approvals <subcommand>

承認フロー・ワークフロー管理。

#### 1.8.1 company approvals list

```bash
company approvals list [--status pending|approved|rejected] [--limit 100]
```

承認リスト表示。

**出力:**
```
┌────────────┬──────────────────────┬──────────────┬────────────┐
│ ID         │ 内容                 │ 申請者       │ ステータス │
├────────────┼──────────────────────┼──────────────┼────────────┤
│ APPR-001   │ Release v1.2.0       │ claude-1     │ pending    │
│ APPR-002   │ Database migration   │ code-gen     │ approved   │
│ APPR-003   │ API changes          │ data-analyze │ rejected   │
└────────────┴──────────────────────┴──────────────┴────────────┘
```

#### 1.8.2 company approvals show

```bash
company approvals show <approval_id> [--json]
```

承認詳細表示。

#### 1.8.3 company approvals approve

```bash
company approvals approve <approval_id> [--comment <text>]
```

承認リクエストを承認。

```bash
$ company approvals approve APPR-001 --comment "Looks good, ready for release"

✅ 承認リクエスト APPR-001 を承認しました

申請内容: Release v1.2.0
承認者: admin@acme.com
承認日時: 2026-04-03 16:00:00
コメント: Looks good, ready for release

申請者（claude-1）に通知が送信されました。
```

#### 1.8.4 company approvals reject

```bash
company approvals reject <approval_id> --reason <text>
```

承認リクエストを却下。

---

### 1.11 company costs <subcommand>

コスト・トークン使用量追跡。

#### 1.9.1 company costs summary

```bash
company costs summary [--period <month|quarter|year>] [--json]
```

コスト集計サマリー。

**出力:**
```
┌──────────────────────────┬──────────┐
│ 項目                     │ 金額     │
├──────────────────────────┼──────────┤
│ 本月使用額               │ $145.67  │
│ 予算                     │ $200.00  │
│ 残予算                   │ $54.33   │
│ 使用率                   │ 72.8%    │
│ 予測月末額               │ $195.00  │
│ 昨月比                   │ -5.2%    │
└──────────────────────────┴──────────┘
```

#### 1.9.2 company costs breakdown

```bash
company costs breakdown [--by <agent|model|date>] [--limit 100]
```

エージェント別・モデル別・日別コスト内訳。

**出力（エージェント別）:**
```
┌──────────────┬──────────────┬──────────────┬──────────┐
│ エージェント │ トークン     │ コスト       │ 割合     │
├──────────────┼──────────────┼──────────────┼──────────┤
│ claude-1     │ 450,000      │ $67.50       │ 46.3%    │
│ code-gen     │ 380,000      │ $57.00       │ 39.1%    │
│ data-analyze │ 120,000      │ $21.17       │ 14.5%    │
└──────────────┴──────────────┴──────────────┴──────────┘
```

#### 1.9.3 company costs export

```bash
company costs export [--format csv|json|xlsx] [--output <file>]
```

コスト履歴をエクスポート。

```bash
$ company costs export --format csv --output costs-2026-04.csv

✅ コスト履歴をエクスポートしました

ファイル: costs-2026-04.csv (15KB)
保存先: ./costs-2026-04.csv

内容: 450行（2026年4月のコスト記録）
```

---

### 1.12 company activity

アクティビティ・監査ログ表示。

#### 1.10.1 company activity list

```bash
company activity list [--actor <user>] [--action <action>] [--limit 100]
```

全操作ログを表示。

**出力:**
```
┌────────┬───────────────┬──────────────────────┬──────────────────────┐
│ 時刻   │ 操作者        │ 操作                 │ 対象                 │
├────────┼───────────────┼──────────────────────┼──────────────────────┤
│ 16:30  │ admin@acme.com│ create               │ Issue COMP-005       │
│ 16:25  │ claude-1      │ update               │ Issue COMP-002       │
│ 16:20  │ admin@acme.com│ assign               │ COMP-003 → agent_xxx │
└────────┴───────────────┴──────────────────────┴──────────────────────┘
```

#### 1.10.2 company activity stream

```bash
company activity stream [--follow] [--grep <pattern>]
```

リアルタイムアクティビティストリーム。

```bash
$ company activity stream --follow

16:30:15 admin@acme.com created Issue COMP-005
16:30:20 claude-1 updated Issue COMP-002: status → done
16:30:25 system heartbeat completed for agent claude-1
... (リアルタイム更新)
```

---

### 1.13 company ui

Web UIを起動・管理。

#### 基本構文
```bash
company ui [--port 3001] [--open] [--dev]
```

#### オプション

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--port` | ポート番号 | 3001 |
| `--open` | ブラウザで自動起動 | true |
| `--dev` | Vite開発モード（ホットリロード） | false |

#### 実行

```bash
$ company ui

🌐 Web UI を起動中...

✅ UIサーバーが起動しました

🔗 http://localhost:3001
📝 言語: 日本語

ブラウザを自動起動します... (3秒待機)

Ctrl+C で終了
```

**開発モード:**
```bash
$ company ui --dev

⚙️  Vite開発サーバーを起動中...

✅ 開発サーバーが起動しました

🔗 http://localhost:5173
📝 言語: 日本語
🔄 ホットモジュール置換: 有効

Ctrl+C で終了
```

---

### 1.14 company doctor

環境・接続診断コマンド。

#### 基本構文
```bash
company doctor [--json] [--verbose]
```

#### 診断項目

**出力:**
```
🔍 .company CLI 環境診断

【システム情報】
  OS: macOS 13.0
  Node.js: v20.11.0
  npm: 10.2.0
  ✅ 互換性確認済み

【インストール方式】
  方式: Docker
  Docker Desktop: ✅ 起動中（v4.28.0）

【データベース接続】
  接続先: localhost:5432
  DB名: company
  接続状態: ✅ OK (応答時間: 12ms)
  テーブル数: 61

【APIサーバー】
  アドレス: http://localhost:3000
  ステータス: ✅ Running (v1.0.0)
  レスポンス時間: 45ms

【Web UI】
  アドレス: http://localhost:3001
  ステータス: ✅ Ready

【認証】
  APIキー: 設定済み（comp_live_xxxx...）
  トークン有効期限: 2026-05-03

【ディスク容量】
  合計: 100GB
  使用中: 42GB
  PostgreSQL データ: 340MB
  ログ: 45MB
  空き容量: 58GB ✅

【推奨アクション】
  なし。すべて正常です。

💡 詳細: company doctor --verbose
```

---

### 1.15 company config

グローバル設定管理。

#### 1.13.1 company config set

```bash
company config set <key> <value>
```

設定値を変更。

**主要設定キー:**

| キー | 説明 | 例 |
|------|------|-----|
| `language` | UI言語（ja / en） | `company config set language en` |
| `api-url` | API URL | `company config set api-url http://api.example.com` |
| `log-level` | ログレベル（debug/info/warn/error） | `company config set log-level debug` |
| `heartbeat-interval` | デフォルトハートビート間隔（秒） | `company config set heartbeat-interval 600` |

#### 1.13.2 company config get

```bash
company config get [key]
```

設定値を表示。

```bash
$ company config get language
ja

$ company config get           # 全設定表示
language: ja
api-url: http://localhost:3000
log-level: info
heartbeat-interval: 300
```

#### 1.13.3 company config list

```bash
company config list [--json]
```

全設定を表示（config getの別形式）。

#### 1.13.4 company config reset

```bash
company config reset [--confirm]
```

設定をリセット。

```bash
$ company config reset --confirm

⚠️  警告: 全設定がリセットされます

✅ リセット完了

デフォルト設定に戻りました:
  language: ja
  api-url: http://localhost:3000
  log-level: info
  ...
```

---

### 1.16 company version

バージョン情報・アップデート確認。

#### 基本構文
```bash
company version [--check-update] [--json]
```

#### 出力

```bash
$ company version

.company CLI v1.0.0

リリース日: 2026-04-03
Node.js要件: ≥ v20.0.0
ライセンス: Proprietary

アップデート確認: company version --check-update
```

**アップデート確認:**
```bash
$ company version --check-update

✅ アップデート利用可

現在のバージョン: v1.0.0
最新バージョン: v1.0.1
リリース日: 2026-04-04

変更内容:
  • Bug fix: Database connection retry
  • Performance: Improved heartbeat speed

アップデート方法: npm install -g @company/cli@latest
```

---

## 2. CLIコマンド共通仕様

### 2.1 グローバルオプション

全コマンドで共通利用可能。

| オプション | 説明 | 型 | デフォルト |
|----------|------|-----|----------|
| `--json` | JSON形式で出力 | boolean | false |
| `--quiet` | 最小限の出力（進捗なし） | boolean | false |
| `--verbose` | 詳細ログ出力 | boolean | false |
| `--config` | config.jsonのパス指定 | string | `~/.company-cli/config.json` |
| `--api-url` | API URL上書き | string | — |
| `--api-key` | APIキー上書き | string | — |

**使用例:**
```bash
company agents list --json
company issues create --title "New" --quiet
company doctor --verbose
company agents start my-claude --api-url http://api.example.com
```

### 2.2 認証設定

#### APIキーの設定方法

**方法1: 環境変数（推奨）**
```bash
export COMPANY_API_KEY="comp_live_xxxxxxxxxxxxxxxxxxxx"
company agents list   # 自動認証
```

**方法2: config.json**
```json
{
  "apiKey": "comp_live_xxxxxxxxxxxxxxxxxxxx",
  "apiUrl": "http://localhost:3000"
}
```

**方法3: コマンドラインオプション**
```bash
company agents list --api-key "comp_live_xxxxxxxxxxxxxxxxxxxx"
```

**優先順序:**
1. コマンドラインオプション
2. 環境変数 `COMPANY_API_KEY`
3. config.json の apiKey フィールド

### 2.3 出力フォーマット

#### テーブル形式（デフォルト）

```
┌─────┬──────────┬──────────┐
│ ID  │ 名前     │ ステータス│
├─────┼──────────┼──────────┤
│ 1   │ Item A   │ done     │
└─────┴──────────┴──────────┘
```

#### JSON形式（--json フラグ）

```json
[
  {
    "id": "1",
    "name": "Item A",
    "status": "done"
  }
]
```

#### エラー表示

**標準エラー出力（stderr）:**
```
❌ エラーが発生しました

[ERROR] DatabaseConnection: Unable to connect to localhost:5432
  Code: ECONNREFUSED
  Message: connect ECONNREFUSED 127.0.0.1:5432

詳細ログ: ~/.company-cli/logs/error-2026-04-03-15-30.log

対応:
  1. PostgreSQL が起動しているか確認: company doctor
  2. company init を再実行してください
```

### 2.4 多言語対応（CLI）

#### COMPANY_LANG 環境変数

```bash
# 日本語（デフォルト）
COMPANY_LANG=ja company agents list

# 英語
COMPANY_LANG=en company agents list

# config.json で永続化
company config set language en
```

#### CLIヘルプの多言語対応

```bash
$ COMPANY_LANG=ja company --help
.company CLI v1.0.0

使用方法: company <command> [options]

コマンド:
  org          組織管理
  agents       エージェント管理
  issues       Issue・タスク管理
  ...

詳細ヘルプ: company <command> --help


$ COMPANY_LANG=en company --help
.company CLI v1.0.0

Usage: company <command> [options]

Commands:
  org          Organization management
  agents       Agent management
  issues       Issue and task management
  ...

More help: company <command> --help
```

### 2.5 終了コード

| コード | 意味 | 例 |
|--------|------|-----|
| 0 | 成功 | コマンド正常実行 |
| 1 | 一般エラー | 予期しない内部エラー |
| 2 | 認証エラー | APIキー無効・期限切れ |
| 3 | 接続エラー | DB・API接続失敗 |
| 4 | バリデーションエラー | 不正な入力値 |

**使用例（スクリプト）:**
```bash
#!/bin/bash
company agents list
if [ $? -eq 0 ]; then
  echo "Success"
else
  echo "Failed with code: $?"
fi
```

---

## 3. アダプター実装仕様

### 3.1 共通インターフェース（再掲・詳細版）

#### TypeScript型定義

```typescript
// packages/adapters/src/base.ts

export enum AdapterType {
  CLAUDE_LOCAL = 'claude_local',
  CLAUDE_API = 'claude_api',
  CODEX_LOCAL = 'codex_local',
  CURSOR = 'cursor',
  GEMINI_LOCAL = 'gemini_local',
  OPENCLAW_GATEWAY = 'openclaw_gateway',
  OPENCODE_LOCAL = 'opencode_local',
  PI_LOCAL = 'pi_local'
}

export interface AdapterConfig {
  type: AdapterType
  cliPath?: string          // CLI実行ファイルのパス（ローカルアダプタ）
  apiKey?: string           // APIキー（暗号化済み・Gatewayアダプタ）
  customParams?: Record<string, unknown>  // アダプター固有パラメータ
}

export interface HeartbeatContext {
  agentId: string           // エージェントID（UUID）
  agentName: string         // エージェント名
  taskDescription: string   // タスク説明（Issue詳細等）
  previousState?: Record<string, any>  // 前回の実行結果（状態引き継ぎ用）
  config: AdapterConfig     // アダプター設定
  timeoutMs?: number        // タイムアウト時間（デフォルト: 30000ms）
  retryCount?: number       // リトライ回数（デフォルト: 0）
  maxRetries?: number       // 最大リトライ回数（デフォルト: 3）
}

export interface HeartbeatResult {
  success: boolean          // 実行成功フラグ
  output: string            // CLI実行の標準出力
  exitCode: number          // プロセス終了コード
  duration: number          // 実行時間（ms）
  tokens?: {                // トークン使用量（オプション）
    model: string           // モデル名（claude, gpt-4等）
    inputTokens: number     // 入力トークン
    outputTokens: number    // 出力トークン
    totalTokens: number     // 合計トークン
    costUsd?: number        // コスト（USD、オプション）
  }
  errors?: string[]         // エラーメッセージリスト
  logs: HeartbeatEvent[]    // イベントログ
  metadata?: Record<string, any>  // その他メタデータ
}

export interface HeartbeatEvent {
  timestamp: Date           // イベント時刻
  level: 'debug' | 'info' | 'warn' | 'error'  // ログレベル
  message: string           // ログメッセージ
  context?: Record<string, any>  // コンテキスト情報
}

export interface AgentAdapter {
  type: AdapterType

  /**
   * ハートビート実行（メイン処理）
   * @param context ハートビートコンテキスト
   * @returns ハートビート結果
   */
  execute(context: HeartbeatContext): Promise<HeartbeatResult>

  /**
   * 設定テスト（接続確認）
   * @param config アダプター設定
   * @returns テスト成功フラグ
   */
  test(config: AdapterConfig): Promise<boolean>

  /**
   * モデル自動検出（インストール済みモデル一覧）
   * @param config アダプター設定
   * @returns 検出されたモデル名（例: claude-opus）
   */
  detectModel(config: AdapterConfig): Promise<string | null>

  /**
   * 設定値検証
   * @param config アダプター設定
   * @returns 検証結果
   */
  validateConfig(config: AdapterConfig): Promise<{ valid: boolean; errors?: string[] }>

  /**
   * CLI自動検出（インストール済みCLI検索）
   * @returns CLIパス（見つからない場合は null）
   */
  detectCli(): Promise<string | null>
}
```

---

### 3.2 claude_local アダプター

Claude Code CLI（ローカル実行）対応。

#### 実装仕様

**ファイル**: `packages/adapters/src/adapters/claude-local.ts`

```typescript
export class ClaudeLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.CLAUDE_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    const startTime = Date.now()
    const logs: HeartbeatEvent[] = []

    try {
      // 1. CLI パス確認
      const cliPath = context.config.cliPath || (await this.detectCli())
      if (!cliPath) {
        throw new Error('Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code')
      }

      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Using Claude CLI: ${cliPath}`
      })

      // 2. コマンド構築
      const prompt = `
You are an AI assistant helping with development tasks.

Agent Name: ${context.agentName}
Task: ${context.taskDescription}

${context.previousState ? `Previous State:\n${JSON.stringify(context.previousState, null, 2)}\n` : ''}

Please complete this task and provide a detailed response.
      `.trim()

      // 3. 実行（タイムアウト付き）
      const { stdout, stderr, exitCode } = await this.execWithTimeout(
        cliPath,
        ['-p', prompt, '--output-format', 'json'],
        context.timeoutMs || 30000
      )

      logs.push({
        timestamp: new Date(),
        level: exitCode === 0 ? 'info' : 'error',
        message: `CLI execution completed with code ${exitCode}`
      })

      // 4. 出力パース
      let output = stdout
      let parsedOutput: any = null
      try {
        parsedOutput = JSON.parse(stdout)
        output = JSON.stringify(parsedOutput, null, 2)
      } catch {
        // JSON パース失敗時は標準出力をそのまま使用
      }

      // 5. トークン使用量（ローカル実行なので記録のみ）
      const tokens = {
        model: 'claude-local',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }

      return {
        success: exitCode === 0,
        output,
        exitCode,
        duration: Date.now() - startTime,
        tokens,
        logs,
        errors: exitCode !== 0 ? [stderr] : undefined
      }
    } catch (error) {
      logs.push({
        timestamp: new Date(),
        level: 'error',
        message: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        output: '',
        exitCode: 1,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        logs
      }
    }
  }

  async test(config: AdapterConfig): Promise<boolean> {
    try {
      const cliPath = config.cliPath || (await this.detectCli())
      if (!cliPath) return false

      const { exitCode } = await this.execWithTimeout(
        cliPath,
        ['--version'],
        5000
      )
      return exitCode === 0
    } catch {
      return false
    }
  }

  async detectModel(config: AdapterConfig): Promise<string | null> {
    // Claude Code はローカル実行なのでモデル選択不要
    return 'claude-local'
  }

  async validateConfig(config: AdapterConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    // CLI パス確認
    if (config.cliPath) {
      const exists = await this.fileExists(config.cliPath)
      if (!exists) {
        errors.push(`Claude CLI path not found: ${config.cliPath}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  async detectCli(): Promise<string | null> {
    try {
      const { stdout } = await this.execWithTimeout(
        'which',
        ['claude'],
        2000
      )
      return stdout.trim()
    } catch {
      return null
    }
  }

  private execWithTimeout(
    command: string,
    args: string[],
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode: exitCode || 0 })
      })

      proc.on('error', (error) => {
        reject(error)
      })
    })
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path)
      return true
    } catch {
      return false
    }
  }
}
```

---

### 3.3 claude_api アダプター

#### 概要
Anthropic API キーを使って Claude API を直接呼び出す従量課金アダプター。
`@anthropic-ai/sdk` パッケージを使用し、組織設定の `anthropicApiKey` を使用する。

**用途**: サブスクリプション不要で Anthropic API を直接使いたい場合

#### ファイル
`packages/adapters/src/adapters/claude-api.ts`

#### クラス定義
```typescript
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeApiAdapter implements AgentAdapter {
  readonly type = AdapterType.CLAUDE_API
  private client: Anthropic
  private model: string

  constructor(config: AdapterConfig) {
    if (!config.apiKey) {
      throw new Error('claude_api adapter requires apiKey in config')
    }
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = (config.customParams?.model as string) || 'claude-3-5-haiku-20241022'
  }

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    const startTime = Date.now()
    const logs: HeartbeatEvent[] = []

    try {
      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Using Anthropic API (model: ${this.model})`
      })

      // プロンプト構築
      const prompt = `
You are an AI assistant helping with development tasks.

Agent Name: ${context.agentName}
Task: ${context.taskDescription}

${context.previousState ? `Previous State:\n${JSON.stringify(context.previousState, null, 2)}\n` : ''}

Please complete this task and provide a detailed response.
      `.trim()

      // API呼び出し
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `API call completed`
      })

      // 出力抽出
      const output = response.content[0].type === 'text' ? response.content[0].text : ''

      // トークン使用量
      const tokens = {
        model: this.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }

      return {
        success: true,
        output,
        exitCode: 0,
        duration: Date.now() - startTime,
        tokens,
        logs,
        metadata: {
          model: this.model,
          stop_reason: response.stop_reason
        }
      }
    } catch (error) {
      logs.push({
        timestamp: new Date(),
        level: 'error',
        message: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        output: '',
        exitCode: 1,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        logs
      }
    }
  }

  async test(config: AdapterConfig): Promise<boolean> {
    try {
      if (!config.apiKey) return false

      const client = new Anthropic({ apiKey: config.apiKey })
      // models.list() でAPI接続確認
      await client.models.list()
      return true
    } catch {
      return false
    }
  }

  async detectModel(config: AdapterConfig): Promise<string | null> {
    try {
      if (!config.apiKey) return null

      const client = new Anthropic({ apiKey: config.apiKey })
      const models = await client.models.list()

      // 最初の利用可能なモデルを返す
      const model = models.data[0]
      return model?.id || 'claude-3-5-haiku-20241022'
    } catch {
      return 'claude-3-5-haiku-20241022'
    }
  }

  async validateConfig(config: AdapterConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.apiKey) {
      errors.push('claude_api adapter requires apiKey in config')
    }

    if (config.apiKey && !config.apiKey.startsWith('sk-ant-')) {
      errors.push('Invalid Anthropic API key format (must start with sk-ant-)')
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  async detectCli(): Promise<string | null> {
    // API ベースアダプターなので CLI 検出不要
    return null
  }
}
```

#### 設定パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `apiKey` | string | **必須** | Anthropic API キー（`sk-ant-...` 形式） |
| `customParams.model` | string | 任意 | 使用モデル（デフォルト: `claude-3-5-haiku-20241022`）|

#### createAdapter() でのルーティング
```typescript
case 'claude_api':
  return new ClaudeApiAdapter(config);  // Anthropic API キー（従量課金）
```

#### claude_local との違い

| 項目 | claude_local | claude_api |
|------|-------------|------------|
| 実行方式 | `claude -p` CLI を子プロセスで起動 | `@anthropic-ai/sdk` で API を直接呼び出し |
| 課金 | Claude サブスクリプション（追加課金なし） | Anthropic API 従量課金 |
| 必要なもの | Claude CLI インストール済み | Anthropic API キー |
| オフライン動作 | 不可 | 不可 |
| APIキー設定 | 不要 | `config.apiKey` に設定 |

---

### 3.4 codex_local アダプター

OpenAI Codex CLI対応。実装方法はclaude_localと類似。

```typescript
export class CodexLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.CODEX_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // claude_local と同じフロー
    // ただし CLI コマンドは openai_codex / codex など別形式
  }

  async detectCli(): Promise<string | null> {
    // which codex など OpenAI Codex 固有の検出方法
  }
}
```

---

### 3.5 cursor アダプター

Cursor IDE CLI対応。

```typescript
export class CursorAdapter implements AgentAdapter {
  readonly type = AdapterType.CURSOR

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // Cursor 固有のCLI形式で実行
    // cursor --command "..." など
  }

  async detectCli(): Promise<string | null> {
    // Cursor のインストール検出
  }
}
```

---

### 3.6 gemini_local アダプター

Google Gemini CLI対応。

```typescript
export class GeminiLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.GEMINI_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // gemini-cli コマンドで実行
  }

  async detectCli(): Promise<string | null> {
    // Gemini CLI 検出
  }
}
```

---

### 3.7 openclaw_gateway アダプター

OpenClaw Gateway API対応。リモートAPI経由。

```typescript
export class OpenClawGatewayAdapter implements AgentAdapter {
  readonly type = AdapterType.OPENCLAW_GATEWAY

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // HTTP POSTで Gateway にリクエスト送信
    const payload = {
      task: context.taskDescription,
      agentId: context.agentId,
      previousState: context.previousState
    }

    const response = await fetch(
      `${this.gatewayUrl}/api/execute`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    )

    const result = await response.json()
    return {
      success: response.ok,
      output: result.output,
      exitCode: response.ok ? 0 : 1,
      duration: result.durationMs,
      tokens: result.tokens,
      logs: result.logs || [],
      errors: response.ok ? undefined : [result.error]
    }
  }

  async test(config: AdapterConfig): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.gatewayUrl}/health`,
        {
          headers: { 'Authorization': `Bearer ${config.apiKey}` }
        }
      )
      return response.ok
    } catch {
      return false
    }
  }

  async validateConfig(config: AdapterConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    if (!config.apiKey) {
      errors.push('OpenClaw Gateway requires apiKey in config')
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}
```

---

### 3.8 opencode_local アダプター

OpenCode CLI対応。**既知バグ: 1つのtool callで落ちる → 回避策実装**

```typescript
export class OpenCodeLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.OPENCODE_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // OpenCode 実行
    // 【回避策】複数 tool call を分割して実行

    const segments = this.splitTaskByToolCalls(context.taskDescription)
    const results: HeartbeatResult[] = []

    for (const segment of segments) {
      const segmentContext = { ...context, taskDescription: segment }
      const result = await this.executeSegment(segmentContext)
      results.push(result)

      if (!result.success) {
        // 失敗時はそこで中止
        return result
      }
    }

    // 複数セグメントの結果を統合
    return this.mergeResults(results)
  }

  private splitTaskByToolCalls(task: string): string[] {
    // タスクを tool call ごとに分割
    // 例: "Use tool A then tool B" → ["Use tool A", "Use tool B"]
    return task.split(/then|and/).map(t => t.trim()).filter(t => t)
  }

  private async executeSegment(context: HeartbeatContext): Promise<HeartbeatResult> {
    // 単一セグメントを実行
    // 実装は claude_local 相似
  }

  private mergeResults(results: HeartbeatResult[]): HeartbeatResult {
    // 複数結果を統合
    return {
      success: results.every(r => r.success),
      output: results.map(r => r.output).join('\n\n---\n\n'),
      exitCode: results.some(r => r.exitCode !== 0) ? 1 : 0,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      logs: results.flatMap(r => r.logs),
      errors: results.flatMap(r => r.errors || [])
    }
  }
}
```

---

### 3.9 pi_local アダプター

Pi CLI対応。

```typescript
export class PiLocalAdapter implements AgentAdapter {
  readonly type = AdapterType.PI_LOCAL

  async execute(context: HeartbeatContext): Promise<HeartbeatResult> {
    // Pi CLI 実行
    // pi --prompt "..." など
  }
}
```

---

### 3.10 アダプターレジストリ

アダプター管理・ファクトリクラス。

```typescript
// packages/adapters/src/registry.ts

export class AdapterRegistry {
  private adapters: Map<AdapterType, AgentAdapter> = new Map()

  constructor() {
    // 全アダプターを登録
    this.register(new ClaudeLocalAdapter())
    this.register(new ClaudeApiAdapter())
    this.register(new CodexLocalAdapter())
    this.register(new CursorAdapter())
    this.register(new GeminiLocalAdapter())
    this.register(new OpenClawGatewayAdapter())
    this.register(new OpenCodeLocalAdapter())
    this.register(new PiLocalAdapter())
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.type, adapter)
  }

  get(type: AdapterType): AgentAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`Unsupported adapter type: ${type}`)
    }
    return adapter
  }

  getAll(): AgentAdapter[] {
    return Array.from(this.adapters.values())
  }

  getSupportedTypes(): AdapterType[] {
    return Array.from(this.adapters.keys())
  }
}

// グローバルインスタンス
export const adapterRegistry = new AdapterRegistry()
```

---

### 3.11 ハートビート実行フロー（詳細）

**ファイル**: `packages/api/src/heartbeat/executor.ts`

```typescript
export class HeartbeatExecutor {
  constructor(private registry: AdapterRegistry) {}

  async execute(agent: Agent, task: Task): Promise<HeartbeatRun> {
    const startTime = new Date()
    const logs: HeartbeatEvent[] = []

    try {
      // 1. 前提チェック
      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Starting heartbeat for agent ${agent.name}`
      })

      // 2. エージェント状態確認（排他ロック）
      await this.acquireLock(agent.id)

      // 3. アダプター取得
      const adapter = this.registry.get(agent.config.type)

      // 4. ハートビート実行
      const context: HeartbeatContext = {
        agentId: agent.id,
        agentName: agent.name,
        taskDescription: task.description,
        previousState: agent.runtimeState,
        config: agent.config,
        timeoutMs: 30000,
        maxRetries: 3
      }

      let result = await adapter.execute(context)

      // 5. リトライロジック
      let retryCount = 0
      while (!result.success && retryCount < (context.maxRetries || 3)) {
        retryCount++
        logs.push({
          timestamp: new Date(),
          level: 'warn',
          message: `Retry ${retryCount}/${context.maxRetries}`
        })

        // 指数バックオフ: 1秒 × 2^retryCount
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, retryCount))
        )

        result = await adapter.execute(context)
      }

      // 6. 結果をDB保存
      const heartbeatRun = await this.saveHeartbeatRun(
        agent.id,
        result,
        startTime
      )

      // 7. 状態更新
      await this.updateAgentState(agent.id, {
        lastHeartbeatAt: new Date(),
        lastHeartbeatSuccess: result.success,
        runtimeState: result.metadata || {}
      })

      // 8. コスト記録
      if (result.tokens) {
        await this.recordCost(agent.id, result.tokens)
      }

      logs.push({
        timestamp: new Date(),
        level: result.success ? 'info' : 'error',
        message: result.success
          ? 'Heartbeat completed successfully'
          : 'Heartbeat failed after retries'
      })

      return heartbeatRun
    } catch (error) {
      logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Heartbeat error: ${error instanceof Error ? error.message : String(error)}`
      })

      throw error
    } finally {
      // ロック解放
      await this.releaseLock(agent.id)
    }
  }

  private async acquireLock(agentId: string): Promise<void> {
    // PostgreSQL の SELECT FOR UPDATE でロック
    const query = `
      SELECT * FROM agents WHERE id = $1 FOR UPDATE
    `
    // 別のハートビートが同時実行されるのを防止
  }

  private async releaseLock(agentId: string): Promise<void> {
    // トランザクション終了時に自動的に解放
  }

  private async saveHeartbeatRun(
    agentId: string,
    result: HeartbeatResult,
    startTime: Date
  ): Promise<HeartbeatRun> {
    // heartbeat_runs テーブルに挿入
    const heartbeatRun = {
      id: uuid(),
      agentId,
      startedAt: startTime,
      completedAt: new Date(),
      success: result.success,
      duration: result.duration,
      exitCode: result.exitCode,
      output: result.output
    }

    // heartbeat_run_events に詳細ログを挿入
    for (const event of result.logs) {
      await this.saveHeartbeatEvent(heartbeatRun.id, event)
    }

    return heartbeatRun
  }

  private async recordCost(
    agentId: string,
    tokens: { model: string; totalTokens: number }
  ): Promise<void> {
    // cost_events テーブルに記録
    // pricing = totalTokens × unitPrice[model]
  }
}
```

---

## 4. packages/ 構成詳細

### 4.1 packages/api/ 構成

**ファイル構成:**
```
packages/api/
├── src/
│   ├── index.ts                    ← Express サーバーエントリポイント
│   ├── middleware/
│   │   ├── auth.ts                ← APIキー認証
│   │   ├── errorHandler.ts        ← エラーハンドリング
│   │   └── logging.ts             ← ロギング
│   ├── routes/
│   │   ├── auth.ts                ← POST /auth/login, /auth/token
│   │   ├── agents.ts              ← GET/POST /agents, /agents/:id
│   │   ├── issues.ts              ← GET/POST /issues, /issues/:id
│   │   ├── goals.ts               ← ゴール管理API
│   │   ├── heartbeat.ts           ← POST /heartbeat/:agentId
│   │   └── health.ts              ← GET /health
│   ├── services/
│   │   ├── AgentService.ts        ← エージェント業務ロジック
│   │   ├── IssueService.ts        ← Issue業務ロジック
│   │   ├── HeartbeatService.ts    ← ハートビート実行ロジック
│   │   └── CostService.ts         ← コスト計算ロジック
│   ├── models/
│   │   ├── Agent.ts               ← Agentエンティティ型
│   │   └── Issue.ts               ← Issueエンティティ型
│   └── db/
│       ├── schema.ts              ← Drizzle スキーマ定義
│       └── migrations/            ← マイグレーションファイル
├── Dockerfile                      ← Docker イメージ定義
├── package.json
└── tsconfig.json
```

**主要ファイルの責務:**

| ファイル | 責務 |
|---------|------|
| `index.ts` | Express サーバーの起動・各ミドルウェア連携 |
| `middleware/auth.ts` | APIキー検証・トークン生成・期限管理 |
| `routes/agents.ts` | エージェント CRUD API提供 |
| `services/HeartbeatService.ts` | ハートビート実行の調整・スケジューリング |
| `db/schema.ts` | PostgreSQL テーブル定義（Drizzle） |

---

### 4.2 packages/cli/ 構成

**ファイル構成:**
```
packages/cli/
├── src/
│   ├── index.ts                    ← Commander.js エントリ
│   ├── commands/
│   │   ├── init.ts                ← company init 実装
│   │   ├── org.ts                 ← company org <sub> 実装
│   │   ├── agents.ts              ← company agents <sub> 実装
│   │   ├── issues.ts              ← company issues <sub> 実装
│   │   ├── skills.ts              ← company skills <sub> 実装
│   │   ├── goals.ts               ← company goals <sub> 実装
│   │   ├── routines.ts            ← company routines <sub> 実装
│   │   ├── approvals.ts           ← company approvals <sub> 実装
│   │   ├── costs.ts               ← company costs <sub> 実装
│   │   ├── activity.ts            ← company activity <sub> 実装
│   │   ├── ui.ts                  ← company ui 実装
│   │   ├── doctor.ts              ← company doctor 実装
│   │   ├── config.ts              ← company config <sub> 実装
│   │   └── version.ts             ← company version 実装
│   ├── lib/
│   │   ├── api-client.ts          ← APIクライアント
│   │   ├── config.ts              ← config.json 管理
│   │   ├── logger.ts              ← ロギング
│   │   ├── table-formatter.ts     ← テーブル出力フォーマット
│   │   └── i18n.ts               ← 多言語対応
│   └── types.ts                   ← TypeScript型定義
├── package.json
└── tsconfig.json
```

**Commander.js パターン:**

```typescript
// src/index.ts
import { Command } from 'commander'
import { InitCommand } from './commands/init'
import { OrgCommand } from './commands/org'

const program = new Command()

program
  .version('1.0.0')
  .description('.company CLI - AI Agent Organization Platform')

// company init
program
  .command('init [method]')
  .option('--docker', 'Use Docker method')
  .option('--native', 'Use native method')
  .action(new InitCommand().execute)

// company org
const orgCmd = program
  .command('org')
  .description('Organization management')

orgCmd
  .command('show')
  .option('--json', 'Output as JSON')
  .action(new OrgCommand().show)

orgCmd
  .command('update')
  .requiredOption('--name <name>', 'New organization name')
  .action(new OrgCommand().update)

// ... 他のコマンド

program.parse(process.argv)
```

---

### 4.3 packages/db/ 構成

**ファイル構成:**
```
packages/db/
├── src/
│   ├── schema.ts                   ← Drizzle テーブル定義
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql ← 初期スキーマ
│   │   ├── 0002_add_indexes.sql    ← インデックス追加
│   │   └── ...
│   └── seed.ts                     ← テストデータ挿入
├── drizzle.config.ts               ← Drizzle設定
└── package.json
```

**schema.ts の内容:**

```typescript
import { pgTable, uuid, text, timestamp, integer, json, varchar } from 'drizzle-orm/pg-core'

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // claude_local, cursor, etc.
  config: json('config').notNull(), // アダプター設定
  status: varchar('status', { length: 20 }).default('created'), // created, running, stopped, error
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  lastHeartbeatSuccess: pgBoolean('last_heartbeat_success'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 他の61テーブル...
```

---

### 4.4 packages/adapters/ 構成

**ファイル構成:**
```
packages/adapters/
├── src/
│   ├── index.ts                    ← AdapterRegistry エクスポート
│   ├── base.ts                     ← AgentAdapter インターフェース定義
│   ├── adapters/
│   │   ├── claude-local.ts        ← ClaudeLocalAdapter
│   │   ├── codex-local.ts         ← CodexLocalAdapter
│   │   ├── cursor.ts              ← CursorAdapter
│   │   ├── gemini-local.ts        ← GeminiLocalAdapter
│   │   ├── openclaw-gateway.ts    ← OpenClawGatewayAdapter
│   │   ├── opencode-local.ts      ← OpenCodeLocalAdapter
│   │   └── pi-local.ts            ← PiLocalAdapter
│   ├── registry.ts                ← AdapterRegistry クラス
│   └── types.ts                   ← 共通型定義
├── tests/
│   └── adapters.test.ts           ← アダプターユニットテスト
├── package.json
└── tsconfig.json
```

**テスト方針:**

```typescript
// tests/adapters.test.ts
describe('AdapterRegistry', () => {
  it('should register and retrieve adapters', () => {
    const registry = new AdapterRegistry()
    const adapter = registry.get(AdapterType.CLAUDE_LOCAL)
    expect(adapter).toBeDefined()
    expect(adapter.type).toBe(AdapterType.CLAUDE_LOCAL)
  })

  it('should execute heartbeat with claude_local', async () => {
    const adapter = new ClaudeLocalAdapter()
    const context: HeartbeatContext = {
      agentId: 'test-agent',
      agentName: 'Test Agent',
      taskDescription: 'Review code',
      config: { type: AdapterType.CLAUDE_LOCAL },
      timeoutMs: 10000
    }

    const result = await adapter.execute(context)
    expect(result).toBeDefined()
    expect(result.success).toBeDefined()
    expect(result.duration).toBeGreaterThan(0)
  })
})
```

---

### 4.5 packages/shared/ 構成

**ファイル構成:**
```
packages/shared/
├── src/
│   ├── types/
│   │   ├── agent.ts               ← Agent 型定義
│   │   ├── issue.ts               ← Issue 型定義
│   │   ├── cost.ts                ← Cost 型定義
│   │   └── common.ts              ← 共通型定義
│   ├── constants/
│   │   ├── adapter-types.ts       ← AdapterType 定義
│   │   ├── issue-status.ts        ← Issue ステータス定義
│   │   └── error-codes.ts         ← エラーコード定義
│   ├── utils/
│   │   ├── logger.ts              ← ロギングユーティリティ
│   │   ├── crypto.ts              ← 暗号化ユーティリティ（APIキー・シークレット）
│   │   ├── validators.ts          ← バリデーションユーティリティ
│   │   └── formatters.ts          ← フォーマッティング（日期・金額）
│   └── index.ts                   ← main export
├── package.json
└── tsconfig.json
```

**共有型の例:**

```typescript
// packages/shared/src/types/agent.ts

export interface Agent {
  id: string                        // UUID
  companyId: string                 // UUID
  name: string                      // 名前
  type: AdapterType                 // アダプタ種別
  config: AdapterConfig            // アダプタ設定
  status: AgentStatus              // ステータス
  runtimeState?: Record<string, any>  // 実行時状態
  lastHeartbeatAt?: Date
  lastHeartbeatSuccess?: boolean
  createdAt: Date
  updatedAt: Date
}

export type AgentStatus = 'created' | 'running' | 'stopped' | 'error'
```

---

## 改訂履歴

| 版 | 作成日 | 変更内容 | 担当 |
|----|--------|---------|------|
| v1.1 | 2026-04-03 | PR#1 company login・company registerセクション追加、LoginResponse/RegisterResponse型定義・フロー仕様を反映 | 開発部第4課（Hana） |
| v1.0 | 2026-04-03 | 初版作成（CLI詳細仕様 + アダプター実装仕様） | 開発部第1課（Omar）× 第2課（Yena） |

