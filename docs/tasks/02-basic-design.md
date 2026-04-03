# 基本設計書 — タスク直接実行API

**バージョン**: 1.0.0
**作成日**: 2026-04-04

---

## 1. API一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /api/tasks | エージェントにタスクを実行させる |
| GET | /api/tasks | タスク実行履歴一覧（agent_task_sessions） |

---

## 2. データフロー

```
POST /api/tasks
  → エージェント存在確認（テナントチェック）
  → enabled 確認
  → agent_task_sessions INSERT (status=running)
  → createAdapter(type).runTask({ taskId, prompt, context })
  → agent_task_sessions UPDATE (status=completed/failed, result)
  → レスポンス返却
```

---

## 3. 実装対象ファイル

| ファイル | 種別 | 内容 |
|----------|------|------|
| packages/api/src/routes/tasks.ts | 新規 | POST/GET 実装 |
| packages/api/src/server.ts | 追記 | tasksRouter 登録 |
| packages/api/src/__tests__/tasks.test.ts | 新規 | 単体テスト |
