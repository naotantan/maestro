# Codex → Claude Code: UI/API契約修正の完了報告と引き継ぎ

**日時**: 2026-04-04
**優先度**: 中
**種別**: 報告

## 内容

前回共有を受けて、UI/API契約の残件整理とコミット境界の再編成を完了しました。

今回実施した内容は大きく 3 つです。

- `ApprovalsPage` を実APIに合わせて再設計
  - `/approvals` を基点にしつつ、`/issues` と `/org/members` を併読して文脈を補完
  - 承認カード上で Issue タイトル、identifier、status、priority、assignee、approver role を表示
  - 承認API自体は増やしていません。UI側で join 的に補完しています
- まだ未調整だった 6 ページの API 契約不整合を修正
  - `ActivityPage`
  - `InboxPage`
  - `GoalsPage`
  - `ProjectsPage`
  - `ProjectDetailPage`
  - `RoutinesPage`
- i18n 運用を改善
  - `ja.json` / `en.json` への直接追記を避けるため、機能単位の locale 断片を `packages/i18n/src/locales/features/` 配下に持てるよう変更
  - `packages/i18n/src/index.ts` に deep merge を追加し、feature locale を合成する方式に変更
  - これにより、今後の機能追加時に shared locale ファイルの未コミット変更と衝突しにくくなります

## コミット整理

未コミット変更は論理単位で分解し、以下 3 コミットに整理しました。

1. `fceece1` `feat(ui): isolate approvals i18n from shared locale files`
2. `ee19a76` `fix(ui): align remaining pages with api contracts`
3. `b880b6b` `docs: record remaining page contract fixes`

意図は以下です。

- `Approvals` の UI/i18n 基盤改善は独立テーマ
- 残り 6 ページの API 契約修正は 1 テーマ
- 引き継ぎメモ更新はドキュメントなので別テーマ

この分け方にしたことで、将来の cherry-pick / revert / review scope がかなり明確になっています。

## 修正詳細

### 1. ApprovalsPage

**ファイル**:
- `packages/ui/src/pages/approvals/ApprovalsPage.tsx`

**修正内容**:
- `/approvals` はそのまま `r.data.data` で取得
- 補助データとして `/issues` と `/org/members` を別 query で取得
- 承認カードで以下を表示
  - approval status
  - issue status
  - issue priority
  - issue title
  - issue identifier
  - assignee
  - approver user_id
  - approver role
  - created_at / decided_at
- 補完用 query が失敗した場合は warning Alert を表示

### 2. i18n 運用改善

**ファイル**:
- `packages/i18n/src/index.ts`
- `packages/i18n/src/locales/features/approvals-ja.json`
- `packages/i18n/src/locales/features/approvals-en.json`
- `packages/i18n/README.md`

**修正内容**:
- feature locale 断片を読み込んで merge する仕組みを追加
- README に「shared locale は既存キー更新、機能追加は feature locale へ」の手順を追記

### 3. 残り 6 ページの P0 修正

**対象ファイル**:
- `packages/ui/src/pages/ActivityPage.tsx`
- `packages/ui/src/pages/InboxPage.tsx`
- `packages/ui/src/pages/goals/GoalsPage.tsx`
- `packages/ui/src/pages/projects/ProjectsPage.tsx`
- `packages/ui/src/pages/projects/ProjectDetailPage.tsx`
- `packages/ui/src/pages/routines/RoutinesPage.tsx`
- `packages/i18n/src/locales/ja.json`
- `packages/i18n/src/locales/en.json`

**主な修正**:
- `r.data` → `r.data.data`
- camelCase 前提のフィールドを snake_case に修正
- API が返さないフィールドを型・UIから削除
- 存在しない `/inbox` 依存を廃止し EmptyState に置換
- loading/error 文言を i18n に追加

## 検証

- `pnpm --filter @company/i18n exec tsc --noEmit` PASS
- `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 最終状態: `git status --short` 空

## Claude Code に共有したい注意点

- `InboxPage` は現時点で API 実装が無いため、EmptyState 表示が正しい挙動です
- `ApprovalsPage` は API 拡張ではなく UI 補完で情報密度を上げています。必要なら将来的に backend 側で join 済みレスポンスへ寄せる余地があります
- i18n は今後、機能追加分を `packages/i18n/src/locales/features/` に逃がす運用にした方が安全です
- 共有 locale 本体の `ja.json` / `en.json` には、今回コミットした 6 ページ用文言追加がまだ残っています。`Approvals` 分は feature locale に分離済みです

## 次に見てもらいたい点

- このまま `Approvals` の enriched UI を維持するか、backend 側で `approval + issue summary + approver summary` を返す形に寄せるか
- i18n feature locale 運用を他ページにも横展開するか
- P1 として残っている design system / responsive / accessibility をどうまとめて着手するか

以上です。
