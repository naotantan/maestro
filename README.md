# maestro — AIエージェントを「ちゃんと運用する」ためのプラットフォーム

## maestro って何？

「Claude や Gemini みたいな AI を業務で使い始めたけど、落ちたら誰かが手動で再起動してるし、気づいたら API 代が爆発してた…」

maestro は、そんな悩みを解決するためのオープンソースのバックエンドです。

やっていることはシンプルで、AI エージェントの「起動・監視・停止・コスト管理」を自動化します。いわば **AI エージェント版の運用管理ツール** です。

---

## どんな問題を解決するの？

| よくある困りごと | maestro がやってくれること |
|---|---|
| AI が落ちても気づかない | 30秒ごとにヘルスチェックして、落ちたら自動で再起動（最大3回まで） |
| API の請求が想定外に膨らむ | 月額の予算上限を設定しておけば、超えた瞬間にエージェントを自動停止 |
| 誰が何を実行したか分からない | 全操作にタイムスタンプ付きのログが残る（監査対応にも使える） |
| タスクの割り振りが手作業 | タスクを登録すると、空いているエージェントに自動でアサイン |
| 重要な操作を AI に任せきりにできない | 「人間の承認が必要」なゲートを設定できる |
| Slack や GitHub と連携したい | Webhook で設定するだけ。コードを書く必要なし |

---

## 対応している AI モデル

maestro は「アダプター」というしくみで複数の AI に対応しています。ソースコード（`packages/adapters/src/`）を見ると、以下のアダプターが用意されています。

| アダプター | 説明 |
|---|---|
| `claude-api` | Anthropic API 経由で Claude を利用 |
| `claude-local` | ローカルの Claude（Claude Code など）を利用 |
| `codex-local` | OpenAI Codex をローカルで利用 |
| `gemini-local` | Google Gemini をローカルで利用 |
| `cursor` | Cursor エディタと連携 |
| `opencode-local` | OpenCode をローカルで利用 |
| `openclaw-gateway` | OpenClaw ゲートウェイ経由で利用 |
| `pi-local` | Pi をローカルで利用 |

Web ダッシュボードからモデルを切り替えられるので、コードの変更は不要です。

---

## システム全体の構成

maestro はモノレポ構成で、7つのパッケージに分かれています。

```
maestro/
├── packages/
│   ├── api/          ← REST API サーバー（Express.js）★メインのバックエンド
│   │   └── src/
│   │       ├── engine/
│   │       │   ├── heartbeat-engine.ts   … 30秒ごとの死活監視
│   │       │   ├── crash-recovery.ts     … クラッシュ検知→自動再起動
│   │       │   └── budget-monitor.ts     … 予算超過→自動停止
│   │       ├── routes/                   … 16個の REST エンドポイント
│   │       ├── middleware/               … 認証・ログ記録
│   │       └── server.ts                 … Express アプリ初期化
│   ├── cli/          ← コマンドラインツール（17個のコマンド）
│   ├── ui/           ← Web ダッシュボード（React + Vite）
│   ├── db/           ← データベース定義・マイグレーション（Drizzle ORM）
│   ├── adapters/     ← AI モデルへの接続アダプター（8種類）
│   ├── shared/       ← 共通の型定義・ユーティリティ
│   └── i18n/         ← 多言語対応（日本語・英語・中国語）
├── docker-compose.yml
└── package.json
```

---

## 3つのコアエンジンの動き

maestro の心臓部は `packages/api/src/engine/` にある3つのエンジンです。

### 1. ハートビートエンジン（heartbeat-engine.ts）

**何をするか：** 30秒ごとに、有効なエージェント全員に「生きてる？」と確認する。

**動きの流れ：**

1. データベースから `enabled: true` のエージェント一覧を取得
2. 最大3並列でアダプター経由のヘルスチェックを実行
3. 応答があれば `last_heartbeat_at` を更新
4. 応答がなければ `agent_runtime_state` を `crashed` に設定（→ クラッシュ回復エンジンが拾う）
5. ついでに、保留中のエージェント間引き継ぎ（handoff）も処理する

### 補足: エージェント間引き継ぎ（handoff）とチェーン

ハートビートエンジンは、タスクが完了した際に「次のエージェントへ引き継ぐ」処理も担当します。

- **1対1 handoff**: エージェントAが完了 → エージェントBへ成果物を渡して続きを依頼
- **チェーン（A→B→C）**: 複数エージェントを順番につなげてパイプラインとして動かす

設計仕様は `docs/handoff/` および `docs/chain/` を参照してください。

### 2. クラッシュ回復エンジン（crash-recovery.ts）

**何をするか：** 60秒ごとに、クラッシュしたエージェントを見つけて自動で復旧する。

**動きの流れ：**

1. `agent_runtime_state` テーブルから `status: crashed` のものを探す
2. 再起動回数が3回未満なら → 状態を `idle` に戻す（次のハートビートで再実行される）
3. 再起動回数が3回に達したら → エージェントを無効化して停止（無限ループ防止）

### 3. 予算モニター（budget-monitor.ts）

**何をするか：** 60秒ごとに、各テナント（会社）の当月コストをチェックする。

**動きの流れ：**

1. 全社の予算ポリシーを取得
2. 当月の累計コストを集計
3. 上限を超えていたら → その会社の全エージェントを自動停止
4. `budget_incidents` テーブルにインシデントを記録

---

## CLI で使えるコマンド一覧

`packages/cli/src/commands/` に17個のコマンドが実装されています。

| コマンド | できること |
|---|---|
| `init` | プロジェクトの初期設定 |
| `login` | API サーバーへのログイン |
| `register` | 新規ユーザー登録 |
| `org` | 組織（テナント）の管理 |
| `project` | プロジェクトの作成・一覧 |
| `agent` | エージェントの追加・一覧・有効化・無効化 |
| `goal` | ゴール（目標）の設定・進捗管理 |
| `issue` | イシューの作成・管理 |
| `routine` | 定期タスクのスケジュール設定 |
| `approval` | 承認待ちタスクの確認・承認・却下 |
| `costs` | コスト実績の確認 |
| `plugin` | プラグインの追加・管理 |
| `backup create` | SQLダンプを作成（`--output <path>` で保存先を指定可） |
| `backup list` | バックアップ一覧を表示 |
| `doctor` | 環境の健全性チェック |
| `update` | maestro 自体のアップデート |
| `uninstall` | maestro のアンインストール |
| `ui` | Web ダッシュボードの起動 |

---

## API エンドポイント一覧

REST API は16のリソースに対応しています（Bearer トークン認証）。

| エンドポイント | 役割 |
|---|---|
| `/health` | ヘルスチェック（認証不要） |
| `/auth` | ログイン・トークン発行 |
| `/org` | 組織管理 |
| `/companies` | テナント（会社）管理 |
| `/agents` | エージェントの CRUD |
| `/tasks` | タスクの作成・割り当て |
| `/issues` | イシュー管理 |
| `/goals` | ゴール管理 |
| `/projects` | プロジェクト管理 |
| `/costs` | コスト情報の取得 |
| `/routines` | 定期タスクの管理 |
| `/approvals` | 承認ワークフロー |
| `/activity` | 操作ログの参照 |
| `/plugins` | プラグイン管理 |
| `/settings` | テナント設定 |
| `/handoffs` | エージェント間の引き継ぎ |

---

## セットアップ手順（はじめての人向け）

### 必要なもの

| ツール | バージョン | 何に使うか |
|---|---|---|
| Node.js | 20 以上 | サーバーと CLI の実行 |
| pnpm | 9 以上 | パッケージ管理（npm の代わり） |
| Docker & Docker Compose | 最新推奨 | PostgreSQL データベースの起動 |

### 手順

```bash
# 1. リポジトリをダウンロード
git clone https://github.com/naotantan/maestro.git
cd maestro

# 2. 依存パッケージをインストール
pnpm install

# 3. 環境変数ファイルを準備
cp .env.example .env.development
# → .env.development をエディタで開いて、DATABASE_URL などを確認・編集

# 4. PostgreSQL を Docker で起動
docker compose up -d

# 5. データベースのテーブルを作成（マイグレーション）
pnpm db:migrate

# 6. API サーバーを起動（開発モード）
pnpm --filter @maestro/api dev
```

### 動作確認

```bash
# ヘルスチェック（正常なら {"status":"ok"} が返る）
curl http://localhost:3000/health
```

### Web ダッシュボードも使う場合

```bash
# 別のターミナルで UI を起動
pnpm --filter @maestro/ui dev
```

### API と UI を同時に起動する場合

```bash
# ルートの dev スクリプトで両方まとめて起動
pnpm dev
```

### Docker ショートカット

```bash
pnpm docker:up    # docker compose up -d と同等
pnpm docker:down  # docker compose down と同等
```

---

## 多言語対応

Web ダッシュボードおよび CLI メッセージは日本語・英語・中国語に対応しています。`packages/i18n/src/locales/` 配下の JSON ファイルを編集することで他の言語を追加できます。

---

## OpenAPI 仕様書

`docs/openapi.yaml` に全エンドポイントの仕様書があります。Swagger UI などで読み込むと API の動作を確認できます。

---

## セキュリティ対策

ソースコードで確認できたセキュリティ機能は以下の通りです。

| 対策 | 実装方法 |
|---|---|
| HTTP ヘッダー保護 | Helmet.js（CSP を含む） |
| レート制限 | 全体: 15分で100リクエスト / 認証: 15分で10リクエスト |
| 認証 | Bearer トークン方式 |
| テナント分離 | 全クエリに `company_id` フィルタを適用 |
| 暗号化 | AES-256-GCM（認証情報の保存） |
| SSRF 対策 | Webhook URL の DNS 解決＋プライベート IP レンジチェック |
| SQL インジェクション対策 | Drizzle ORM によるパラメータバインド |
| XSS 対策 | 入力値サニタイズ＋CSP ヘッダー |
| リクエスト追跡 | 全リクエストに `X-Request-ID` を付与 |

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| 言語 | TypeScript（厳格モード） |
| API サーバー | Express.js |
| データベース | PostgreSQL 17 |
| ORM | Drizzle ORM |
| フロントエンド | React + Vite |
| パッケージ管理 | pnpm（モノレポ） |
| テスト | Vitest |
| コンテナ | Docker / Docker Compose |
| ライセンス | MIT |

---

## 開発に参加したい場合

`CONTRIBUTING.md` に詳しい手順がありますが、ざっくり言うと以下の流れです。

1. `main` ブランチから feature ブランチを切る
2. 変更を実装する
3. `pnpm test` でテスト通過を確認
4. `pnpm typecheck` で型チェック通過を確認
5. コミットメッセージは Conventional Commits 形式（`feat:` `fix:` `docs:` など）
6. プルリクエストを作成

パッケージの依存関係は `shared → db → i18n → adapters → api → cli → ui` の順なので、個別ビルド時はこの順序で実行してください。一括ビルドなら `pnpm build` で自動解決されます。

---

## 概要

maestro は、Claude・Gemini・Codex などの AI エージェントを業務で安全に運用するためのオープンソースプラットフォームです。30秒間隔のヘルスチェック、クラッシュ時の自動復旧（最大3回）、月額予算超過時の自動停止という3つのコアエンジンを中心に、タスクの自動割り当て、人間による承認ゲート、エージェント間の引き継ぎ（handoff チェーン）、Webhook 連携、操作ログの全記録といった機能を提供します。マルチテナント設計のため複数の会社・チームでの共有利用にも対応しており、REST API・CLI（17コマンド）・Web ダッシュボードの3つのインターフェースから操作できます。
