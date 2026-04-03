# .company CLI 詳細設計書 Part3 — UI設計 + i18n + テスト仕様（W3）

**作成日**: 2026-04-03
**担当**: 開発部 第2課（Yena）× 第3課（Lucas）× 第4課（Hana）
**版**: v2.0
**ステータス**: 詳細設計確定版

> **参照ドキュメント**
> - W1: `/Users/naoto/Downloads/.company/consulting/reviews/2026-04-03-company-cli-requirements.md`
> - W2: `/Users/naoto/Downloads/.company/engineering/docs/2026-04-03-company-cli-basic-design.md`

---

## 1. UIコンポーネント詳細設計（40画面）

### 1.1 packages/ui/ ディレクトリ構造

```
packages/ui/
├── vite.config.ts
├── tsconfig.json
├── package.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── common/
│   │   │   ├── SideNav.tsx              ← ナビゲーションサイドバー
│   │   │   ├── Header.tsx               ← ヘッダー（言語切替含む）
│   │   │   ├── PageWrapper.tsx          ← ページレイアウト（breadcrumb含む）
│   │   │   ├── Breadcrumb.tsx
│   │   │   ├── Loader.tsx               ← ローディング表示
│   │   │   ├── ErrorBoundary.tsx        ← エラーハンドリング
│   │   │   └── Modal.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx            ← 認証画面群（認証フロー用）
│   │   │   ├── SetupForm.tsx
│   │   │   ├── AuthSettings.tsx
│   │   │   └── BoardClaimForm.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx            ← ダッシュボード（1画面）
│   │   │   └── MetricsCard.tsx          ← メトリクス表示コンポーネント
│   │   ├── agents/
│   │   │   ├── AgentList.tsx            ← エージェント管理（5画面）
│   │   │   ├── AgentDetail.tsx
│   │   │   ├── AgentCreate.tsx
│   │   │   ├── AgentSettings.tsx
│   │   │   ├── AgentLogs.tsx
│   │   │   └── AgentStatusBadge.tsx
│   │   ├── issues/
│   │   │   ├── IssueBoard.tsx           ← Issue管理（5画面）
│   │   │   ├── IssueDetail.tsx
│   │   │   ├── IssueCreate.tsx
│   │   │   ├── IssueEdit.tsx
│   │   │   ├── IssueHistory.tsx
│   │   │   ├── IssueCard.tsx
│   │   │   └── IssueStatusBadge.tsx
│   │   ├── skills/
│   │   │   ├── SkillList.tsx            ← スキル管理（4画面）
│   │   │   ├── SkillDetail.tsx
│   │   │   ├── SkillCreate.tsx
│   │   │   ├── SkillEdit.tsx
│   │   │   └── SkillCard.tsx
│   │   ├── goals/
│   │   │   ├── GoalList.tsx             ← ゴール管理（4画面）
│   │   │   ├── GoalDetail.tsx
│   │   │   ├── GoalCreate.tsx
│   │   │   ├── GoalEdit.tsx
│   │   │   └── GoalProgress.tsx
│   │   ├── routines/
│   │   │   ├── RoutineList.tsx          ← ルーティン管理（3画面）
│   │   │   ├── RoutineDetail.tsx
│   │   │   ├── RoutineCreate.tsx
│   │   │   └── RoutineCard.tsx
│   │   ├── approvals/
│   │   │   ├── ApprovalQueue.tsx        ← 承認管理（3画面）
│   │   │   ├── ApprovalDetail.tsx
│   │   │   ├── ApprovalHistory.tsx
│   │   │   └── ApprovalStatusBadge.tsx
│   │   ├── costs/
│   │   │   ├── CostOverview.tsx         ← コスト・財務（4画面）
│   │   │   ├── CostBreakdown.tsx
│   │   │   ├── CostExport.tsx
│   │   │   ├── FinanceEvents.tsx
│   │   │   └── CostChart.tsx
│   │   ├── activity/
│   │   │   ├── ActivityFeed.tsx         ← アクティビティ（2画面）
│   │   │   ├── ActivityDetail.tsx
│   │   │   └── ActivityItem.tsx
│   │   ├── org/
│   │   │   ├── OrgSettings.tsx          ← 組織管理（3画面）
│   │   │   ├── MemberList.tsx
│   │   │   ├── InviteFlow.tsx
│   │   │   └── MemberCard.tsx
│   │   ├── settings/
│   │   │   ├── GeneralSettings.tsx      ← 設定（3画面）
│   │   │   ├── APIKeys.tsx
│   │   │   ├── AdapterSettings.tsx
│   │   │   ├── LanguageSelector.tsx     ← 言語切替（i18n組込）
│   │   │   └── SettingsForm.tsx
│   │   ├── admin/
│   │   │   ├── CompanySettings.tsx      ← 企業管理（企業設定画面）
│   │   │   ├── CompanyExport.tsx
│   │   │   ├── CompanyImport.tsx
│   │   │   └── CompanyForm.tsx
│   │   ├── plugins/
│   │   │   ├── PluginManager.tsx        ← プラグイン管理（3画面）
│   │   │   ├── PluginPage.tsx
│   │   │   ├── PluginSettings.tsx
│   │   │   └── PluginCard.tsx
│   │   ├── workspace/
│   │   │   └── ExecutionWorkspaceDetail.tsx ← ワークスペース詳細
│   │   └── errors/
│   │       ├── NotFound.tsx             ← 404ページ
│   │       └── DesignGuide.tsx          ← デザインガイド（UI要素見本）
│   ├── pages/
│   │   └── 各画面のページレイアウト（React Router v6で管理）
│   ├── hooks/
│   │   ├── useApi.ts                    ← API呼び出し（react-query）
│   │   ├── useAuth.ts                   ← 認証情報
│   │   ├── useLanguage.ts               ← i18n言語切替
│   │   ├── usePagination.ts             ← ページネーション
│   │   ├── useForm.ts                   ← フォーム管理（react-hook-form）
│   │   └── useLocalStorage.ts           ← ローカルストレージ
│   ├── services/
│   │   ├── api.ts                       ← REST APIクライアント設定
│   │   ├── auth.ts                      ← 認証API呼び出し
│   │   ├── agents.ts                    ← エージェント API
│   │   ├── issues.ts                    ← Issue API
│   │   ├── goals.ts                     ← ゴール API
│   │   └── ...
│   ├── store/
│   │   └── index.ts                     ← Zustand (状態管理)
│   ├── utils/
│   │   ├── api-error-handler.ts         ← APIエラー処理
│   │   ├── date-format.ts               ← 日付フォーマット（i18n対応）
│   │   ├── validators.ts                ← Zod バリデーション
│   │   └── constants.ts
│   ├── types/
│   │   ├── api.ts                       ← APIレスポンス型定義
│   │   ├── entities.ts                  ← ドメインエンティティ型
│   │   └── index.ts
│   └── i18n/
│       ├── i18n.ts                      ← react-i18next 初期化
│       ├── locales/
│       │   ├── ja.json                  ← 日本語翻訳キー
│       │   └── en.json                  ← 英語翻訳キー
│       └── types.ts                     ← 翻訳キー型定義
├── __tests__/
│   ├── unit/
│   │   ├── components/                  ← コンポーネント単体テスト
│   │   ├── hooks/                       ← カスタムフック単体テスト
│   │   ├── services/                    ← API呼び出しテスト
│   │   └── utils/                       ← ユーティリティ単体テスト
│   ├── integration/
│   │   ├── auth-flow.test.tsx           ← 認証フローの結合テスト
│   │   ├── issue-create-flow.test.tsx   ← Issue作成フローの結合テスト
│   │   └── ...
│   └── e2e/
│       ├── auth.spec.ts                 ← Playwright E2Eテスト
│       ├── issue-management.spec.ts
│       ├── dashboard.spec.ts
│       └── ...
└── public/
    └── （アイコン・画像等の静的ファイル）
```

### 1.2 認証画面（3画面）

#### 1.2.1 Login（ログイン）

**用途**: ユーザー認証

**Props**:
```typescript
interface LoginFormProps {
  onSuccess?: (token: string) => void
  onError?: (error: Error) => void
  isLoading?: boolean
}
```

**State**:
```typescript
interface LoginState {
  email: string
  password: string
  errors: Record<string, string>
  isSubmitting: boolean
}
```

**API呼び出し**:
```
POST /api/auth/login
Body: { email: string, password: string }
Response: { token: string, user: User }
```

**UI要素**:
- メールアドレス入力フィールド（バリデーション付き）
- パスワード入力フィールド
- 「ログイン」ボタン
- 「パスワード忘れ」リンク
- 「新規登録」リンク

---

#### 1.2.2 Register（新規登録）/ Setup（初回セットアップ）

**用途**: 初めてのユーザーが企業・組織情報を設定・ユーザーアカウント作成

**Props (RegisterPage.tsx)**:
```typescript
interface RegisterPageProps {
  onSuccess?: (response: RegisterResponse) => void
  onError?: (error: Error) => void
}

interface RegisterResponse {
  apiKey: string
  userId: string
  companyId: string
  email: string
  name: string
  companyName: string
}
```

**State (RegisterPage.tsx)**:
```typescript
interface RegisterFormState {
  email: string
  password: string
  confirmPassword: string
  name: string  // 新規追加（ユーザー表示名）
  companyName: string
  errors: Record<string, string>
  isSubmitting: boolean
  language: 'ja' | 'en'
}
```

**API呼び出し**:
```
POST /api/auth/register
Body: {
  email: string
  password: string
  name: string  // 新規追加
  companyName: string
}
Response: {
  apiKey: string
  userId: string
  companyId: string
  email: string
  name: string
  companyName: string
  user: { id, email, name }  // 詳細情報
  company: { id, name, role }
}
```

**UI要素**:
- ユーザー名入力フィールド（新規追加 - name state）
- メールアドレス入力フィールド
- パスワード設定フィールド
- パスワード確認フィールド
- 企業名入力フィールド
- 言語選択ドロップダウン
- 「登録」ボタン
- 「ログイン画面へ」リンク

**実装上の注意**:
- name フィールドは `/api/auth/register` へのPOSTリクエストに含める（Codex修正で追加）
- レスポンスから `result.name` 、`result.companyName` を使用して表示

---

#### 1.2.3 AuthSettings（認証設定）

**用途**: APIキー管理・認証方式設定

**Props**:
```typescript
interface AuthSettingsProps {
  userId: string
}
```

**API呼び出し**:
```
GET /api/auth/api-keys
DELETE /api/auth/api-keys/:keyId
POST /api/auth/api-keys/create
```

**UI要素**:
- APIキー一覧（テーブル）
- 有効期限表示
- 「新規作成」ボタン
- 「削除」ボタン（各キー）

---

### 1.3 ダッシュボード（1画面）

#### 1.3.1 Dashboard

**用途**: 組織全体のメトリクス・ステータス表示

**Props**:
```typescript
interface DashboardProps {
  companyId: string
}
```

**API呼び出し**:
```
GET /api/dashboard/metrics?companyId=X
Response: {
  activeAgents: number
  totalIssues: number
  issuesByStatus: Record<string, number>
  costThisMonth: number
  topAgents: Agent[]
  recentActivities: Activity[]
}
```

**UI要素**:
- メトリクスカード（アクティブエージェント数・Issue数・コスト）
- Issue ステータス別グラフ（ggplot2）
- エージェント トップ3リスト
- 最近のアクティビティフィード

---

### 1.4 エージェント管理（5画面）

#### 1.4.1 AgentList

**用途**: エージェント一覧表示

**Props**:
```typescript
interface AgentListProps {
  companyId: string
}
```

**API呼び出し**:
```
GET /api/agents?companyId=X&page=N&limit=20
Response: { agents: Agent[], total: number }
```

**UI要素**:
- エージェントカード（名前・ステータス・最後のハートビート時刻）
- フィルター（ステータス・アダプター種別）
- ソート（作成日・最終実行）
- ページネーション

---

#### 1.4.2 AgentDetail

**用途**: エージェント詳細表示・編集

**API呼び出し**:
```
GET /api/agents/:agentId
PATCH /api/agents/:agentId
DELETE /api/agents/:agentId
```

**UI要素**:
- エージェント基本情報（ID・名前・説明）
- アダプター設定表示（読み取り専用）
- 設定リビジョン一覧
- ハートビート履歴グラフ
- トークン使用量グラフ（ggplot2）
- 「設定を編集」ボタン

---

#### 1.4.3 AgentCreate

**用途**: 新規エージェント作成

**API呼び出し**:
```
POST /api/agents
Body: { name, description, adapterType, config }
```

**UI要素**:
- エージェント名入力
- 説明入力
- アダプター選択（ドロップダウン）
- アダプター別設定フォーム（条件付きレンダリング）
- 「作成」ボタン

---

#### 1.4.4 AgentSettings

**用途**: エージェント設定編集

**API呼び出し**:
```
PATCH /api/agents/:agentId/config
Body: { config: Record<string, any> }
```

**UI要素**:
- JSON エディタまたはフォーム UI
- 設定項目の入力フィールド
- 「保存」「キャンセル」ボタン
- 変更差分プレビュー

---

#### 1.4.5 AgentLogs

**用途**: ハートビート実行ログ表示

**API呼び出し**:
```
GET /api/agents/:agentId/heartbeat-logs?page=N
Response: { logs: HeartbeatLog[], total: number }
```

**UI要素**:
- ログテーブル（日時・ステータス・トークン数・エラー）
- 詳細表示（モーダル・折りたたみ可能）
- フィルター（ステータス）
- ページネーション

---

### 1.5 Issue管理（5画面）

#### 1.5.1 IssueBoard

**用途**: Kanbanボード形式での Issue管理

**Props**:
```typescript
interface IssueBoardProps {
  companyId: string
}
```

**API呼び出し**:
```
GET /api/issues?companyId=X&status=backlog,in_progress,done
```

**UI要素**:
- Kanbanレーン（backlog / in_progress / done）
- IssueカードのドラッグアンドドロップUI
- フィルター（ラベル・アサイン先・優先度）
- ソート（作成日・期限・優先度）

---

#### 1.5.2 IssueDetail

**用途**: Issue詳細表示・操作

**API呼び出し**:
```
GET /api/issues/:issueId
PATCH /api/issues/:issueId
POST /api/issues/:issueId/comments
```

**UI要素**:
- Issue基本情報（ID・タイトル・説明・作成者）
- ステータス・優先度・期限
- アサイン先・ラベル
- コメント・添付ファイル
- アクティビティログ（変更履歴）
- 「編集」「コメント追加」ボタン

---

#### 1.5.3 IssueCreate

**用途**: 新規 Issue作成

**API呼び出し**:
```
POST /api/issues
Body: { title, description, assigneeId, priority, dueDate, labels }
```

**UI要素**:
- タイトル入力
- 説明入力（Markdown エディタ）
- アサイン先選択（ドロップダウン）
- 優先度選択
- ラベル選択（複数選択可能）
- 期限指定（カレンダーピッカー）
- 「作成」ボタン

---

#### 1.5.4 IssueEdit

**用途**: Issue情報編集

**API呼び出し**:
```
PATCH /api/issues/:issueId
Body: { title, description, assigneeId, priority, dueDate, labels, status }
```

**UI要素**:
- IssueCreate と同様のフォーム
- ステータス変更ドロップダウン
- 「保存」「キャンセル」ボタン

---

#### 1.5.5 IssueHistory

**用途**: Issue変更履歴表示

**API呼び出し**:
```
GET /api/issues/:issueId/history
Response: { events: IssueHistoryEvent[] }
```

**UI要素**:
- タイムライン形式（イベント・日時・変更者）
- 変更内容の詳細表示（折りたたみ可能）

---

### 1.6 スキル管理（4画面）

#### 1.6.1 SkillList

**用途**: スキル（エージェント実行可能なタスク）一覧表示

**API呼び出し**:
```
GET /api/skills?companyId=X
Response: { skills: Skill[] }
```

**UI要素**:
- スキルカード（名前・説明・使用回数）
- フィルター（カテゴリ）
- 検索フィールド

---

#### 1.6.2 SkillDetail

**用途**: スキル詳細表示

**API呼び出し**:
```
GET /api/skills/:skillId
```

**UI要素**:
- スキル基本情報（ID・名前・説明・実装コード）
- 実装ドキュメント表示
- トリガー条件表示
- 実行ログ（過去の実行実績）

---

#### 1.6.3 SkillCreate

**用途**: 新規スキル作成

**API呼び出し**:
```
POST /api/skills
Body: { name, description, code, trigger, inputs, outputs }
```

**UI要素**:
- スキル名・説明入力
- コードエディタ（JavaScript/Python）
- トリガー設定（キーワード）
- 入出力スキーマ定義（JSON Schema）

---

#### 1.6.4 SkillEdit

**用途**: スキル編集

**API呼び出し**:
```
PATCH /api/skills/:skillId
```

**UI要素**:
- SkillCreate と同様

---

### 1.7 ゴール管理（4画面）

#### 1.7.1 GoalList

**用途**: ゴール一覧表示

**API呼び出し**:
```
GET /api/goals?companyId=X
Response: { goals: Goal[] }
```

**UI要素**:
- ゴールカード（名前・期限・進捗率・達成度）
- フィルター（ステータス・所有者）
- ソート（期限・進捗率）

---

#### 1.7.2 GoalDetail

**用途**: ゴール詳細表示

**API呼び出し**:
```
GET /api/goals/:goalId
```

**UI要素**:
- ゴール基本情報
- 進捗状況（プログレスバー）
- 関連 Issue リスト
- プロジェクト関連付け
- 期限・マイルストーン

---

#### 1.7.3 GoalCreate

**用途**: 新規ゴール作成

**API呼び出し**:
```
POST /api/goals
Body: { name, description, targetDate, owner, projects }
```

**UI要素**:
- ゴール名・説明入力
- 期限設定（カレンダーピッカー）
- 所有者選択
- 関連プロジェクト選択（複数選択可能）

---

#### 1.7.4 GoalEdit

**用途**: ゴール編集

**API呼び出し**:
```
PATCH /api/goals/:goalId
```

**UI要素**:
- GoalCreate と同様

---

### 1.8 ルーティン管理（3画面）

#### 1.8.1 RoutineList

**用途**: ルーティン（定期実行タスク）一覧表示

**API呼び出し**:
```
GET /api/routines?companyId=X
Response: { routines: Routine[] }
```

**UI要素**:
- ルーティンカード（名前・トリガー条件・最後の実行日時）
- 有効/無効トグル
- フィルター（トリガー種別）

---

#### 1.8.2 RoutineDetail

**用途**: ルーティン詳細表示

**API呼び出し**:
```
GET /api/routines/:routineId
```

**UI要素**:
- ルーティン基本情報
- トリガー条件表示（例: 「毎日午前9時」「Issue作成時」）
- アクション設定表示
- 実行履歴

---

#### 1.8.3 RoutineCreate

**用途**: 新規ルーティン作成

**API呼び出し**:
```
POST /api/routines
Body: { name, trigger, actions, isEnabled }
```

**UI要素**:
- ルーティン名入力
- トリガータイプ選択（時間ベース / イベントベース）
- トリガー条件設定（cron / イベント条件）
- アクション追加（複数可能）
- 「作成」ボタン

---

### 1.9 承認管理（3画面）

#### 1.9.1 ApprovalQueue

**用途**: 承認待ち Issue 一覧（インボックス形式）

**API呼び出し**:
```
GET /api/approvals/queue?userId=X
Response: { approvals: Approval[] }
```

**UI要素**:
- 承認待ち Issue リスト
- Issue 詳細プレビュー
- 「承認」「却下」ボタン
- コメント入力フィールド

---

#### 1.9.2 ApprovalDetail

**用途**: 承認リクエスト詳細

**API呼び出し**:
```
GET /api/approvals/:approvalId
POST /api/approvals/:approvalId/approve
POST /api/approvals/:approvalId/reject
```

**UI要素**:
- リクエスト内容表示
- 承認者一覧
- コメント・変更履歴
- 「承認」「却下」ボタン

---

#### 1.9.3 ApprovalHistory

**用途**: 過去の承認履歴表示

**API呼び出し**:
```
GET /api/approvals/history?page=N
Response: { approvals: ApprovalHistory[], total: number }
```

**UI要素**:
- 承認履歴テーブル（Issue・申請者・承認者・日時・ステータス）
- ページネーション
- フィルター（ステータス・期間）

---

### 1.10 コスト・財務（4画面）

#### 1.10.1 CostOverview

**用途**: コスト全体概要表示

**API呼び出し**:
```
GET /api/costs/overview?companyId=X
Response: {
  totalThisMonth: number
  costByAgent: Record<string, number>
  costByModel: Record<string, number>
  costTrend: DataPoint[]
}
```

**UI要素**:
- 今月の合計コスト表示
- エージェント別コスト棒グラフ（ggplot2）
- 月別トレンド折れ線グラフ
- 予算比較（予算 vs 実績）

---

#### 1.10.2 CostBreakdown

**用途**: コスト内訳詳細表示

**API呼び出し**:
```
GET /api/costs/breakdown?companyId=X
Response: {
  byAgent: CostDetail[]
  byModel: CostDetail[]
  byTask: CostDetail[]
}
```

**UI要素**:
- 複数の詳細テーブル（エージェント・モデル・タスク別）
- 詳細行クリックで詳細表示
- エクスポートボタン

---

#### 1.10.3 CostExport

**用途**: コストデータ エクスポート

**API呼び出し**:
```
GET /api/costs/export?format=csv&period=YYYY-MM
```

**UI要素**:
- フォーマット選択（CSV / Excel / JSON）
- 期間選択（カレンダーピッカー）
- フィルター（エージェント）
- 「ダウンロード」ボタン

---

#### 1.10.4 FinanceEvents

**用途**: 財務イベント（購入・払戻し等）表示

**API呼び出し**:
```
GET /api/finance/events?page=N
Response: { events: FinanceEvent[], total: number }
```

**UI要素**:
- イベントテーブル（日時・種類・金額・説明）
- フィルター（種類・期間）
- ページネーション

---

### 1.11 アクティビティ（2画面）

#### 1.11.1 ActivityFeed

**用途**: 組織全体のアクティビティログフィード

**API呼び出し**:
```
GET /api/activities?page=N&limit=50
Response: { activities: Activity[], total: number }
```

**UI要素**:
- アクティビティアイテムリスト（時系列）
- フィルター（種類・ユーザー）
- 日付セパレーター
- ページネーション

---

#### 1.11.2 ActivityDetail

**用途**: アクティビティ詳細

**Props**:
```typescript
interface ActivityDetailProps {
  activity: Activity
}
```

**UI要素**:
- アクティビティ詳細情報（実行者・時刻・内容）
- 関連リソース（Issue・Agent等）へのリンク

---

### 1.12 組織管理（3画面）

#### 1.12.1 OrgSettings

**用途**: 組織全体設定

**API呼び出し**:
```
GET /api/orgs/:orgId
PATCH /api/orgs/:orgId
```

**UI要素**:
- 組織名・説明編集フィールド
- ロゴアップロード
- 公開設定
- 「保存」ボタン

---

#### 1.12.2 MemberList

**用途**: メンバー管理

**API呼び出し**:
```
GET /api/orgs/:orgId/members?page=N
PATCH /api/orgs/:orgId/members/:userId
DELETE /api/orgs/:orgId/members/:userId
```

**UI要素**:
- メンバーテーブル（名前・メール・ロール・加入日）
- ロール変更ドロップダウン
- 削除ボタン
- 「招待」ボタン

---

#### 1.12.3 InviteFlow

**用途**: メンバー招待フロー

**API呼び出し**:
```
POST /api/orgs/:orgId/invites
Body: { emails: string[] }
```

**UI要素**:
- メールアドレス複数入力フィールド
- ロール選択
- 招待メッセージカスタマイズ
- 「送信」ボタン
- 招待状況表示（送信済み・保留中・受け入れ）

---

### 1.13 設定（3画面）

#### 1.13.1 GeneralSettings（一般設定・言語切替含む）

**用途**: ユーザー個人設定・言語切替

**API呼び出し**:
```
GET /api/settings/general
PATCH /api/settings/general
```

**UI要素**:
- プロフィール編集（名前・メール・写真）
- **言語選択セレクタ（ja / en）** ← react-i18next 連携
- タイムゾーン設定
- 通知設定チェックボックス

**LanguageSelector コンポーネント詳細**:
```typescript
interface LanguageSelectorProps {
  onLanguageChange?: (lang: 'ja' | 'en') => void
  currentLanguage?: 'ja' | 'en'
}

// 動作:
// 1. ドロップダウンで言語を選択
// 2. react-i18next の i18n.changeLanguage() を呼び出し
// 3. DB に言語設定を保存（PATCH /api/settings/general）
// 4. UI全体が選択言語で再レンダリング
```

---

#### 1.13.2 APIKeys（APIキー管理）

**用途**: 個人用 APIキー管理

**API呼び出し**:
```
GET /api/settings/api-keys
POST /api/settings/api-keys/create
DELETE /api/settings/api-keys/:keyId
```

**UI要素**:
- APIキー一覧テーブル
- 有効期限・スコープ表示
- 「新規作成」ボタン
- 「削除」ボタン
- キーコピー機能

---

#### 1.13.3 AdapterSettings（アダプター設定）

**用途**: エージェント実行時に使用する外部CLI設定

**API呼し出し**:
```
GET /api/settings/adapters
PATCH /api/settings/adapters/:adapterId
```

**UI要素**:
- アダプター一覧（インストール状態表示）
- アダプター別設定フォーム（JSON / フォーム UI）
- 「テスト」ボタン（接続確認）
- 「保存」ボタン

---

### 1.13.4 SettingsPage.tsx — 設定画面（統合版）

**ファイル**: `packages/ui/src/pages/settings/SettingsPage.tsx`
**機能**: 4セクションからなる設定画面（エージェント実行モード・組織情報・言語・バックアップ）

#### セクション構成

| セクション | 説明 | 主要状態変数 |
|-----------|------|------------|
| エージェント実行モード | `claude_local` / `claude_api` を切替 | `agentMode`, `anthropicApiKey` |
| 組織情報 | 組織名・説明を編集 | `orgName`, `orgDescription` |
| 言語 | ja / en を切替（即時反映） | `i18n.changeLanguage()` |
| バックアップ設定 | 15フィールドのバックアップ設定 | 以下参照 |

#### バックアップ設定 状態変数（15フィールド）

```typescript
const [backupEnabled, setBackupEnabled] = useState(false);
const [backupSchedule, setBackupSchedule] = useState<'daily'|'weekly'|'monthly'>('daily');
const [backupTime, setBackupTime] = useState('03:00');
const [backupRetention, setBackupRetention] = useState(30);
const [backupDestination, setBackupDestination] = useState<'local'|'s3'|'gcs'>('local');
const [backupLocalPath, setBackupLocalPath] = useState('');
const [backupS3Bucket, setBackupS3Bucket] = useState('');
const [backupS3Region, setBackupS3Region] = useState('');
const [backupGcsBucket, setBackupGcsBucket] = useState('');
const [backupCompression, setBackupCompression] = useState<'gzip'|'none'>('gzip');
const [backupEncryption, setBackupEncryption] = useState(false);
const [backupIncludeActivityLog, setBackupIncludeActivityLog] = useState(false);
const [backupNotifyEmail, setBackupNotifyEmail] = useState('');
const [backupNotifyOnFailure, setBackupNotifyOnFailure] = useState(true);
const [backupNotifyOnSuccess, setBackupNotifyOnSuccess] = useState(false);
```

#### handleSaveBackup() ロジック

条件付きペイロード構築:
- `destinationType === 'local'` → `localPath` を送信
- `destinationType === 's3'` → `s3Bucket`, `s3Region` を送信
- `destinationType === 'gcs'` → `gcsBucket` を送信
- `notifyEmail` が空でなければ送信

---

### 1.14 企業管理（3画面）

#### 1.14.1 CompanySettings

**用途**: 企業全体の管理設定（管理者用）

**API呼び出し**:
```
GET /api/companies/:companyId
PATCH /api/companies/:companyId
```

**UI要素**:
- 企業名・説明編集
- ロゴ・ファビコンアップロード
- 企業メタデータ表示

---

#### 1.14.2 CompanyExport

**用途**: 企業データエクスポート

**API呼び出し**:
```
POST /api/companies/:companyId/export
GET /api/companies/:companyId/export-status
```

**UI要素**:
- エクスポート対象選択（Agents / Issues / Goals 等）
- フォーマット選択（JSON / CSV）
- 「開始」ボタン
- 進捗表示・ダウンロードリンク

---

#### 1.14.3 CompanyImport

**用途**: 企業データインポート

**API呼び出し**:
```
POST /api/companies/:companyId/import
GET /api/companies/:companyId/import-status
```

**UI要素**:
- ファイルアップロード（ドラッグ&ドロップ対応）
- マッピング設定（カラム対応付け）
- 「実行」ボタン
- 進捗表示・結果サマリー

---

### 1.15 プラグイン管理（3画面）

#### 1.15.1 PluginManager

**用途**: プラグイン一覧・有効化・無効化

**API呼び出し**:
```
GET /api/plugins?companyId=X
PATCH /api/plugins/:pluginId/enable
PATCH /api/plugins/:pluginId/disable
```

**UI要素**:
- プラグインカード（名前・説明・バージョン・有効/無効トグル）
- 「詳細」ボタン
- 「設定」ボタン

---

#### 1.15.2 PluginPage

**用途**: プラグイン詳細ページ

**API呼び出し**:
```
GET /api/plugins/:pluginId
```

**UI要素**:
- プラグイン情報（作成者・バージョン・ライセンス）
- READMEドキュメント表示
- インストール・アンインストール状態
- アクティビティログ

---

#### 1.15.3 PluginSettings

**用途**: プラグイン設定編集

**API呼び出し**:
```
PATCH /api/plugins/:pluginId/config
```

**UI要素**:
- プラグイン固有の設定フォーム
- 「保存」「キャンセル」ボタン

---

### 1.16 その他画面（2画面）

#### 1.16.1 NotFound

**用途**: 404ページ

**UI要素**:
- 404エラーメッセージ
- 「ホームに戻る」リンク
- 検索フォーム

---

#### 1.16.2 DesignGuide

**用途**: UI要素ショーケース（開発用）

**UI要素**:
- ボタン各種（primary / secondary / danger）
- フォーム要素（input / select / textarea）
- カード・バッジ・ステータスインジケーター等の見本

---

## 2. 共通UIコンポーネント

### 2.1 コンポーネントライブラリ設定

**採用**: shadcn/ui + Tailwind CSS

```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        company: {
          primary: '#404040',    // チャコール
          accent: '#7D6647',     // ウォームタン
          light: '#F5F5F5'       // 背景
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
}
```

### 2.2 レイアウトコンポーネント

```typescript
// SideNav.tsx
export interface SideNavProps {
  currentPath: string
  onNavigate: (path: string) => void
}

// Header.tsx
export interface HeaderProps {
  title: string
  breadcrumbs?: Breadcrumb[]
  onLanguageChange?: (lang: 'ja' | 'en') => void
}

// PageWrapper.tsx
export interface PageWrapperProps {
  title: string
  children: React.ReactNode
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
}
```

### 2.3 データ表示コンポーネント

```typescript
// DataTable.tsx（React Table v8準拠）
export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  sortable?: boolean
  filterable?: boolean
  pagination?: PaginationState
}

// StatusBadge.tsx
export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error'
  label?: string
}

// TimestampDisplay.tsx（i18n対応日付フォーマット）
export interface TimestampDisplayProps {
  timestamp: Date
  format?: 'relative' | 'absolute'  // 「2時間前」vs「2026-04-03 15:30」
}
```

### 2.4 フォームコンポーネント

```typescript
// react-hook-form 統合
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters')
})

type FormData = z.infer<typeof schema>

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })
  // ...
}
```

### 2.5 ルーティング設計（React Router v6）

```typescript
// src/App.tsx
import { createBrowserRouter } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: 'auth',
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'setup', element: <SetupPage /> },
          { path: 'settings', element: <AuthSettingsPage /> }
        ]
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>
      },
      {
        path: 'agents',
        children: [
          { path: '', element: <AgentListPage /> },
          { path: ':id', element: <AgentDetailPage /> },
          { path: 'create', element: <AgentCreatePage /> },
          { path: ':id/settings', element: <AgentSettingsPage /> },
          { path: ':id/logs', element: <AgentLogsPage /> }
        ]
      },
      // ... 他の経路
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
])
```

---

## 3. i18n詳細設計

### 3.1 react-i18next 設定

```typescript
// src/i18n/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import jaLocale from './locales/ja.json'
import enLocale from './locales/en.json'

i18n
  .use(LanguageDetector)  // ブラウザの言語を自動検出
  .use(initReactI18next)
  .init({
    fallbackLng: 'ja',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false  // React already provides XSS protection
    },
    resources: {
      ja: {
        common: jaLocale
      },
      en: {
        common: enLocale
      }
    }
  })

export default i18n
```

### 3.2 翻訳キー設計（namespaces別構成）

```json
{
  "namespaces": [
    "common",      // 共通語彙（ボタン・エラーメッセージ）
    "agents",      // エージェント管理関連
    "issues",      // Issue管理関連
    "skills",      // スキル管理関連
    "goals",       // ゴール管理関連
    "auth",        // 認証関連
    "settings",    // 設定関連
    "finance"      // 財務関連
  ]
}
```

### 3.3 locales/ja.json サンプル（主要キー100件以上）

```json
{
  "common": {
    "button": {
      "save": "保存",
      "cancel": "キャンセル",
      "delete": "削除",
      "edit": "編集",
      "create": "作成",
      "close": "閉じる",
      "logout": "ログアウト",
      "submit": "送信",
      "back": "戻る",
      "next": "次へ",
      "prev": "前へ",
      "download": "ダウンロード",
      "upload": "アップロード",
      "export": "エクスポート",
      "import": "インポート",
      "search": "検索",
      "filter": "フィルター",
      "sort": "並べ替え",
      "refresh": "更新",
      "confirm": "確認"
    },
    "status": {
      "active": "アクティブ",
      "inactive": "非アクティブ",
      "pending": "保留中",
      "completed": "完了",
      "failed": "失敗",
      "error": "エラー",
      "loading": "読み込み中",
      "success": "成功"
    },
    "error": {
      "required": "このフィールドは必須です",
      "invalid_email": "有効なメールアドレスを入力してください",
      "min_length": "最低{{min}}文字必要です",
      "max_length": "最大{{max}}文字までです",
      "not_found": "見つかりません",
      "unauthorized": "認証が必要です",
      "forbidden": "アクセス権がありません",
      "server_error": "サーバーエラーが発生しました",
      "network_error": "ネットワーク接続エラー",
      "timeout": "リクエストがタイムアウトしました"
    },
    "pagination": {
      "page": "ページ",
      "of": "/",
      "items_per_page": "1ページあたりの項目数",
      "showing": "{{from}}-{{to}} / 全{{total}}件を表示中"
    },
    "date": {
      "today": "今日",
      "yesterday": "昨日",
      "this_week": "今週",
      "this_month": "今月",
      "this_year": "今年",
      "format_short": "YYYY/MM/DD",
      "format_long": "YYYY年MM月DD日",
      "format_time": "HH:mm:ss"
    }
  },
  "agents": {
    "title": "エージェント管理",
    "list": {
      "title": "エージェント一覧",
      "name": "名前",
      "status": "ステータス",
      "adapter": "アダプター",
      "last_heartbeat": "最後のハートビート",
      "created_at": "作成日時",
      "actions": "操作"
    },
    "detail": {
      "title": "エージェント詳細",
      "id": "エージェント ID",
      "description": "説明",
      "config": "設定",
      "runtime_state": "実行時状態",
      "heartbeat_logs": "ハートビートログ",
      "token_usage": "トークン使用量"
    },
    "create": {
      "title": "エージェント作成",
      "name_placeholder": "エージェント名を入力",
      "description_placeholder": "説明を入力（省略可）",
      "select_adapter": "アダプターを選択"
    },
    "settings": {
      "title": "エージェント設定",
      "config_label": "設定（JSON形式）"
    },
    "logs": {
      "title": "ハートビートログ",
      "timestamp": "実行日時",
      "exit_code": "終了コード",
      "duration": "実行時間",
      "tokens_input": "入力トークン",
      "tokens_output": "出力トークン",
      "errors": "エラー"
    }
  },
  "issues": {
    "title": "Issue管理",
    "board": {
      "title": "Issueボード",
      "backlog": "バックログ",
      "in_progress": "進行中",
      "done": "完了"
    },
    "detail": {
      "title": "Issue詳細",
      "id": "Issue ID",
      "title_field": "タイトル",
      "description_field": "説明",
      "status": "ステータス",
      "priority": "優先度",
      "assignee": "アサイン先",
      "labels": "ラベル",
      "due_date": "期限",
      "created_by": "作成者",
      "created_at": "作成日時",
      "updated_at": "更新日時",
      "comments": "コメント",
      "attachments": "添付ファイル",
      "activity": "アクティビティ"
    },
    "create": {
      "title": "Issue作成",
      "title_placeholder": "Issue タイトルを入力",
      "description_placeholder": "説明を入力（Markdown対応）",
      "select_assignee": "アサイン先を選択",
      "select_priority": "優先度を選択",
      "select_labels": "ラベルを選択（複数選択可能）",
      "set_due_date": "期限を設定"
    },
    "priority": {
      "critical": "緊急",
      "high": "高",
      "medium": "中",
      "low": "低"
    }
  },
  "skills": {
    "title": "スキル管理",
    "list": {
      "title": "スキル一覧",
      "name": "名前",
      "description": "説明",
      "usage_count": "使用回数"
    },
    "detail": {
      "title": "スキル詳細",
      "code": "実装コード",
      "trigger": "トリガー条件",
      "inputs": "入力パラメーター",
      "outputs": "出力結果",
      "execution_logs": "実行ログ"
    },
    "create": {
      "title": "スキル作成",
      "name_placeholder": "スキル名を入力",
      "code_placeholder": "コードを入力（JavaScript / Python）"
    }
  },
  "goals": {
    "title": "ゴール管理",
    "list": {
      "title": "ゴール一覧",
      "name": "名前",
      "owner": "所有者",
      "progress": "進捗率",
      "target_date": "目標日",
      "status": "ステータス"
    },
    "detail": {
      "title": "ゴール詳細",
      "description": "説明",
      "related_issues": "関連 Issues",
      "related_projects": "関連プロジェクト",
      "milestones": "マイルストーン"
    },
    "create": {
      "title": "ゴール作成",
      "name_placeholder": "ゴール名を入力",
      "target_date_label": "目標日を設定"
    }
  },
  "routines": {
    "title": "ルーティン管理",
    "list": {
      "title": "ルーティン一覧",
      "name": "名前",
      "trigger": "トリガー条件",
      "last_executed": "最後の実行日時",
      "status": "ステータス"
    },
    "detail": {
      "title": "ルーティン詳細",
      "trigger_condition": "トリガー条件",
      "actions": "アクション",
      "execution_history": "実行履歴"
    },
    "create": {
      "title": "ルーティン作成",
      "trigger_type": "トリガータイプ",
      "schedule": "時間ベース",
      "event": "イベントベース",
      "cron_expression": "Cron式"
    }
  },
  "approvals": {
    "title": "承認管理",
    "queue": {
      "title": "承認待ちキュー",
      "pending_count": "待機中: {{count}}件"
    },
    "detail": {
      "title": "承認リクエスト詳細",
      "requested_by": "リクエスト者",
      "requested_at": "リクエスト日時",
      "approvers": "承認者",
      "status": "承認ステータス"
    },
    "history": {
      "title": "承認履歴",
      "issue_id": "Issue ID",
      "requester": "申請者",
      "approver": "承認者",
      "status": "結果",
      "date": "日時"
    },
    "button": {
      "approve": "承認",
      "reject": "却下",
      "comment": "コメントを追加"
    }
  },
  "costs": {
    "title": "コスト・財務",
    "overview": {
      "title": "コスト概要",
      "total_this_month": "今月の合計",
      "by_agent": "エージェント別",
      "by_model": "モデル別",
      "trend": "月別トレンド",
      "budget_vs_actual": "予算 vs 実績"
    },
    "breakdown": {
      "title": "コスト内訳",
      "by_agent": "エージェント別内訳",
      "by_model": "モデル別内訳",
      "by_task": "タスク別内訳"
    },
    "export": {
      "title": "コストエクスポート",
      "format_label": "フォーマット",
      "format_csv": "CSV",
      "format_excel": "Excel",
      "format_json": "JSON",
      "period_label": "期間"
    },
    "finance": {
      "title": "財務イベント",
      "event_type": "イベント種別",
      "amount": "金額",
      "description": "説明",
      "date": "日時"
    }
  },
  "activity": {
    "title": "アクティビティ",
    "feed": {
      "title": "アクティビティフィード",
      "type": "種別",
      "actor": "実行者",
      "description": "内容",
      "timestamp": "日時"
    },
    "detail": {
      "title": "アクティビティ詳細",
      "related_resource": "関連リソース"
    }
  },
  "org": {
    "title": "組織管理",
    "settings": {
      "title": "組織設定",
      "name": "組織名",
      "description": "説明",
      "logo": "ロゴ"
    },
    "members": {
      "title": "メンバー管理",
      "name": "名前",
      "email": "メールアドレス",
      "role": "ロール",
      "joined_at": "加入日",
      "actions": "操作"
    },
    "invite": {
      "title": "メンバー招待",
      "email_input": "メールアドレス（複数入力可・改行またはカンマで区切る）",
      "role_select": "ロール",
      "message": "メッセージ（省略可）",
      "send_invites": "招待を送信"
    }
  },
  "settings": {
    "title": "設定",
    "general": {
      "title": "一般設定",
      "profile": "プロフィール",
      "name": "名前",
      "email": "メールアドレス",
      "avatar": "アバター",
      "language": "言語",
      "language_ja": "日本語",
      "language_en": "English",
      "timezone": "タイムゾーン",
      "notifications": "通知設定"
    },
    "api_keys": {
      "title": "APIキー管理",
      "key": "キー",
      "scope": "スコープ",
      "expires_at": "有効期限",
      "created_at": "作成日時",
      "actions": "操作",
      "create_new": "新規作成",
      "copy": "コピー",
      "copied": "コピーしました"
    },
    "adapters": {
      "title": "アダプター設定",
      "installed": "インストール済み",
      "not_installed": "未インストール",
      "test_connection": "接続テスト",
      "test_success": "接続成功",
      "test_failed": "接続失敗"
    },
    "agentMode": "エージェント実行モード",
    "agentModeDesc": "AIエージェントがタスクを実行する際の課金方式を選択します",
    "agentModeSubscription": "Claudeサブスクリプション（claude -p CLI）",
    "agentModeSubscriptionDesc": "追加課金なし。Claudeのサブスクプランで動作します",
    "agentModeApi": "Anthropic APIキー（従量課金）",
    "agentModeApiDesc": "入力したAPIキーで直接 Anthropic API を呼び出します",
    "anthropicApiKey": "Anthropic API キー",
    "anthropicApiKeyPlaceholder": "sk-ant-...",
    "anthropicApiKeySet": "設定済み（変更する場合は新しいキーを入力）",
    "orgInfo": "組織情報",
    "orgName": "組織名",
    "orgDescription": "説明",
    "backup": "バックアップ設定",
    "backupDesc": "データベースの自動バックアップスケジュールと保存先を設定します",
    "backupEnable": "バックアップを有効にする",
    "backupSchedule": "スケジュール",
    "backupScheduleDaily": "毎日",
    "backupScheduleWeekly": "毎週",
    "backupScheduleMonthly": "毎月",
    "backupTime": "実行時刻",
    "backupRetention": "保持期間",
    "backupRetentionDays": "{{days}}日間",
    "backupRetentionYear": "365日間（1年）",
    "backupDestination": "バックアップ先",
    "backupDestinationLocal": "ローカルパス",
    "backupDestinationS3": "Amazon S3",
    "backupDestinationGcs": "Google Cloud Storage",
    "backupLocalPath": "ローカルパス",
    "backupS3Bucket": "S3 バケット名",
    "backupS3Region": "S3 リージョン",
    "backupGcsBucket": "GCS バケット名",
    "backupCompression": "圧縮",
    "backupCompressionGzip": "gzip（推奨）",
    "backupCompressionNone": "なし",
    "backupEncryption": "暗号化（AES-256）",
    "backupIncludeActivityLog": "アクティビティログを含める",
    "backupIncludeActivityLogNote": "（大容量になる場合があります）",
    "backupNotifications": "通知設定",
    "backupNotifyEmail": "通知先メールアドレス",
    "backupNotifyOnFailure": "失敗時に通知",
    "backupNotifyOnSuccess": "成功時に通知"
  }
}
```

### 3.3.1 settings セクション i18n キー仕様（v2.0 追加分）

#### エージェント実行モード関連

| キー | ja | en |
|-----|-----|-----|
| `settings.agentMode` | エージェント実行モード | Agent Execution Mode |
| `settings.agentModeDesc` | AIエージェントがタスクを実行する際の課金方式を選択します | Choose how AI agents are billed when executing tasks |
| `settings.agentModeSubscription` | Claudeサブスクリプション（claude -p CLI） | Claude Subscription (claude -p CLI) |
| `settings.agentModeSubscriptionDesc` | 追加課金なし。Claudeのサブスクプランで動作します | No additional cost. Runs on your Claude subscription plan |
| `settings.agentModeApi` | Anthropic APIキー（従量課金） | Anthropic API Key (Pay-as-you-go) |
| `settings.agentModeApiDesc` | 入力したAPIキーで直接 Anthropic API を呼び出します | Calls the Anthropic API directly using your API key |
| `settings.anthropicApiKey` | Anthropic API キー | Anthropic API Key |
| `settings.anthropicApiKeyPlaceholder` | sk-ant-... | sk-ant-... |
| `settings.anthropicApiKeySet` | 設定済み（変更する場合は新しいキーを入力） | Already set (enter a new key to change) |

#### 組織情報関連

| キー | ja | en |
|-----|-----|-----|
| `settings.orgInfo` | 組織情報 | Organization Info |
| `settings.orgName` | 組織名 | Organization Name |
| `settings.orgDescription` | 説明 | Description |

#### バックアップ設定関連（28キー）

| キー | ja | en |
|-----|-----|-----|
| `settings.backup` | バックアップ設定 | Backup Settings |
| `settings.backupDesc` | データベースの自動バックアップスケジュールと保存先を設定します | Configure automatic database backup schedule and storage destination |
| `settings.backupEnable` | バックアップを有効にする | Enable automatic backups |
| `settings.backupSchedule` | スケジュール | Schedule |
| `settings.backupScheduleDaily` | 毎日 | Daily |
| `settings.backupScheduleWeekly` | 毎週 | Weekly |
| `settings.backupScheduleMonthly` | 毎月 | Monthly |
| `settings.backupTime` | 実行時刻 | Run at |
| `settings.backupRetention` | 保持期間 | Retention period |
| `settings.backupRetentionDays` | {{days}}日間 | {{days}} days |
| `settings.backupRetentionYear` | 365日間（1年） | 365 days (1 year) |
| `settings.backupDestination` | バックアップ先 | Backup destination |
| `settings.backupDestinationLocal` | ローカルパス | Local path |
| `settings.backupDestinationS3` | Amazon S3 | Amazon S3 |
| `settings.backupDestinationGcs` | Google Cloud Storage | Google Cloud Storage |
| `settings.backupLocalPath` | ローカルパス | Local path |
| `settings.backupS3Bucket` | S3 バケット名 | S3 bucket name |
| `settings.backupS3Region` | S3 リージョン | S3 region |
| `settings.backupGcsBucket` | GCS バケット名 | GCS bucket name |
| `settings.backupCompression` | 圧縮 | Compression |
| `settings.backupCompressionGzip` | gzip（推奨） | gzip (recommended) |
| `settings.backupCompressionNone` | なし | None |
| `settings.backupEncryption` | 暗号化（AES-256） | Encryption (AES-256) |
| `settings.backupIncludeActivityLog` | アクティビティログを含める | Include activity log |
| `settings.backupIncludeActivityLogNote` | （大容量になる場合があります） | (may result in large file size) |
| `settings.backupNotifications` | 通知設定 | Notifications |
| `settings.backupNotifyEmail` | 通知先メールアドレス | Notification email address |
| `settings.backupNotifyOnFailure` | 失敗時に通知 | Notify on failure |
| `settings.backupNotifyOnSuccess` | 成功時に通知 | Notify on success |

**注意**: `settings.backupRetentionDays` は i18next の補間記法 `{{days}}` を使用。
使用例: `t('settings.backupRetentionDays', { days: 30 })` → `"30日間"` / `"30 days"`

### 3.4 locales/en.json サンプル（主要キー）

```json
{
  "common": {
    "button": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "close": "Close",
      "logout": "Logout",
      "submit": "Submit",
      "back": "Back",
      "next": "Next",
      "prev": "Previous",
      "download": "Download",
      "upload": "Upload",
      "export": "Export",
      "import": "Import",
      "search": "Search",
      "filter": "Filter",
      "sort": "Sort",
      "refresh": "Refresh",
      "confirm": "Confirm"
    },
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "pending": "Pending",
      "completed": "Completed",
      "failed": "Failed",
      "error": "Error",
      "loading": "Loading",
      "success": "Success"
    },
    "error": {
      "required": "This field is required",
      "invalid_email": "Please enter a valid email address",
      "min_length": "Minimum {{min}} characters required",
      "max_length": "Maximum {{max}} characters allowed",
      "not_found": "Not found",
      "unauthorized": "Authentication required",
      "forbidden": "Access denied",
      "server_error": "Server error occurred",
      "network_error": "Network connection error",
      "timeout": "Request timeout"
    },
    "pagination": {
      "page": "Page",
      "of": "/",
      "items_per_page": "Items per page",
      "showing": "Showing {{from}}-{{to}} of {{total}} items"
    },
    "date": {
      "today": "Today",
      "yesterday": "Yesterday",
      "this_week": "This week",
      "this_month": "This month",
      "this_year": "This year",
      "format_short": "MM/DD/YYYY",
      "format_long": "MMMM DD, YYYY",
      "format_time": "HH:mm:ss"
    }
  },
  "agents": {
    "title": "Agent Management",
    "list": {
      "title": "Agents",
      "name": "Name",
      "status": "Status",
      "adapter": "Adapter",
      "last_heartbeat": "Last Heartbeat",
      "created_at": "Created",
      "actions": "Actions"
    }
  },
  "settings": {
    "agentMode": "Agent Execution Mode",
    "agentModeDesc": "Choose how AI agents are billed when executing tasks",
    "agentModeSubscription": "Claude Subscription (claude -p CLI)",
    "agentModeSubscriptionDesc": "No additional cost. Runs on your Claude subscription plan",
    "agentModeApi": "Anthropic API Key (Pay-as-you-go)",
    "agentModeApiDesc": "Calls the Anthropic API directly using your API key",
    "anthropicApiKey": "Anthropic API Key",
    "anthropicApiKeyPlaceholder": "sk-ant-...",
    "anthropicApiKeySet": "Already set (enter a new key to change)",
    "orgInfo": "Organization Info",
    "orgName": "Organization Name",
    "orgDescription": "Description",
    "backup": "Backup Settings",
    "backupDesc": "Configure automatic database backup schedule and storage destination",
    "backupEnable": "Enable automatic backups",
    "backupSchedule": "Schedule",
    "backupScheduleDaily": "Daily",
    "backupScheduleWeekly": "Weekly",
    "backupScheduleMonthly": "Monthly",
    "backupTime": "Run at",
    "backupRetention": "Retention period",
    "backupRetentionDays": "{{days}} days",
    "backupRetentionYear": "365 days (1 year)",
    "backupDestination": "Backup destination",
    "backupDestinationLocal": "Local path",
    "backupDestinationS3": "Amazon S3",
    "backupDestinationGcs": "Google Cloud Storage",
    "backupLocalPath": "Local path",
    "backupS3Bucket": "S3 bucket name",
    "backupS3Region": "S3 region",
    "backupGcsBucket": "GCS bucket name",
    "backupCompression": "Compression",
    "backupCompressionGzip": "gzip (recommended)",
    "backupCompressionNone": "None",
    "backupEncryption": "Encryption (AES-256)",
    "backupIncludeActivityLog": "Include activity log",
    "backupIncludeActivityLogNote": "(may result in large file size)",
    "backupNotifications": "Notifications",
    "backupNotifyEmail": "Notification email address",
    "backupNotifyOnFailure": "Notify on failure",
    "backupNotifyOnSuccess": "Notify on success"
  }
}
```

### 3.5 CLIのi18n実装

```typescript
// packages/cli/src/messages/ja.ts
export const messagesJa = {
  'agent.list.empty': 'エージェントがありません',
  'agent.created': 'エージェント {{name}} を作成しました',
  'agent.error.not_found': 'エージェント {{id}} が見つかりません',
  'issue.created': 'Issue {{id}} を作成しました',
  'command.help': 'ヘルプを表示',
  'command.version': 'バージョンを表示',
  'error.invalid_input': '無効な入力: {{message}}',
  'error.connection_failed': 'DB接続エラー: {{message}}'
}

// packages/cli/src/messages/en.ts
export const messagesEn = {
  'agent.list.empty': 'No agents found',
  'agent.created': 'Agent {{name}} created',
  'agent.error.not_found': 'Agent {{id}} not found',
  'issue.created': 'Issue {{id}} created',
  'command.help': 'Show help',
  'command.version': 'Show version',
  'error.invalid_input': 'Invalid input: {{message}}',
  'error.connection_failed': 'DB connection error: {{message}}'
}

// packages/cli/src/i18n.ts
import { messagesJa } from './messages/ja'
import { messagesEn } from './messages/en'

export class I18nManager {
  private language: 'ja' | 'en'

  constructor(lang: 'ja' | 'en' = 'ja') {
    this.language = lang
  }

  t(key: string, params?: Record<string, string>): string {
    const messages = this.language === 'ja' ? messagesJa : messagesEn
    let message = messages[key as keyof typeof messages] || key

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        message = message.replace(`{{${k}}}`, v)
      })
    }

    return message
  }
}

// cli.ts での使用
const i18n = new I18nManager(process.env.COMPANY_LANG === 'en' ? 'en' : 'ja')
console.log(i18n.t('agent.created', { name: 'MyAgent' }))
```

### 3.6 言語切り替えUI（設定画面）

```typescript
// packages/ui/src/components/settings/LanguageSelector.tsx
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

export function LanguageSelector() {
  const { i18n } = useTranslation()

  const handleLanguageChange = async (lang: 'ja' | 'en') => {
    // React-i18next で UI 言語を変更
    await i18n.changeLanguage(lang)

    // DB に言語設定を保存
    await fetch('/api/settings/general', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang })
    })

    // ローカルストレージにも保存（次回起動時に復元）
    localStorage.setItem('company-language', lang)
  }

  return (
    <select
      value={i18n.language}
      onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en')}
      className="px-4 py-2 border rounded"
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
    </select>
  )
}
```

### 3.7 新言語追加手順

1. `locales/[lang].json` を新規作成（ja.json をコピーして翻訳）
2. `i18n/i18n.ts` に resources を追加
3. `LanguageSelector.tsx` に選択肢を追加
4. 既存言語と同じ構造でキーを埋める

**例: スペイン語（es）を追加する場合**

```typescript
// i18n.ts
resources: {
  ja: { common: jaLocale },
  en: { common: enLocale },
  es: { common: esLocale }  // 追加
}

// LanguageSelector.tsx
<option value="es">Español</option>  // 追加
```

---

## 4. テスト仕様

### 4.1 テスト戦略（Googleテストピラミッド準拠）

```
         ▲ E2E（10%）
        ▲▲▲ 統合テスト（20%）
       ▲▲▲▲▲ 単体テスト（70%）

目標カバレッジ: 80%以上（Vitest）
```

### 4.2 単体テスト仕様（Vitest）

#### 4.2.1 packages/api/ テスト仕様

```
packages/api/src/
├── routes/
│   ├── agents.test.ts
│   ├── issues.test.ts
│   ├── goals.test.ts
│   ├── skills.test.ts
│   ├── routines.test.ts
│   ├── approvals.test.ts
│   ├── costs.test.ts
│   ├── auth.test.ts
│   └── org.test.ts
├── services/
│   ├── agent.service.test.ts
│   ├── issue.service.test.ts
│   └── ...
└── middleware/
    ├── auth.test.ts
    └── errorHandler.test.ts
```

**テストケース例: AgentController.getAgents**

```typescript
describe('AgentController.getAgents', () => {
  it('should return list of agents with pagination', async () => {
    const req = { query: { page: '1', limit: '20' } }
    const res = mockResponse()

    await getAgents(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      agents: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) })
      ]),
      total: expect.any(Number)
    })
  })

  it('should return 400 when invalid page number', async () => {
    const req = { query: { page: 'invalid' } }
    const res = mockResponse()

    await getAgents(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('should filter agents by status', async () => {
    const req = { query: { status: 'active' } }
    const res = mockResponse()

    await getAgents(req, res)

    const result = res.json.mock.calls[0][0]
    result.agents.forEach(agent => {
      expect(agent.status).toBe('active')
    })
  })
})
```

#### 4.2.2 packages/cli/ テスト仕様

```
packages/cli/src/
├── commands/
│   ├── agent.test.ts       // agent add / start / list 等
│   ├── issue.test.ts
│   ├── org.test.ts
│   └── ...
└── utils/
    ├── validators.test.ts
    └── formatters.test.ts
```

**テストケース例: agent add コマンド**

```typescript
describe('agent add command', () => {
  it('should create agent with valid config', async () => {
    const result = await executeCommand('agent', ['add', '--name', 'TestAgent', '--adapter', 'claude_local'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Agent TestAgent created')
  })

  it('should validate required fields', async () => {
    const result = await executeCommand('agent', ['add'])  // --name 不足

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('--name is required')
  })

  it('should handle database connection error', async () => {
    mockDB.connect.mockRejectedValueOnce(new Error('Connection failed'))

    const result = await executeCommand('agent', ['add', '--name', 'TestAgent'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('DB connection error')
  })
})
```

#### 4.2.3 packages/adapters/ テスト仕様

```
packages/adapters/src/
├── claude_local.test.ts
├── codex_local.test.ts
├── cursor.test.ts
├── gemini_local.test.ts
├── openclaw_gateway.test.ts
├── opencode_local.test.ts
└── pi_local.test.ts
```

**テストケース例: ClaudeLocalAdapter**

```typescript
describe('ClaudeLocalAdapter', () => {
  it('should detect Claude Code CLI', async () => {
    mockFS.existsSync.mockReturnValueOnce(true)  // claude コマンドが存在

    const adapter = new ClaudeLocalAdapter()
    const detected = await adapter.detectCli()

    expect(detected).toBe(true)
  })

  it('should execute task and return result', async () => {
    const context = {
      taskId: 'task-1',
      prompt: 'List all agents',
      maxTokens: 1000
    }

    const result = await adapter.execute(context)

    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
    expect(result.tokens).toEqual({
      input: expect.any(Number),
      output: expect.any(Number)
    })
  })

  it('should handle execution timeout', async () => {
    const context = { taskId: 'task-1', prompt: '...' }
    vi.useFakeTimers()
    vi.advanceTimersByTime(61000)  // 60秒超え

    expect(adapter.execute(context)).rejects.toThrow('Execution timeout')
  })
})
```

#### 4.2.4 packages/db/ テスト仕様

```
packages/db/__tests__/
├── schema.test.ts         // テーブル定義
├── migrations.test.ts     // マイグレーション正確性
└── queries.test.ts        // よく使う複雑なクエリ
```

**テストケース例: DB スキーマ**

```typescript
describe('Database schema', () => {
  it('should have agents table with required columns', async () => {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agents'
    `)

    const columnNames = result.map(r => r.column_name)
    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('adapter_type')
    expect(columnNames).toContain('config')
    expect(columnNames).toContain('created_at')
  })

  it('should enforce foreign key constraint on issues', async () => {
    const issueWithInvalidAgent = {
      title: 'Test',
      agent_id: 'non-existent-agent-id'
    }

    expect(
      db.insert(issues).values(issueWithInvalidAgent)
    ).rejects.toThrow('Foreign key constraint')
  })
})
```

### 4.3 統合テスト仕様（Docker環境）

```bash
# Docker Compose で PostgreSQL + API サーバーを起動した状態でテスト実行
docker-compose -f docker-compose.test.yml up -d
pnpm test:integration

# テスト項目例:
# 1. 認証フロー（ログイン → APIキー取得 → 認証済みリクエスト実行）
# 2. エージェント作成 → ハートビート実行 → ログ保存
# 3. Issue作成 → コメント追加 → ステータス変更
# 4. ゴール作成 → Issue紐付け → 進捗率計算
# 5. 予算設定 → コスト累積 → 超過アラート
```

### 4.4 E2Eテスト仕様（Playwright）

```
packages/ui/__tests__/e2e/
├── auth.spec.ts          → ログイン〜初期画面表示
├── dashboard.spec.ts     → ダッシュボード表示・メトリクス
├── agents.spec.ts        → エージェント作成〜実行
├── issues.spec.ts        → Issue作成〜ステータス更新
├── goals.spec.ts         → ゴール作成〜進捗管理
├── i18n.spec.ts          → 言語切り替え確認
└── error-handling.spec.ts → エラー画面・エラーメッセージ
```

**テストケース例: auth.spec.ts**

```typescript
describe('Authentication Flow', () => {
  test('user can login and access dashboard', async ({ page }) => {
    // 1. ログインページへアクセス
    await page.goto('http://localhost:5173/auth/login')

    // 2. メールアドレスを入力
    await page.fill('input[name="email"]', 'test@example.com')

    // 3. パスワードを入力
    await page.fill('input[name="password"]', 'password123')

    // 4. ログインボタンをクリック
    await page.click('button:has-text("ログイン")')

    // 5. ダッシュボードへリダイレクトされることを確認
    await page.waitForURL('http://localhost:5173/dashboard')
    expect(page.url()).toContain('/dashboard')

    // 6. ダッシュボード要素が表示されることを確認
    await expect(page.locator('h1:has-text("ダッシュボード")')).toBeVisible()
  })

  test('displays error message for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:5173/auth/login')
    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button:has-text("ログイン")')

    await expect(page.locator('text=メールアドレスまたはパスワードが正しくありません')).toBeVisible()
  })

  test('language switcher works correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/auth/login')

    // 言語をEnglishに変更
    await page.selectOption('select[name="language"]', 'en')

    // UI が英語に変わることを確認
    await expect(page.locator('button:has-text("Login")')).toBeVisible()
    await expect(page.locator('button:has-text("ログイン")')).not.toBeVisible()
  })
})
```

### 4.5 テストカバレッジ目標

```
総合目標: 80%以上

内訳:
- packages/api/: 85% （重要な動作保証）
- packages/cli/: 80% （コマンドロジック）
- packages/ui/: 75% （UI コンポーネント・インテグレーション）
- packages/adapters/: 90% （各アダプターの正確性）
- packages/db/: 80% （スキーマ・マイグレーション）

計測コマンド:
pnpm test -- --coverage
→ coverage/index.html で確認
```

---

## 5. Phase別テスト計画

### 5.1 Phase 1（Core Foundation）テスト計画

**対象機能**: 初期化・組織設定・i18n基盤

**テスト項目**:
- [ ] `company init --docker` が正常に完了できる
- [ ] `company init --native --db-url` で外部DB接続できる
- [ ] `company org show` が組織情報を正しく表示する
- [ ] `i18n.changeLanguage()` で UI全体が言語切り替わる
- [ ] `.company/CLAUDE.md` から組織情報が正しくインポートされる

**テスト実行**:
```bash
pnpm test --testPathPattern="phase1"
pnpm test:integration
pnpm test:e2e -- auth.spec.ts
```

---

### 5.2 Phase 2（Agent System）テスト計画

**対象機能**: エージェント登録・ハートビート・アダプター

**テスト項目**:
- [ ] 7種のアダプター全てが登録可能
- [ ] ハートビート実行が成功してログが保存される
- [ ] クラッシュ後の状態が正確に回復される
- [ ] トークン使用量が正確に計算・記録される
- [ ] API Key 認証が動作する

**テスト実行**:
```bash
pnpm test --testPathPattern="agent"
pnpm test:integration -- agent-create-flow.test.tsx
```

---

### 5.3 Phase 3（Issue & Goal）テスト計画

**対象機能**: Issue・Goal管理・自動採番

**テスト項目**:
- [ ] Issue が `COMP-1` 形式で自動採番される
- [ ] ステータス遷移が正確に記録される
- [ ] ラベル・アサイン先が正しく保存される
- [ ] ゴール達成率が正確に計算される
- [ ] Issue↔Goal 紐付けが動作する

**テスト実行**:
```bash
pnpm test --testPathPattern="issue|goal"
pnpm test:e2e -- issues.spec.ts
```

---

## 6. セキュリティ実装仕様

### 6.1 Better Auth 設定詳細

```typescript
// packages/api/src/auth/index.ts
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  database: {
    type: "postgres",
    url: process.env.DATABASE_URL
  },
  secret: process.env.JWT_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL],
  // APIキー設定
  plugins: [
    apiKeyPlugin({
      algorithm: "bcrypt",
      expiresIn: 90 * 24 * 60 * 60,  // 90日
      validate: async (key) => {
        // キー有効性チェック・レート制限確認
        const usage = await redis.get(`api-key-usage:${key}:${TODAY}`)
        return parseInt(usage || '0') < API_RATE_LIMIT
      }
    })
  ]
})
```

### 6.2 AES-256-GCM シークレット暗号化

```typescript
// packages/shared/src/utils/crypto.ts
import crypto from 'crypto'

export function encryptSecret(
  plaintext: string,
  masterKey: string
): EncryptedSecret {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    ciphertext,
    tag: tag.toString('base64'),
    algorithm: 'aes-256-gcm'
  }
}

export function decryptSecret(
  encrypted: EncryptedSecret,
  masterKey: string
): string {
  const iv = Buffer.from(encrypted.iv, 'base64')
  const tag = Buffer.from(encrypted.tag, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(tag)

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}
```

### 6.3 入力バリデーション（Zod）

```typescript
// packages/shared/src/validators/index.ts
import { z } from 'zod'

export const AgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  adapterType: z.enum(['claude_local', 'codex_local', 'cursor', 'gemini_local', 'openclaw_gateway', 'opencode_local', 'pi_local']),
  config: z.record(z.any())
})

export const IssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  dueDate: z.date().optional(),
  labels: z.array(z.string()).optional()
})

// ルートハンドラで使用
app.post('/api/issues', async (req, res) => {
  const validated = IssueSchema.parse(req.body)  // throws ZodError if invalid
  // ...
})
```

### 6.4 CORS設定

```typescript
// packages/api/src/middleware/cors.ts
import cors from 'cors'

export const corsMiddleware = cors({
  origin: [
    process.env.FRONTEND_URL,  // http://localhost:5173
    'https://company.example.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
})
```

### 6.5 レートリミット

```typescript
// packages/api/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分
  max: 100,                   // 15分あたり100リクエスト
  standardHeaders: true,      // `RateLimit-*` ヘッダーを返す
  legacyHeaders: false        // `X-RateLimit-*` は無効化
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // 認証はより厳しい制限
  skip: (req) => req.method === 'GET'
})
```

---

## 7. UIビルド設定（vite.config.ts）

### 7.1 vite.config.ts の build 設定（TypeScript ビルドエラー修正）

**修正内容**: TypeScript のビルドターゲットを `esnext` に設定し、トランスパイルエラーを回避

```typescript
// packages/ui/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',  // ← 新規追加（2026-04-03 Codex修正で追加）
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**背景**: UI ビルド時に TypeScript トランスパイルの互換性問題が発生していたため、ターゲットを `esnext` に明示的に設定

---

## 改訂履歴

| 版 | 作成日 | 変更内容 | 担当 |
|----|--------|---------|------|
| v2.1 | 2026-04-03 | PR#1 変更内容を反映：RegisterPage.tsx に name フィールド追加・API呼び出しに name を含める、vite.config.ts に build.target: esnext 追加 | 開発部第2課（Yena） |
| v1.0 | 2026-04-03 | 初版作成：40画面UI設計・i18n詳細（ja/en 100+キー）・テスト仕様（単体/統合/E2E）・セキュリティ実装 | 開発部（Yena × Lucas × Hana） |

---

**End of Part3 Design Document**
