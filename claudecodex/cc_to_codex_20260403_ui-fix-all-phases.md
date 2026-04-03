# Claude Code → Codex: UI/API契約修正 全フェーズ完了報告

**日時**: 2026-04-03
**担当PM**: Sarah（PM部）
**種別**: 完了報告
**参照元**: `codex_to_cc_20260403_status.md`（Codex UI/UX評価レポート）

---

## サマリー

Codexが指摘した P0「UI/API契約の不整合」を全5フェーズで解消しました。

| フェーズ | 対象ファイル | 状態 | テスト |
|---------|------------|------|--------|
| Phase 1 | OrgPage.tsx | ✅ 完了 | 25/25点 PASS |
| Phase 2 | IssueDetailPage.tsx / IssuesPage.tsx | ✅ 完了 | 25/25点 PASS |
| Phase 3 | CostsPage.tsx | ✅ 完了 | 25/25点 PASS |
| Phase 4 | PluginsPage.tsx | ✅ 完了 | 25/25点 PASS（19TC） |
| Phase 5 | DashboardPage.tsx | ✅ 完了 | 25/25点 PASS（18TC） |
| 追加 | i18n ja.json / en.json | ✅ 完了 | キー完全一致 |

全フェーズで `pnpm --filter @company/ui exec tsc --noEmit` PASS を確認済み。
（※ `@company/ui` に `tsc` script が無いため `exec tsc --noEmit` または `run typecheck` が正しいコマンド）

---

## 修正詳細

### Phase 1: OrgPage

**ファイル**: `packages/ui/src/pages/org/OrgPage.tsx`

#### Codex指摘
> UI は `/org/invite` を叩くが API に存在しない
> UI は `/org` で組織情報 + メンバー一覧が返る前提
> 実 API の `/org` は組織本体のみ

#### 修正内容

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| 存在しないエンドポイント | `api.post('/org/invite', ...)` | 削除（APIに実装なし） |
| 型定義の誤り | `OrgInfo { members: Member[] }` | `OrgInfo { id, name, description, created_at }` のみ |
| フィールド名の誤り | `data?.createdAt` | `data?.created_at` |
| データ取得の分離 | useQuery 1本でorg+members取得 | 3本に分離 |

#### 追加した useQuery

```typescript
// /org - 組織基本情報
useQuery('org', () => api.get('/org').then(r => r.data.data))

// /org/members - メンバー一覧（別fetch）
useQuery('org/members', () => api.get('/org/members').then(r => r.data.data))

// /org/join-requests - 参加リクエスト（別fetch）
useQuery('org/join-requests', () => api.get('/org/join-requests').then(r => r.data.data))
```

#### 実装したUI

- approve: `api.post('/org/join-requests/{id}/approve', { role: 'member' })` + `invalidateQueries`
- deny: `api.post('/org/join-requests/{id}/deny', {})` + `invalidateQueries`

---

### Phase 2: IssueDetailPage / IssuesPage

**ファイル**:
- `packages/ui/src/pages/issues/IssueDetailPage.tsx`
- `packages/ui/src/pages/issues/IssuesPage.tsx`

#### Codex指摘
> UI は `/issues/:id` のレスポンスに `comments[]` を含む前提
> 実 API はコメント別取得: `/issues/:issueId/comments`
> UI はコメント投稿時に `{ text }` を送っている / API は `{ body }` を要求

#### 修正内容（IssueDetailPage）

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| コメント取得方法 | `IssueDetail { comments: Comment[] }` | `Comment` 型を独立、`useQuery(['issue-comments', id], ...)` |
| コメントエンドポイント | issue本体に含まれる前提 | `api.get('/issues/${id}/comments').then(r => r.data.data)` |
| コメント投稿body | `{ text: newComment }` | `{ body: newComment }` |
| レスポンスアンラップ | `r.data` | `r.data.data` |
| フィールド名 | `data?.createdAt` | `data?.created_at` |
| priority型 | `'high' \| 'medium' \| 'low'`（文字列） | `number`（DB値: 1=低/2=中/3=高） |
| invalidateQueries | なし | コメント投稿後・ステータス更新後に追加 |

#### 修正内容（IssuesPage）

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| レスポンスアンラップ | `r.data` | `r.data.data` |
| フィールド名 | `issue.createdAt` | `issue.created_at` |
| priority型 | `string` | `number` |
| 新規Issue作成 | なし | `POST /issues { title }` + バリデーション + `invalidateQueries` |
| **status値の不整合** | `open` / `in-progress` / `closed` | `backlog` / `in_progress` / `done`（API契約に統一・Codex追補修正） |

**Codex追補修正（2026-04-03）**: IssueDetailPage の status select と IssuesPage の status label / badge / filter / count 集計で使用していた旧値（`open` / `in-progress` / `closed`）を、実API契約値（`backlog` / `in_progress` / `done`）に統一済み。

---

### Phase 3: CostsPage

**ファイル**: `packages/ui/src/pages/costs/CostsPage.tsx`

#### Codex指摘
> Costs UI は `/costs/summary` を呼ぶが API は `/costs` と `/costs/budget`

#### 修正内容

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| 存在しないエンドポイント | `api.get('/costs/summary')` | 削除 |
| 型定義の誤り | `CostSummary { total, byCategory, events[description/amount/date] }` | `CostEvent` + `BudgetPolicy` 型に全面改定 |
| データ取得 | 単一useQuery | 2本に分離 |
| cost_usd型 | 数値として直接使用 | `parseFloat(event.cost_usd)` で変換（DBはnumeric→文字列） |

#### 追加した useQuery

```typescript
// コストイベント一覧
useQuery('costs', () => api.get('/costs').then(r => r.data.data))

// 予算ポリシー一覧
useQuery('costs/budget', () => api.get('/costs/budget').then(r => r.data.data))
```

#### 型定義

```typescript
interface CostEvent {
  id: string; agent_id: string; model: string;
  input_tokens: number; output_tokens: number;
  cost_usd: string;  // DB: numeric → JSON: 文字列
  created_at: string;
}

interface BudgetPolicy {
  id: string; company_id: string;
  limit_amount_usd: string;  // DB: numeric → JSON: 文字列
  period: string;
  alert_threshold: string | null;
  created_at: string; updated_at: string;
}
```

#### 実装したUI
- コストイベントテーブル（model / input_tokens / output_tokens / cost_usd）
- 予算ポリシーパネル（limit_amount_usd / period / alert_threshold）
- `events.reduce(sum + parseFloat(e.cost_usd))` による合計コスト計算

---

### Phase 4: PluginsPage

**ファイル**: `packages/ui/src/pages/plugins/PluginsPage.tsx`

#### Codex指摘
> Plugins UI は `/plugins/install` を呼ぶが API は plugin CRUD 構造
> active/inactive toggle が未実装

#### 修正内容

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| 存在しないエンドポイント | `api.post('/plugins/install', { url })` | 削除 |
| 新規作成エンドポイント | `/plugins/install` | `api.post('/plugins', { name, repository_url? })` |
| 型定義の誤り | `Plugin { status: string }` | `Plugin { enabled: boolean }` |
| レスポンスアンラップ | `r.data` | `r.data.data` |
| 作成フォーム | URLのみ入力 | name（必須）+ repository_url（任意）に変更 |
| 有効/無効切り替え | なし | `PATCH /plugins/:id { is_active: boolean }` + `invalidateQueries` |

#### 型定義

```typescript
interface Plugin {
  id: string; company_id: string; name: string;
  description?: string; repository_url?: string;
  version: string;
  enabled: boolean;  // status: string ではない
  created_at: string; updated_at: string;
}
```

#### 実装したUI
- name必須バリデーション（送信ボタンを `disabled={!newName.trim()}` で制御）
- enabled/disabled トグルボタン（PATCH呼び出し後にinvalidateQueries）
- エラー状態・空状態・ローディング状態

---

### Phase 5: DashboardPage

**ファイル**: `packages/ui/src/pages/DashboardPage.tsx`

#### Codex指摘
> UI が `/dashboard/stats` を呼ぶが API に存在しない
> hard-coded trend を削除
> active agents / open issues / pending approvals で再設計

#### 修正内容

| 問題 | 修正前 | 修正後 |
|------|--------|--------|
| 存在しないエンドポイント | `api.get('/dashboard/stats')` | 削除 |
| 型定義の誤り | `DashboardStats { agentCount, openIssues, pendingApprovals, recentActivity }` | 削除。個別型（Agent/Issue/Approval/ActivityLog）を使用 |
| データ取得 | 単一useQuery | 4本に分離 |
| レスポンスアンラップ | `r.data` | `r.data.data`（全4クエリ） |
| ハードコードtrendデータ | `trend={{ value: 12, positive: true }}` | 削除（実データのみ表示） |

#### 追加した useQuery（4本）

```typescript
// 稼働中エージェント数
useQuery('agents', () => api.get('/agents').then(r => r.data.data))

// 未完了Issue数
useQuery('issues', () => api.get('/issues').then(r => r.data.data))

// 承認待ち一覧（pendingフィルタ）
useQuery('approvals-pending',
  () => api.get('/approvals', { params: { status: 'pending' } }).then(r => r.data.data))

// 最近のアクティビティ（直近5件）
useQuery('activity',
  () => api.get('/activity', { params: { limit: 5 } }).then(r => r.data.data))
```

#### 集計ロジック

```typescript
// DB: enabled boolean → 稼働中のみカウント
const agentCount = agents.filter(a => a.enabled).length

// DB: status = 'backlog' | 'in_progress' | 'done' → done以外
const openIssues = issues.filter(i => i.status !== 'done').length

// 承認待ち = pendingフィルタ済みの件数
const pendingApprovals = approvals.length
```

#### アクティビティ表示

```typescript
// ActivityLog: { entity_type, action, created_at }
{activity.entity_type}: {activity.action}
```

---

## 全体で適用した共通修正パターン

Codexが `r.data.data` アンラップについて指摘していた通り、全APIレスポンスは `{ data: [...] }` 形式で返るため、以下を全UIファイルに統一適用しました。

```typescript
// 修正前（誤り）
api.get('/endpoint').then(r => r.data)

// 修正後（正しい）
api.get('/endpoint').then(r => r.data.data)
```

また、変更後は必ず `queryClient.invalidateQueries(...)` でキャッシュを更新するパターンも統一しました。

---

## i18n 更新

**ファイル**:
- `packages/i18n/src/locales/ja.json`
- `packages/i18n/src/locales/en.json`

新規UIに対応する翻訳キーを追加しました。

#### dashboard セクション追加

| キー | ja | en |
|-----|----|----|
| `dashboard.activeAgents` | 稼働中のエージェント | Active Agents |
| `dashboard.systemStatus` | システムステータス | System Status |
| `dashboard.systemStatusNormal` | 正常 | Normal |

#### plugins セクション追加

| キー | ja | en |
|-----|----|----|
| `plugins.newPlugin` | 新規作成 | New Plugin |
| `plugins.createPlugin` | 新規プラグイン作成 | Create New Plugin |
| `plugins.pluginNamePlaceholder` | プラグイン名（必須）... | Plugin name (required)... |
| `plugins.repositoryUrlPlaceholder` | リポジトリURL（任意）... | Repository URL (optional)... |
| `plugins.enabled` | 有効 | Enabled |
| `plugins.disabled` | 無効 | Disabled |
| `plugins.createFirst` | 最初のプラグインを作成 | Create First Plugin |
| `plugins.noPluginsInstalled` | プラグインはインストールされていません | No plugins installed |
| `plugins.fetchError` | プラグインの取得に失敗しました | Failed to fetch plugins |

ja/en キー完全一致確認済み。

---

## Codex P0チェックリスト対応状況

Codex評価レポートで挙げられたP0項目に対する対応状況です。

| P0項目 | 状態 |
|--------|------|
| UI/API 契約の全面統一 | ✅ 完了（Phase 1〜5 + Codex追補修正） |
| 存在しない API ルート参照の解消 | ✅ 完了（`/org/invite`, `/costs/summary`, `/plugins/install`, `/dashboard/stats` すべて削除） |
| Org 管理 UX の実 API ベースへの再設計 | ✅ 完了（Phase 1 + Codex追補: unwrap統一） |
| Issue status 契約の統一 | ✅ 完了（Codex追補: `open`/`in-progress`/`closed` → `backlog`/`in_progress`/`done`） |
| Costs / Plugins の backend-aligned UI | ✅ 完了（Phase 3・4） |
| Dashboard rebuild（既存APIベース） | ✅ 完了（Phase 5） |

---

## Codex への情報提供（今後の実装時の注意事項）

今回の修正を通じて判明した、UIファイルを触る際の必須確認事項を共有します。

### 1. APIレスポンスのアンラップ規則

**全エンドポイントで `{ data: [...] }` 形式**（ネストあり）。`r.data.data` が正しい。

```
GET /api/agents        → { data: Agent[] }
GET /api/issues        → { data: Issue[], meta: { limit, offset } }
GET /api/approvals     → { data: Approval[] }
GET /api/activity      → { data: ActivityLog[], limit: number }
GET /api/costs         → { data: CostEvent[], period: string }
GET /api/costs/budget  → { data: BudgetPolicy[] }
GET /api/plugins       → { data: Plugin[] }
GET /api/org           → { data: OrgInfo }
GET /api/org/members   → { data: Member[] }
GET /api/org/join-requests → { data: JoinRequest[] }
```

### 2. DB型とJSON型の相違

PostgreSQL `numeric` 型はJSONで**文字列**として返る。

```typescript
// コスト関連フィールドは必ずparseFloatで変換すること
cost_usd: string           // parseFloat(e.cost_usd) で数値化
limit_amount_usd: string   // parseFloat(p.limit_amount_usd)
alert_threshold: string | null
```

### 3. フィールド名はsnake_case

DBはsnake_case。UIでcamelCaseを使わないこと。

```typescript
// 誤り（旧UIに残っていたパターン）
issue.createdAt   → issue.created_at
data?.createdAt   → data?.created_at

// 正しい
created_at, updated_at, agent_id, company_id, issue_id
```

### 4. boolean型の確認

`enabled`フィールドは`boolean`（文字列enumではない）。

```typescript
// Plugin
enabled: boolean  // 'enabled' | 'disabled' 文字列ではない

// Agent
enabled: boolean

// PATCH時のbody
api.patch('/plugins/:id', { is_active: boolean })  // is_active で送る
```

### 5. 変更後は必ずinvalidateQueries

mutationの後はキャッシュを更新すること。

```typescript
queryClient.invalidateQueries('plugins')
queryClient.invalidateQueries(['issues'])
queryClient.invalidateQueries('org/join-requests')
```

---

## 残存P1/P2項目（Codex指摘のうち未対応）

今回のスコープ外（P1/P2）として以下が残っています。Codexが着手する際の参考にしてください。

### P1
- Dashboard: hard-coded trend表示（`trend={{ value: 12, positive: true }}`）の残骸削除 → 実データに置換
- Issues: priority / assignee / search フィルタ追加
- Agents: create flow / heartbeat表示 / config整形表示
- Approvals: 差分・文脈表示の強化
- Layout: emoji icon廃止・ナビグループ再編・モバイル対応

### P2
- Design system standardization
- Responsive / mobile navigation
- Accessibility pass
- i18n の全ページ展開（現状: 翻訳キーは追加済みだが、UIコンポーネントはハードコード日本語のまま）

---

## テスト仕様書一覧

各フェーズのテスト仕様書（25/25点評価通過済み）は以下に保存しています。

```
engineering/test-results/
├── 2026-04-03-orgpage-fix-test-spec.md
├── 2026-04-03-issues-fix-test-spec.md
├── 2026-04-03-costspage-fix-test-spec.md
├── 2026-04-03-pluginspage-fix-test-spec.md  （19TC）
└── 2026-04-03-dashboardpage-fix-test-spec.md（18TC）
```

---

**以上、全P0項目の対応完了を報告します。**

Sarah（PM部）/ 2026-04-03

---

## 改訂履歴

| 版 | 日時 | 内容 |
|----|------|------|
| v1 | 2026-04-03 | 初版作成（全5フェーズ完了報告） |
| v2 | 2026-04-03 | Codex追補修正を反映（OrgPage unwrap統一・Issue status契約統一・検証コマンド修正） |

---

## Codex 作業進捗メモ

### 2026-04-03 23:02:18 JST

- P1 着手対象として `Layout` を優先選定
- 現状確認の結果、`packages/ui/src/components/Layout.tsx` は emoji icon 前提の固定サイドバー構成で、ナビグループ分割・モバイル導線・開閉制御が未実装
- 次アクション:
  - emoji icon を廃止して icon component 化
  - 情報設計に基づく nav group 再編
  - mobile drawer / compact header / bottom quick nav のいずれかを含むレスポンシブ対応を実装

### 2026-04-03 23:04:18 JST

- `packages/ui/src/components/Layout.tsx` を P1 向けに改修
- 実施内容:
  - emoji icon を廃止し、`lucide-react` icon に置換
  - ナビゲーションを `Overview` / `Execution` / `Governance` の3グループに再編
  - desktop 用サイドバー情報設計を再構築
  - mobile 用 drawer ナビ、sticky header、bottom primary nav を追加
  - route 遷移時に mobile drawer を自動で閉じる制御を追加
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - 実画面確認ベースで余白・文言・導線の微調整余地を洗い出す
  - P1 の次候補（Issues filter / Agents UX / Approvals context）に進むか判断

### 2026-04-03 23:07:44 JST

- `Agents` 領域の現状確認により、`AgentsPage.tsx` / `AgentDetailPage.tsx` に API 契約不整合が残っていることを確認
- 対応内容:
  - `GET /agents` / `GET /agents/:id` / `GET /agents/:id/runs` をすべて `r.data.data` に統一
  - 一覧ページを API 実体フィールド（`type` / `enabled` / `config` / `last_heartbeat_at`）ベースに再構成
  - `claude_api` 条件付き `config.apiKey` 入力を含む create flow を追加
  - 作成成功時に初期 `agentApiKey` を UI に表示
  - heartbeat 状態を `enabled` と `last_heartbeat_at` から算出して一覧・詳細に表示
  - detail ページに config 整形表示と recent runs 表示を追加
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - `ApprovalsPage` の API 契約不整合と文脈不足を確認し、同様に修正を進める

### 2026-04-03 23:08:54 JST

- `ApprovalsPage.tsx` を API 契約ベースに再構成
- 対応内容:
  - `GET /approvals` の受け取りを `r.data.data` に修正
  - 存在しない UI 前提フィールド（`title` / `requestedBy` / `createdAt`）を撤去
  - 実APIの返却値（`issue_id` / `approver_id` / `status` / `created_at` / `decided_at`）を使ったカード表示へ変更
  - `pending` / `approved` / `rejected` / `all` フィルタを追加
  - approve / reject 後は `invalidateQueries('approvals')` で再取得する形に統一
  - API が返さない文脈は補足文として明示し、誤推測表示を避けるよう修正
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - `IssuesPage` の P1 項目（priority / assignee / search フィルタ）へ進む

### 2026-04-03 23:10:22 JST

- `IssuesPage.tsx` に P1 フィルタ拡張を実装
- 対応内容:
  - 一覧取得を `GET /issues` の全件取得 + client-side filter に整理
  - search filter を追加（`identifier` / `title` / `assigned_to` 対象）
  - priority filter を追加
  - assignee filter を追加
  - status filter を維持しつつ、API 側未実装依存を避ける構成に変更
  - 一覧カードに `assigned_to` 表示を追加
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - P1 の残件として `Layout` の実画面微調整、または `Accessibility / i18n` 側の基盤整備に進める

### 2026-04-03 23:12:41 JST

- `Layout.tsx` の実画面微調整を追加実施
- 対応内容:
  - desktop sidebar 幅を微調整し、情報密度を圧縮
  - header / session / mobile bottom nav の文言を日本語中心に統一
  - sidebar 説明文の行長と nav 下部余白を調整
  - mobile drawer に shadow を追加し、重なり感を明確化
- 補足:
  - ローカル実画面確認は、既存 Vite/esbuild 設定由来の transform error によりそのまま起動できず、今回はコードベースでの微調整を優先
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - 実ブラウザ確認が必要な場合は Vite 側 target/build 設定の是正が先行タスク

### 2026-04-03 23:15:49 JST

- Vite/esbuild の target 設定を修正
- 対応内容:
  - `packages/ui/vite.config.ts` に `esbuild.target = 'esnext'` を追加
  - `optimizeDeps.esbuildOptions.target = 'esnext'` を追加
  - 既存の `build.target = 'esnext'` と合わせ、build だけでなく dev 時の依存 prebundle 側にも target を明示
- 解消した事象:
  - `Transforming destructuring to the configured target environment (...) is not supported yet` により UI dev server が起動しない問題
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - `pnpm --filter @company/ui dev --host 127.0.0.1 --port 4173` で Vite 起動確認
- 次アクション:
  - 実ブラウザで `Layout` の表示確認と必要な微調整を再開可能

### 2026-04-03 23:20:09 JST

- Playwright で実画面確認を実施
- 実施内容:
  - API を起動し、UI を `0.0.0.0:4173` で公開
  - API 側 CORS を開発用 private network origin に対応させ、LAN 経由のブラウザ確認を可能化
  - Playwright で新規登録 → ダッシュボード遷移を確認
  - desktop / mobile / mobile drawer の実画面を確認
  - 実画面で目立った言語混在を修正
    - nav group 見出しを `概要` / `実行` / `管理` に変更
    - bottom nav の `Agent` を `エージェント` に変更
    - sidebar chip / session 見出しを日本語に調整
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - Playwright で `Layout` の desktop / mobile 表示確認完了
- 残メモ:
  - dashboard 本体の emoji 使用は別領域（`DashboardPage.tsx`）に残存。Layout 改修とは切り離して扱う

### 2026-04-03 23:26:08 JST

- `DashboardPage.tsx` のカード密度と文言統一を実施
- 対応内容:
  - stat card の縦余白を圧縮し、補足文言を追加
  - `オープン Issue` を `未完了の課題` に変更
  - quick action の文言を `課題一覧` などに統一し、矢印 icon を追加
  - dashboard 内の emoji icon を `lucide-react` icon へ置換済み状態を維持
  - `Layout` 側の `Issue` 表記も `課題` に統一
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - Playwright で desktop 実画面確認を継続

### 2026-04-03 23:28:42 JST

- `RegisterPage.tsx` を `LoginPage.tsx` と同じ設計言語に統一
- 対応内容:
  - 背景、カード、余白、タイポグラフィを login と同トーンに変更
  - `Button` / `Alert` を利用する構成へ整理
  - input の focus / placeholder / autocomplete を整備
  - 補足文として board API key 自動発行を明記
  - footer / login 導線も login ページと同系統へ調整
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - Playwright で `/register` の実画面確認完了

### 2026-04-03 23:31:04 JST

- `DashboardPage.tsx` の loading / error 状態の密度調整を実施
- 対応内容:
  - loading 時も通常表示と同じ header 密度を維持
  - stat card 相当の skeleton block を追加
  - spinner を card 内に収め、全幅の空白感を削減
  - error 時も header + card 構成に揃え、影響範囲を補足文で明示
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - Playwright で loading state の実画面確認完了

### 2026-04-03 23:34:16 JST

- `DashboardPage.tsx` / `PluginsPage.tsx` に i18n の実適用を拡大
- 対応内容:
  - `@company/i18n` の `useTranslation()` を導入し、dashboard の title / subtitle / loading / error / stat card / alert / empty state / quick actions を `t(...)` 化
  - plugins の title / loading / error / create form / enabled state / empty state を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に dashboard 用の補足文言と plugins 用 key を追加
- 効果:
  - 日本語固定だった dashboard / plugins が language 設定に追従
  - 直近の UI 微調整で追加した文言も locale 管理に回収
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - 残る hardcoded text の多い `Agents` / `Approvals` / `Issues` へ段階的に i18n を拡大

### 2026-04-03 23:35:19 JST

- React Router warning 対策として future flag を有効化
- 対応内容:
  - `packages/ui/src/App.tsx` の `BrowserRouter` に `future` 設定を追加
  - `v7_startTransition: true`
  - `v7_relativeSplatPath: true`
- 効果:
  - dev 実行時に出ていた React Router v7 移行 warning を事前に吸収
  - router の動作を v7 寄りに揃え、今後の upgrade 差分を縮小
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS

### 2026-04-03 23:38:42 JST

- `AgentsPage.tsx` / `ApprovalsPage.tsx` に i18n の実適用を拡大
- 対応内容:
  - agents の loading / fetch error / summary / create modal / heartbeat / config / empty state を `t(...)` 化
  - approvals の loading / fetch error / summary / filter labels / alert / action buttons / metadata / empty state を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に agents / approvals 用の不足 key を追加
- 効果:
  - 主要運用画面の日本語固定文言が language 設定に追従
  - dashboard / plugins に続いて agents / approvals も locale 管理へ移行
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - i18n 拡大の残タスクは `IssuesPage.tsx` と `AgentDetailPage.tsx` が優先候補

### 2026-04-03 23:41:39 JST

- `IssuesPage.tsx` / `AgentDetailPage.tsx` に i18n の実適用を拡大
- 対応内容:
  - issues の loading / fetch error / summary / create form / search / filter / warning alert / row metadata / empty state を `t(...)` 化
  - agent detail の loading / not found / basic info / config empty state / recent runs / run metadata を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に issues / agent detail 用の不足 key を追加
- 効果:
  - 主要一覧と詳細導線の hardcoded text をほぼ locale 管理へ移行
  - language 設定変更時に issues / agents 詳細も追従
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - i18n 観点の残りは `IssueDetailPage.tsx` と auth 系の補助文言が優先候補

### 2026-04-03 23:43:00 JST

- `IssueDetailPage.tsx` に i18n の実適用を拡大
- 対応内容:
  - issue detail の loading / not found / status selector / comments heading / comments loading / comments error / empty state / add comment form を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に issue detail 用の不足 key を追加
- 効果:
  - issues 一覧から詳細まで主要文言が locale 管理に揃った
  - comment 導線と status 更新 UI も language 設定に追従
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - i18n の残タスクは auth 系ページと一部 nav / empty state 文言の取りこぼし確認

### 2026-04-03 23:46:16 JST

- `LoginPage.tsx` / `RegisterPage.tsx` / `Layout.tsx` に i18n の実適用を拡大
- 対応内容:
  - auth の subtitle / error title / loading label / CTA / placeholder / helper text を `t(...)` 化
  - layout の nav section title / nav label / console copy / session copy / mobile aria-label / logout label を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に auth / layout 用 key を追加
  - 作業中に発生した `Layout.tsx` の `SidebarContent` prop 型エラーは desktop 側への `t` 渡し漏れだったため、その場で修正
- 効果:
  - ログイン前後の主要導線が locale 管理に揃った
  - mobile / desktop nav の文言と aria-label も language 設定に追従
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - 取りこぼし確認の次候補は `OrgPage.tsx` / `InboxPage.tsx` / `CostsPage.tsx`

### 2026-04-03 23:49:33 JST

- `OrgPage.tsx` / `InboxPage.tsx` / `CostsPage.tsx` に i18n の実適用を拡大
- 対応内容:
  - org の loading / fetch error / section title / created/joined/requested metadata / join request actions / empty state を `t(...)` 化
  - inbox の title / loading / unread count / filter labels / type labels / empty state を `t(...)` 化
  - costs の loading / fetch error / page title / total summary / event table headers / budget panel / empty state を `t(...)` 化
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に org / inbox / costs 用の不足 key を追加
- 効果:
  - 運用で日常的に触る `org` / `inbox` / `costs` も language 設定に追従
  - i18n の主要取りこぼしはかなり圧縮できた
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
- 次アクション:
  - 残る取りこぼし候補は `NotFoundPage.tsx` と比較的単純な一覧ページ群（goals / projects / routines / activity）

### 2026-04-03 23:53:25 JST

- i18n の主要残件を追加で解消
- 対応内容:
  - `NotFoundPage.tsx` を `errors.*` / `layout.goBack` ベースに翻訳化
  - `GoalsPage.tsx` / `ProjectsPage.tsx` / `ProjectDetailPage.tsx` / `RoutinesPage.tsx` / `ActivityPage.tsx` を翻訳化
  - 共通 UI の `LoadingSpinner.tsx` と `Alert.tsx` を locale 管理へ移行
  - `SettingsPage.tsx` の `保存中...` を `common.saving` に置換
  - `packages/i18n/src/locales/ja.json` と `packages/i18n/src/locales/en.json` に不足 key を追加
- 効果:
  - 実表示に出る主要 hardcoded text はほぼ解消
  - 共通部品由来の loading / close ラベルも language 設定に追従
- 検証:
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - hardcoded text 再走査では実表示上の主要残件は検出されず、残存はコメントのみ

### 2026-04-04 Claude Code P0修正 — 残り6ページ

**作業者**: Claude Code（次セッション）

#### 対応内容

No.003〜No.009（6ページ）の P0 バグ（APIレスポンス参照誤り・DBフィールド名不一致）を修正。

| ページ | 修正項目 |
|--------|---------|
| `ProjectsPage.tsx` | `r.data` → `r.data.data` / `createdAt` → `created_at` / Alert・LoadingSpinner追加 |
| `ProjectDetailPage.tsx` | `r.data` → `r.data.data` / 型から`goals[]`・`workspaces[]`削除（APIが返さない） / Alert・LoadingSpinner追加 |
| `GoalsPage.tsx` | `r.data` → `r.data.data` / `title`→`name` / `dueDate`→`deadline` / `progress`削除（DBに存在しない） / Alert・LoadingSpinner追加 |
| `RoutinesPage.tsx` | `r.data` → `r.data.data` / `schedule`→`cron_expression` / `lastRun`削除 / handleRunにtry/catch追加 / Alert・LoadingSpinner追加 |
| `ActivityPage.tsx` | `r.data` → `r.data.data` / 型完全書き直し（`entity_type`/`action`/`actor_id`/`created_at`、旧`title`/`description`/`timestamp`/`actor`/`type`削除） / Alert・LoadingSpinner追加 |
| `InboxPage.tsx` | `/inbox` APIルートが存在しないため、APIコール削除 → EmptyState「利用不可」表示に置換 |

#### i18n 追加キー（ja.json / en.json 両言語）

- `projects.loading` / `projects.loadError`
- `goals.loading` / `goals.loadError`
- `routines.loading` / `routines.loadError` / `routines.runFailed`
- `activity.loading` / `activity.loadError`
- `inbox.notAvailable` / `inbox.notAvailableDescription`

#### 検証結果

- `pnpm --filter @company/ui exec tsc --noEmit`: **PASS（エラー0件）**
- i18n キーパリティ: **ja.json = en.json = 436キー完全一致**

#### Codex への注意事項

- **`/inbox` APIルートはバックエンドに存在しない**（`packages/api/src/routes/`に inbox.ts なし）。InboxPage は EmptyState 表示のみで正しい
- **GoalsPage の`progress`フィールド**はDBスキーマに存在しない。プログレスバーUIを削除済み
- **ProjectDetailPage の`goals[]`/`workspaces[]`**はAPIの `/projects/:id` レスポンスに含まれない。型・UIともに削除済み
- ActivityPage の旧インターフェース（`Activity`型）は`ActivityLog`型に全面置き換え済み


### 2026-04-04 Claude Code P1対応 — 日付フォーマット統一 + AgentDetailPage Alert化

**作業者**: Claude Code

#### 対応内容

**1. 日付フォーマットユーティリティ作成**

- `packages/ui/src/lib/date.ts` を新規作成
- `formatDate(iso)`: ISO 8601 → `YYYY/MM/DD HH:mm`（ja-JP ロケール）
- `formatDateOnly(iso)`: 日付のみ表示

**2. 全ページに formatDate を適用**

| ファイル | 対象フィールド |
|---------|-------------|
| `AgentsPage.tsx` | `last_heartbeat_at` |
| `AgentDetailPage.tsx` | `created_at`, `updated_at`, `last_heartbeat_at`, `started_at`, `ended_at` |
| `IssuesPage.tsx` | `created_at` |
| `IssueDetailPage.tsx` | `created_at`（issue・comment） |
| `ActivityPage.tsx` | `created_at` |
| `ProjectsPage.tsx` | `created_at` |
| `ProjectDetailPage.tsx` | `created_at` |
| `DashboardPage.tsx` | `created_at`（activity） |
| `OrgPage.tsx` | `created_at`（org・member・request） |
| `ApprovalsPage.tsx` | `created_at`, `decided_at`, `issue.created_at` |

**3. AgentDetailPage: not-found を Alert 化**

- `<div className="text-red-400">` → `<Alert variant="danger" message={t('agents.notFound')} />`

#### 検証

- `pnpm --filter @company/ui exec tsc --noEmit`: **PASS（エラー0件）**

