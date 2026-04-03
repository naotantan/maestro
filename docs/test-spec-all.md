# company-cli 全機能 テスト仕様書

**作成日**: 2026-04-04  
**対象バージョン**: main (fe441e3)  
**テスト種別**: ブラックボックステスト（BBT）+ 単体テスト（UT）  
**テスト実施者**: コンサル部

---

## 1. テスト対象一覧

### 1.1 APIエンドポイント（16ルート / 57エンドポイント）

| ルートファイル | エンドポイント数 | 主な機能 |
|---|---|---|
| health.ts | 1 | ヘルスチェック |
| auth.ts | 2 | 登録・ログイン |
| companies.ts | 3 | 企業情報・メンバー・APIキー |
| org.ts | 7 | 組織管理・参加リクエスト |
| agents.ts | 7 | エージェントCRUD・ハートビート・実行履歴 |
| handoffs.ts | 4 | **エージェント間引き継ぎ（新機能）** |
| tasks.ts | 2 | **タスク直接実行（新機能）** |
| issues.ts | 9 | Issue CRUD・コメント・ゴール連携 |
| goals.ts | 6 | ゴールCRUD・再計算 |
| projects.ts | 6 | プロジェクトCRUD・ワークスペース |
| routines.ts | 5 | ルーティンCRUD・手動実行 |
| costs.ts | 4 | コスト記録・予算管理 |
| settings.ts | 2 | 設定取得・更新 |
| approvals.ts | 3 | 承認フロー |
| activity.ts | 1 | アクティビティログ |
| plugins.ts | 10 | プラグイン・ジョブ・Webhook |

---

## 2. テストケース一覧

### BBT-01: ヘルスチェック

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-01-01 | 正常応答 | GET /health | 200, status=ok, database=connected | ✅ PASS |
| BBT-01-02 | 認証不要 | GET /health (no auth) | 200 (認証なしでアクセス可) | ✅ PASS |

---

### BBT-02: 認証 (auth)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-02-01 | ユーザー登録（正常） | POST /auth/register {email, password, name, companyName} | 201, apiKey, company.name | ✅ PASS |
| BBT-02-02 | 登録（フィールド不足） | POST /auth/register {email, password, name} | 400, validation_failed | ✅ PASS |
| BBT-02-03 | 登録（メール重複） | POST /auth/register {重複email} | 409, email_taken | ✅ PASS |
| BBT-02-04 | ログイン（正常） | POST /auth/login {email, password} | 200, apiKey | ✅ PASS |
| BBT-02-05 | ログイン（不正認証情報） | POST /auth/login {wrong credentials} | 401, エラーメッセージ | ✅ PASS |
| BBT-02-06 | 認証なしアクセス | GET /api/agents (no token) | 401, unauthorized | ✅ PASS |

---

### BBT-03: 企業・組織 (companies / org)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-03-01 | 企業情報取得 | GET /companies | 200, id, name | ✅ PASS |
| BBT-03-02 | メンバー一覧 | GET /companies/:id/members | 200, count>=1 | ✅ PASS |
| BBT-03-03 | APIキー発行 | POST /companies/:id/api-keys {name} | 200, apiKey(comp_live_...) | ✅ PASS |
| BBT-03-04 | 組織情報取得 | GET /org | 200, id, name | ✅ PASS |
| BBT-03-05 | 組織情報更新 | PATCH /org {description} | 200, 更新後のdescription | ✅ PASS |
| BBT-03-06 | メンバー一覧 | GET /org/members | 200, count>=1 | ✅ PASS |
| BBT-03-07 | 参加リクエスト一覧 | GET /org/join-requests | 200, count>=0 | ✅ PASS |

---

### BBT-04: エージェント (agents)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-04-01 | エージェント一覧 | GET /agents | 200, count>=0 | ✅ PASS |
| BBT-04-02 | エージェント作成 | POST /agents {name, type, description} | 201, name, type, agentApiKey | ✅ PASS |
| BBT-04-03 | エージェント取得 | GET /agents/:id | 200, id, name, type | ✅ PASS |
| BBT-04-04 | エージェント更新 | PATCH /agents/:id {description} | 200, 更新後のdescription | ✅ PASS |
| BBT-04-05 | ハートビート送信 | POST /agents/:id/heartbeat | 200, success=true | ✅ PASS |
| BBT-04-06 | 実行履歴取得 | GET /agents/:id/runs | 200, count>=0 | ✅ PASS |

---

### BBT-05: エージェント間引き継ぎ (handoffs) ★新機能

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-05-01 | 引き継ぎ作成（A→B） | POST /handoffs {from_agent_id, to_agent_id, prompt} | 201, status=pending, chain_id=id | ✅ PASS |
| BBT-05-02 | チェーン引き継ぎ作成（A→B→C） | POST /handoffs {next_agent_id, next_prompt} | 201, next_agent_id設定済み | ✅ PASS |
| BBT-05-03 | 引き継ぎ取得 | GET /handoffs/:id | 200, id, status | ✅ PASS |
| BBT-05-04 | 引き継ぎキャンセル | PATCH /handoffs/:id/cancel | 200, status=cancelled | ✅ PASS |
| BBT-05-05 | 一覧取得（全件） | GET /handoffs | 200, count>=0 | ✅ PASS |
| BBT-05-06 | 一覧取得（status絞り込み） | GET /handoffs?status=pending | 200, pending件のみ | ✅ PASS |
| BBT-05-07 | 一覧取得（chain_id絞り込み） | GET /handoffs?chain_id=:id | 200, 該当チェーン | ✅ PASS |

---

### BBT-06: タスク直接実行 (tasks) ★新機能

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-06-01 | タスク実行 | POST /tasks {agent_id, prompt, context} | 200, session_id, finish_reason | ✅ PASS |
| BBT-06-02 | 実行履歴取得（全件） | GET /tasks | 200, count>=0 | ✅ PASS |
| BBT-06-03 | 実行履歴取得（agent_id絞り込み） | GET /tasks?agent_id=:id | 200, 該当エージェント | ✅ PASS |

---

### BBT-07: Issue管理 (issues)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-07-01 | Issue一覧 | GET /issues | 200, count>=0 | ✅ PASS |
| BBT-07-02 | Issue作成 | POST /issues {title, description, type} | 201, id, title | ✅ PASS |
| BBT-07-03 | Issue取得 | GET /issues/:id | 200, id, title | ✅ PASS |
| BBT-07-04 | Issue更新 | PATCH /issues/:id {status} | 200, 更新後のstatus | ✅ PASS |
| BBT-07-05 | コメント一覧 | GET /issues/:id/comments | 200, count>=0 | ✅ PASS |
| BBT-07-06 | ゴール一覧 | GET /issues/:id/goals | 200, count>=0 | ✅ PASS |
| BBT-07-07 | ゴール連携 | POST /issues/:id/goals {goal_id} | 200, issue_id, goal_id | ✅ PASS |
| BBT-07-08 | ゴール連携解除 | DELETE /issues/:id/goals/:goalId | 200, success=true | ✅ PASS |
| BBT-07-09 | Issue取得（存在しない） | GET /issues/invalid-id | 404, not_found | ✅ PASS |

---

### BBT-08: ゴール管理 (goals)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-08-01 | ゴール一覧 | GET /goals | 200, count>=0 | ✅ PASS |
| BBT-08-02 | ゴール作成 | POST /goals {name, description} | 201, id, name | ✅ PASS |
| BBT-08-03 | ゴール取得 | GET /goals/:id | 200, id, name | ✅ PASS |
| BBT-08-04 | ゴール更新 | PATCH /goals/:id {description} | 200, 更新後データ | ✅ PASS |
| BBT-08-05 | 進捗再計算 | POST /goals/:id/recalculate | 200, progress, total_issues | ✅ PASS |
| BBT-08-06 | ゴール取得（存在しない） | GET /goals/invalid-id | 404, not_found | ✅ PASS |

---

### BBT-09: プロジェクト管理 (projects)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-09-01 | プロジェクト一覧 | GET /projects | 200, count>=0 | ✅ PASS |
| BBT-09-02 | プロジェクト作成 | POST /projects {name, description} | 201, id, name | ✅ PASS |
| BBT-09-03 | プロジェクト取得 | GET /projects/:id | 200, id, name | ✅ PASS |
| BBT-09-04 | プロジェクト更新 | PATCH /projects/:id {description} | 200, 更新後データ | ✅ PASS |
| BBT-09-05 | ワークスペース一覧 | GET /projects/:id/workspaces | 200, count>=0 | ✅ PASS |

---

### BBT-10: ルーティン管理 (routines)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-10-01 | ルーティン一覧 | GET /routines | 200, count>=0 | ✅ PASS |
| BBT-10-02 | ルーティン作成 | POST /routines {name, cron_expression, agent_id, prompt} | 201, id, name | ✅ PASS |
| BBT-10-03 | ルーティン取得 | GET /routines/:id | 200, id, name | ✅ PASS |
| BBT-10-04 | ルーティン手動実行 | POST /routines/:id/run | 200, status=success | ✅ PASS |

---

### BBT-11: コスト管理 (costs)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-11-01 | コスト一覧 | GET /costs | 200, count>=0 | ✅ PASS |
| BBT-11-02 | コスト記録 | POST /costs {agent_id, model, input_tokens, output_tokens, cost_usd} | 201, id | ✅ PASS |
| BBT-11-03 | 予算取得 | GET /costs/budget | 200, data | ✅ PASS |
| BBT-11-04 | 予算設定 | POST /costs/budget {limit_amount_usd, period, alert_threshold} | 200, limit_amount_usd, period | ✅ PASS |

---

### BBT-12: 設定管理 (settings)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-12-01 | 設定取得 | GET /settings | 200, anthropicApiKey, hasAnthropicApiKey | ✅ PASS |
| BBT-12-02 | APIキー更新 | PATCH /settings {anthropicApiKey} | 200, hasAnthropicApiKey=true | ✅ PASS |

---

### BBT-13: アクティビティログ (activity)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-13-01 | アクティビティ一覧 | GET /activity | 200, count>=0 | ✅ PASS |

---

### BBT-14: 承認フロー (approvals)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-14-01 | 承認一覧 | GET /approvals | 200, count>=0 | ✅ PASS |
| BBT-14-02 | 承認（存在しないID） | POST /approvals/invalid-id/approve | 404, not_found | ✅ PASS |

---

### BBT-15: プラグイン管理 (plugins)

| ID | テスト名 | 入力 | 期待結果 | 結果 |
|---|---|---|---|---|
| BBT-15-01 | プラグイン一覧 | GET /plugins | 200, count>=0 | ✅ PASS |
| BBT-15-02 | プラグイン作成 | POST /plugins {name, endpoint, secret} | 201, id, name | ✅ PASS |
| BBT-15-03 | プラグイン取得 | GET /plugins/:id | 200, id, name | ✅ PASS |
| BBT-15-04 | プラグイン更新 | PATCH /plugins/:id {description} | 200, id, description | ✅ PASS |
| BBT-15-05 | ジョブ一覧 | GET /plugins/:id/jobs | 200, count>=0 | ✅ PASS |
| BBT-15-06 | ジョブ作成 | POST /plugins/:id/jobs {name, trigger, prompt, agent_id} | 201, id, name | ✅ PASS |
| BBT-15-07 | ジョブ手動実行 | POST /plugins/:id/jobs/:jobId/run | 200, status=completed | ✅ PASS |
| BBT-15-08 | Webhook一覧 | GET /plugins/:id/webhooks | 200, count>=0 | ✅ PASS |
| BBT-15-09 | Webhook作成 | POST /plugins/:id/webhooks {url, events[]} | 201, id, url | ✅ PASS |

---

## 3. 単体テスト (UT) 結果

| パッケージ | テストファイル | テスト数 | 結果 |
|---|---|---|---|
| shared | constants.test.ts | 4 | ✅ PASS |
| cli | config.test.ts | 3 | ✅ PASS |
| adapters | adapters.test.ts | 6 | ✅ PASS |
| api | w9-security-whitebox.test.ts | 27 | ✅ PASS |
| api | tasks.test.ts | 7 | ✅ PASS |
| api | handoffs.test.ts | 15 | ✅ PASS |
| api | settings.test.ts | 35 | ✅ PASS |
| api | middleware.test.ts | 3 | ✅ PASS |
| api | companies.test.ts | 2 | ✅ PASS |
| api | auth.test.ts | 4 | ✅ PASS |
| api | crypto.test.ts | 3 | ✅ PASS |
| api | health.test.ts | 1 | ✅ PASS |
| **合計** | **12ファイル** | **110** | **✅ 全PASS** |

---

## 4. CI/CD 確認

| チェック項目 | 結果 |
|---|---|
| GitHub Actions CI (最新ラン) | ✅ 成功 (run #23961543729) |
| typecheck 全パッケージ | ✅ PASS |
| pnpm test 全パッケージ | ✅ PASS |
| ビルド（shared/db/i18n/adapters） | ✅ PASS |

---

## 5. テスト除外項目

| 項目 | 除外理由 |
|---|---|
| DELETE /agents/:id | テスト環境のエージェントを削除しないため |
| DELETE /goals/:id | 連携テスト後に削除済み |
| DELETE /issues/:id | 連携テスト後に削除済み |
| DELETE /projects/:id | テスト後に削除済み |
| DELETE /routines/:id | テスト後に削除済み |
| DELETE /plugins/:id | テスト後に削除済み |
| POST /org/join-requests/:id/approve | 参加リクエスト0件のため |
| POST /org/join-requests/:id/deny | 参加リクエスト0件のため |
| POST /approvals/:id/approve | 承認待ち0件のため |
| POST /approvals/:id/reject | 承認待ち0件のため |
| HeartbeatEngine 自動引き継ぎ実行 | E2Eテスト（codex CLI）で確認済み |
