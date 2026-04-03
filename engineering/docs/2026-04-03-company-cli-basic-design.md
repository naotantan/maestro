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
│  ┌────────┴──────────────────────────────┐             │
│  │  api: Node.js + Express               │             │
│  │  ├─ Port: 3000 (内部)                 │             │
│  │  ├─ Volume: node_modules/             │             │
│  │  ├─ Drizzle ORM (TypeScript)         │             │
│  │  ├─ PostgreSQL ドライバ               │             │
│  │  └─ Health check: curl /health        │             │
│  └────────────────────────────────────────┘             │
│           ▲                                              │
│           │                                              │
│  ┌────────┴──────────────────────────────┐             │
│  │  ui: Vite + React + Tailwind          │             │
│  │  ├─ Port: 5173 (内部)                 │             │
│  │  ├─ Volume: node_modules/             │             │
│  │  └─ Health check: curl /                            │
│  └────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
                               ▲
                    ポート公開 (localhost)
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              localhost:3000  localhost:5173  localhost:5432
               (API only)   (Web UI)      (DB direct)
```

### 1.2 ネイティブ方式（外部 PostgreSQL 利用時）

```
ホスト:
  ├─ CLI: company (Node.js 20+ / TypeScript)
  ├─ Web UI: Vite + React (localhost:5173)
  └─ API: Express.js (localhost:3000)
          ↓
      外部 PostgreSQL サーバ（例: RDS / 自社構築）
      ├─ Host: 10.0.1.100
      ├─ Port: 5432
      └─ Database: company
```

---

## 2. ファイルツリー構成

```
company-cli/
├── README.md
├── ARCHITECTURE.md          ← 本ドキュメント
├── docker-compose.yml       ← Docker Compose（推奨）
├── package.json
├── tsconfig.json
├── .gitignore
├── packages/
│   ├── cli/                 ← CLI アプリケーション
│   │   ├── src/
│   │   │   ├── index.ts     ← エントリーポイント
│   │   │   ├── commands/    ← コマンド実装
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.ts
│   │   │   │   │   ├── logout.ts
│   │   │   │   │   └── register.ts
│   │   │   │   ├── init.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── ...
│   │   │   ├── lib/         ← ユーティリティ
│   │   │   │   ├── api.ts   ← API クライアント
│   │   │   │   ├── config.ts ← ローカル設定
│   │   │   │   ├── logger.ts
│   │   │   │   └── ...
│   │   │   └── templates/   ← プロンプト / 質問文
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                 ← バックエンド API
│   │   ├── src/
│   │   │   ├── index.ts     ← エントリーポイント
│   │   │   ├── routes/      ← エンドポイント
│   │   │   │   ├── auth.ts
│   │   │   │   ├── agents.ts
│   │   │   │   ├── issues.ts
│   │   │   │   ├── skills.ts
│   │   │   │   ├── boards.ts
│   │   │   │   ├── goals.ts
│   │   │   │   ├── risks.ts
│   │   │   │   ├── members.ts
│   │   │   │   ├── roles.ts
│   │   │   │   └── ...
│   │   │   ├── models/      ← DB スキーマ（Drizzle ORM）
│   │   │   │   ├── companies.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── agents.ts
│   │   │   │   ├── issues.ts
│   │   │   │   └── ...
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts  ← API キー認証
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── ...
│   │   │   ├── services/    ← ビジネスロジック
│   │   │   │   ├── auth.ts
│   │   │   │   ├── agents.ts
│   │   │   │   └── ...
│   │   │   ├── db/          ← DB 接続
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                  ← Web UI（Vite + React）
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── auth/       ← 認証フロー
│       │   │   ├── dashboard/  ← ダッシュボード
│       │   │   ├── agents/     ← エージェント管理
│       │   │   ├── issues/     ← Issue 管理
│       │   │   ├── skills/     ← スキル管理
│       │   │   └── ...
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── utils/
│       │   └── styles/
│       └── public/
│
└── docs/
    ├── DESIGN.md            ← 本ドキュメント
    ├── API.md               ← API リファレンス
    ├── DEPLOYMENT.md        ← デプロイメント手順
    └── TESTING.md           ← テスト戦略
```

---

## 3. 主要な技術スタック

### 3.1 CLI（packages/cli）
- **言語**: TypeScript 5.0+
- **ランタイム**: Node.js 20+
- **フレームワーク**: Commander.js（コマンドライン引数パース）
- **設定管理**: `.company/config.json`（ホームディレクトリ配下）
- **HTTP クライアント**: Axios / Fetch API
- **データ検証**: Zod（型安全なバリデーション）

### 3.2 API（packages/api）
- **言語**: TypeScript 5.0+
- **ランタイム**: Node.js 20+
- **フレームワーク**: Express.js 4.18+
- **DB ORM**: Drizzle ORM（TypeScript ネイティブ）
- **データベース**: PostgreSQL 17
- **認証**: JWT ベース（API キー）
- **キャッシング**: Redis（オプション）
- **ログ**: Winston / Pino

### 3.3 Web UI（packages/ui）
- **言語**: TypeScript 5.0+ / JSX
- **フレームワーク**: React 18+
- **ビルドツール**: Vite 5.0+
- **CSS**: Tailwind CSS 3.0+
- **状態管理**: TanStack Query / Zustand
- **HTTP クライアント**: Axios / Fetch API
- **多言語対応**: i18next（日本語・英語）

---

## 4. ディプロイメント方式

### 4.1 開発環境（Docker Compose）
```bash
docker-compose up -d
```

### 4.2 本番環境
- **API**: AWS ECS / Kubernetes / Cloud Run
- **UI**: AWS CloudFront + S3 / Vercel / Netlify
- **DB**: AWS RDS PostgreSQL

---

## 5. 認証フロー

### 5.1 ユーザーログイン（CLI / Web 共通）
1. ユーザーが `company login` を実行
2. メール / パスワードをプロンプトで入力
3. API `/auth/login` に POST
4. バックエンド: ユーザー認証 → JWT / API キー発行
5. CLI: APIキーを `~/.company/config.json` に保存
6. 以降のリクエスト: `Authorization: Bearer <apiKey>` ヘッダー

### 5.2 新規登録
1. ユーザーが `company register` を実行
2. メール / パスワード / 名前 / 企業名をプロンプトで入力
3. API `/auth/register` に POST
4. バックエンド: ユーザー・企業を作成 → API キー発行
5. CLI: API キーを `~/.company/config.json` に保存

---

## 6. API 設計原則

### 6.1 RESTful 設計
- GET: 取得
- POST: 作成
- PUT / PATCH: 更新
- DELETE: 削除

### 6.2 レスポンスフォーマット
```json
{
  "success": true,
  "data": { /* レスポンスデータ */ },
  "error": null
}
```

### 6.3 エラーハンドリング
- HTTP ステータスコード: 400（入力エラー）/ 401（認証失敗）/ 403（権限なし）/ 500（サーバーエラー）
- エラーレスポンス:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "メールアドレスが無効です"
  }
}
```

---

## 7. マイグレーション戦略

### 7.1 DB マイグレーション（Drizzle ORM）
```bash
drizzle-kit migrate
```

### 7.2 バージョン管理
- `package.json` で API / CLI / UI のバージョンを記載
- セマンティックバージョニング: MAJOR.MINOR.PATCH

---

## 8. 性能要件

### 8.1 目標値
- **API レスポンスタイム**: < 200ms（p99）
- **DB クエリタイム**: < 50ms（p99）
- **CLI 起動時間**: < 1秒
- **Web UI ロード時間**: < 2秒

### 8.2 スケーリング
- **API**: 水平スケール（ロードバランサー）
- **DB**: 読み取り レプリケーション / キャッシング
- **UI**: CDN キャッシング

---

## 9. セキュリティ

### 9.1 認証・認可
- API キー方式（CLI ツール向け）
- JWT トークン（Web UI 向け）
- ロールベースアクセス制御（RBAC）

### 9.2 データ保護
- HTTPS / TLS
- パスワードハッシング（bcrypt）
- SQL インジェクション対策（Drizzle ORM）

### 9.3 監査ログ
- 全 API リクエスト・レスポンス記録
- ユーザーアクション記録

---

## 10. 品質保証

### 10.1 テスト戦略
- **ユニットテスト**: Jest（API / CLI）
- **統合テスト**: Supertest（API）
- **E2E テスト**: Playwright（Web UI）
- **カバレッジ**: 80%+ 目標

### 10.2 コード品質
- ESLint / Prettier
- TypeScript（strict モード）
- GitHub Actions CI/CD

---

**版履歴**

| 版 | 日付 | 変更内容 |
|---|---|---|
| v2.0 | 2026-04-03 | 基本設計確定版（Docker / ネイティブ両対応、Drizzle ORM 確定） |
| v1.0 | 2026-03-28 | 初期案（Prisma 検討） |