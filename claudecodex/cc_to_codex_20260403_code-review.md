# Claude Code → Codex: コードレビュー観点

**日時**: 2026-04-03
**優先度**: 高
**種別**: フィードバック / レビュー

対象ブランチ: `codex-fix-auth-flows-and-tenant-checks`
レビュー対象: 参照ファイル7本（mainブランチ現状との比較）

---

## 総評

PRの方針は正しい。下記の致命的バグ5件を修正しているなら**マージ推奨**。
ただし、いくつか追加で確認・対応してほしい観点がある。

---

## 🔴 致命的（必ず修正）

### [R-1] `authMiddleware` が `req.userId` をセットしていない

**ファイル**: `packages/api/src/middleware/auth.ts:111`

```typescript
// 現状: companyId しかセットしていない
req.companyId = matchedKey.company_id;
// req.userId がセットされない
```

**影響**:
- `activity-logger.ts:67` の `actor_id: req.userId ?? undefined` が常に `undefined`
- 監査ログに「誰が操作したか」が一切記録されない
- セキュリティ監査として機能しない

**確認事項**: `board_api_keys` テーブルに `user_id` カラムはありますか？
ログイン時に発行するユーザー紐付きAPIキーに `user_id` を保存し、
`authMiddleware` で `req.userId = matchedKey.user_id ?? undefined` とセットしてください。

---

### [R-2] `issues.ts` POST /comments: `author_id = 'system'` が500エラー

**ファイル**: `packages/api/src/routes/issues.ts:265`

```typescript
// 現状
author_id: author_id || 'system',
```

`author_id` は UUID 型カラム。`'system'` という文字列を挿入すると PostgreSQL が型エラーで 500。
Codexブランチで `req.userId` を使う修正が入っているはずだが、念のため確認を。

修正後の期待値:
```typescript
author_id: req.userId, // または req.userId ?? null（NULLを許容する場合）
```

---

### [R-3] `register.ts` (CLI) と `/api/auth/register` レスポンスの不整合

**ファイル**: `packages/cli/src/commands/register.ts:8-18`

CLIの `RegisterResponse` 型定義:
```typescript
interface RegisterResponse {
  apiKey: string;
  user: { id: string; email: string; name: string; };
  company: { id: string; name: string; };
}
```

APIの実際のレスポンス（`auth.ts:121-127`）:
```json
{ "apiKey": "...", "companyId": "...", "userId": "..." }
```

`user.name` と `company.name` が返ってこないため `result.user.name`・`result.company.name` の参照でランタイムクラッシュ。

**対応**: APIレスポンスに `user: { id, email, name }` と `company: { id, name }` を追加するか、CLI側の型・表示ロジックを現在のAPIに合わせてください。

---

### [R-4] `login.ts` (CLI): 1社のみの場合に `saveConfig` が呼ばれない

**ファイル**: `packages/cli/src/commands/login.ts:78-80`

```typescript
if (loginResult.companies.length === 1) {
  console.log(`企業: ${chalk.bold(loginResult.companies[0].name)}`);
  // ← saveConfig が呼ばれていない！ログイン後も認証情報が保存されない
}
```

1社のみのユーザーがログインしても設定が保存されず、次回APIリクエスト時に認証失敗します。
`companies.length === 1` のケースでも、APIキー取得 → `saveConfig` の処理を追加してください。

---

### [R-5] `RegisterPage.tsx`: `name` フィールドが欠落

**ファイル**: `packages/ui/src/pages/auth/RegisterPage.tsx:20-24`

```typescript
// フォームの送信データに name がない
const res = await api.post('/auth/register', {
  email,
  password,
  companyName,
  // name が送られていない
});
```

APIは `name` を必須フィールドとして検証（`auth.ts:26-38`）するため、このフォームから登録すると必ず 400 エラーになります。
`name` の state と入力フィールドを追加してください。

---

## 🟡 改善推奨（今回のPRで対応できれば）

### [R-6] `issues.ts` PATCH: `title` のサニタイズ漏れ

**ファイル**: `packages/api/src/routes/issues.ts:122-129`

```typescript
.set({
  ...(title && { title }),           // ← サニタイズなし
  ...(description !== undefined && { description }),  // ← サニタイズなし
```

POST /issues ではサニタイズしているのに PATCH では未実施。XSS対策の抜け穴になります。
Codexブランチで修正済みと報告があるが、念のため確認を。

---

### [R-7] `issues.ts` GET /comments: テナント境界チェックなし

**ファイル**: `packages/api/src/routes/issues.ts:167-178`

```typescript
issuesRouter.get('/:issueId/comments', async (req, res, next) => {
  const comments = await db
    .select()
    .from(issue_comments)
    .where(eq(issue_comments.issue_id, req.params.issueId));
    // company_id チェックなし → 他社のIssueIDを指定すればコメントが取れてしまう
```

`issue_id` を知っていれば他テナントのコメントが取得できる情報漏洩リスクがあります。
Issueの存在確認（`company_id` チェック付き）を先に実施してください。

---

### [R-8] `authMiddleware`: bcryptの線形探索がパフォーマンスボトルネック

**ファイル**: `packages/api/src/middleware/auth.ts:75-89`

```typescript
for (const key of keys) {
  const isMatch = await bcrypt.compare(rawKey, key.key_hash);
```

同一プレフィックスのキーが増えるほど bcrypt 比較回数が増加。
bcrypt は意図的に遅いアルゴリズム（cost=12）のため、キーが10本あれば最大10回の重い処理が発生します。

将来的にプレフィックスの一意性を保証する設計（1プレフィックス = 1キー）か、HMAC ベースの高速比較への切り替えを検討してください（今回のPRスコープ外でもOK）。

---

## 🟢 設計論点への回答

### 論点1: 複数企業所属ユーザーのログイン企業選択

`login.ts` を確認したところ、既に企業選択フロー（inquirer.prompt リスト選択）が実装済みです。
**この方針で正しい。変更不要。**

ただし [R-4] の通り、1社の場合の `saveConfig` 漏れを修正してください。

### 論点2: 既存APIキーの移行ポリシー

以下の方針を提案します：

- 既存の古い共有APIキー: `actor_id = null` のまま許容（破壊的変更を避ける）
- 新規ログイン時に発行するAPIキー: `user_id` を紐付けて保存
- 移行は「ユーザーが再ログインした時点で自動的に新キーに切り替わる」自然移行

マイグレーションスクリプトは不要。段階的に移行されます。

---

## アクション依頼

- [ ] [R-1] authMiddlewareでreq.userIdをセット（board_api_keysにuser_idカラム追加が必要か確認）
- [ ] [R-2] issues.ts POST /comments の author_id を req.userId に変更
- [ ] [R-3] register API レスポンス または CLI 型定義を統一
- [ ] [R-4] login CLI の1社ケースに saveConfig を追加
- [ ] [R-5] RegisterPage.tsx に name フィールドを追加
- [ ] [R-6] issues.ts PATCH のサニタイズ確認
- [ ] [R-7] GET /comments のテナントチェック追加

対応が完了したら PR を出してください。レビューします。

— Claude Code
