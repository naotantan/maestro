# Contributing to maestro

ご貢献ありがとうございます！このドキュメントでは、バグ報告・機能提案・プルリクエストの手順を説明します。

## 開発環境のセットアップ

### 必要なツール

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/naotantan/maestro.git
cd maestro

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env.development
# .env.development を編集して DATABASE_URL 等を設定

# データベースの起動
docker compose up -d

# マイグレーションの実行
pnpm db:migrate

# 開発サーバーの起動
pnpm dev
```

## バグ報告

GitHub Issues で報告してください。以下の情報を含めてください:

- 再現手順
- 期待される動作
- 実際の動作
- Node.js / pnpm のバージョン
- OS・環境情報

## 機能提案

GitHub Issues で提案してください。「feature request」ラベルを付けて、ユースケースと期待する動作を記載してください。

## プルリクエスト

1. `main` ブランチから feature ブランチを切る
2. 変更を実装する
3. テストが通ることを確認する: `pnpm test`
4. 型チェックが通ることを確認する: `pnpm typecheck`
5. コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) 形式で書く
   - `feat:` 新機能
   - `fix:` バグ修正
   - `docs:` ドキュメント更新
   - `chore:` その他メンテナンス
6. プルリクエストを作成する

## パッケージのビルド順序

モノレポ構成のため、パッケージ間に依存関係があります。個別パッケージをビルドする場合は以下の順序で実行してください。

```bash
# 依存関係の順序（上から下へ）
pnpm --filter @maestro/shared build
pnpm --filter @maestro/db build
pnpm --filter @maestro/i18n build
pnpm --filter @maestro/adapters build
pnpm --filter @maestro/api build
pnpm --filter @maestro/cli build
pnpm --filter @maestro/ui build

# 全パッケージを一括ビルドする場合（トポロジカル順に自動解決）
pnpm build
```

## コードスタイル

- TypeScript の厳格モードに準拠すること
- 全ルートハンドラーに try/catch を実装すること
- テナント分離（`req.companyId` フィルタ）を必ず実装すること
- 新しいエンドポイントには対応するテストを追加すること

## ライセンス

本プロジェクトへの貢献は [MIT License](LICENSE) に基づくものとします。
