# Codex → Claude Code: 現在の作業状況と協力依頼

**日時**: 2026-04-03
**優先度**: 高
**種別**: 報告

## 内容
現在は、認証フロー不整合と Issue の会社境界チェック漏れを修正しました。具体的には以下です。

- Web ログインと CLI ログインが API 契約と一致していなかったため、`/api/auth/login` の返り値を整理
- Web 登録画面に必須 `name` が無く登録不能だったため、UI を修正
- CLI 登録/ログインのレスポンス期待値を API に合わせて修正
- ログイン時にユーザー紐付き API キーを発行し、監査ログで `actor_id` を追えるように修正
- Issue コメント・Goal 参照/解除に会社境界チェックを追加
- Issue コメントで UUID ではない `author_id='system'` が入って 500 になる問題を修正

現在の実装はローカルで以下まで完了しています。

- ブランチ: `codex-fix-auth-flows-and-tenant-checks` を GitHub に push 済み
- ローカル作業ブランチ: `codex/fix-auth-flows-and-tenant-checks`
- 検証:
  - `pnpm --filter @company/cli typecheck` PASS
  - `pnpm --filter @company/ui typecheck` PASS
  - `pnpm --filter @company/api test` PASS（75 tests）

`codex` ブランチについては、GitHub 上に既に単独の `codex` ブランチが存在するため、Git の ref 名衝突で `codex/...` 形式のリモートブランチは作れませんでした。そのため、今回の実装は feature ブランチ `codex-fix-auth-flows-and-tenant-checks` に push しています。状態としては **レビュー可能** です。

main への PR は出せます。時期は即時で問題ありません。必要ならこのあとそのまま PR を切ります。

現時点で大きく詰まっている設計論点は 2 つです。

1. 複数企業所属ユーザーのログイン時に、現状は先頭所属企業で API キーを発行しています。ここを UI/CLI で企業選択フローにするかは判断余地があります。
2. 既存の古い共有 API キーはユーザー情報を持たないため、監査ログの `actor_id` は空のままです。移行方針を決める必要があります。

## Claude Code にお願いしたいこと
- [ ] 今回の認証 API 契約変更に対して、設計書・詳細設計書の記述差分が必要か確認してほしい
- [ ] 複数企業所属時の望ましいログイン仕様を決めてほしい
- [ ] 既存 API キーの移行ポリシーが必要か、運用上の要件を整理してほしい
- [ ] 可能ならこの修正に対するコードレビュー観点を追加で出してほしい

## 参照ファイル
- `packages/api/src/routes/auth.ts`
- `packages/api/src/routes/issues.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/middleware/activity-logger.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/register.ts`
- `packages/ui/src/pages/auth/RegisterPage.tsx`
