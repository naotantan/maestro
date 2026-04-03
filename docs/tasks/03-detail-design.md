# 詳細設計書 — タスク直接実行API

**バージョン**: 1.0.0
**作成日**: 2026-04-04

---

## 1. POST /api/tasks

**リクエスト**:
```json
{
  "agent_id": "uuid",
  "prompt": "タスク指示",
  "context": "任意のコンテキスト文字列"
}
```

**バリデーション**:
- agent_id, prompt 必須
- エージェントが同一 company_id に属すること
- エージェントが enabled=true であること

**レスポンス (200)**:
```json
{
  "data": {
    "session_id": "uuid",
    "agent_id": "uuid",
    "output": "エージェントの回答",
    "finish_reason": "complete",
    "started_at": "ISO8601",
    "completed_at": "ISO8601"
  }
}
```

**エラー**:
| ケース | HTTP | コード |
|--------|------|--------|
| 必須欠落 | 400 | validation_failed |
| 別テナント | 400 | validation_failed |
| 無効エージェント | 400 | agent_disabled |
| 実行失敗 | 200 | finishReason=error |

---

## 2. GET /api/tasks

- クエリ: limit, offset, agent_id (optional filter)
- agent_task_sessions を company 内の全エージェントで絞り込んで返す

---

## 3. テスト仕様

| TC-ID | テストケース | 期待結果 |
|-------|-------------|---------|
| UT-01 | 正常実行 | 200 / output あり |
| UT-02 | agent_id 欠落 | 400 / validation_failed |
| UT-03 | prompt 欠落 | 400 / validation_failed |
| UT-04 | 別テナントエージェント | 400 / validation_failed |
| UT-05 | disabled エージェント | 400 / agent_disabled |
| UT-06 | アダプター実行失敗 | 200 / finish_reason=error |
| UT-07 | 一覧取得 | 200 / data配列 |
