# テスト仕様書 — エージェント間引き継ぎ機能

**バージョン**: 1.0.0  
**作成日**: 2026-04-04

---

## 単体テスト仕様

### テスト対象: POST /api/handoffs

| TC-ID | テストケース | 期待結果 |
|-------|-------------|---------|
| UT-01 | 正常登録（必須項目のみ） | 201 / status=pending |
| UT-02 | 正常登録（issue_id 付き） | 201 / issue_id が保存される |
| UT-03 | from_agent_id 欠落 | 400 / validation_failed |
| UT-04 | to_agent_id 欠落 | 400 / validation_failed |
| UT-05 | prompt 欠落 | 400 / validation_failed |
| UT-06 | from_agent_id === to_agent_id | 400 / validation_failed |
| UT-07 | 別テナントのエージェント指定 | 400 / validation_failed |

### テスト対象: GET /api/handoffs

| TC-ID | テストケース | 期待結果 |
|-------|-------------|---------|
| UT-08 | 一覧取得 | 200 / data配列 / テナント分離済み |
| UT-09 | status フィルタ | 200 / 指定ステータスのみ返る |

### テスト対象: GET /api/handoffs/:id

| TC-ID | テストケース | 期待結果 |
|-------|-------------|---------|
| UT-10 | 存在するID | 200 / オブジェクト |
| UT-11 | 存在しないID | 404 |
| UT-12 | 別テナントのID | 404 |

### テスト対象: PATCH /api/handoffs/:id/cancel

| TC-ID | テストケース | 期待結果 |
|-------|-------------|---------|
| UT-13 | pending のキャンセル | 200 / status=cancelled |
| UT-14 | running のキャンセル | 409 / invalid_state |
| UT-15 | completed のキャンセル | 409 / invalid_state |

---

## 受け入れテスト仕様

### AT-01: 手動引き継ぎ登録→実行確認

**前提**: codex がインストール済み・ログイン済み

```bash
# 1. エージェント登録
AGENT_A=$(curl -s -X POST http://localhost:3000/api/agents \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Claude Agent","type":"claude_local"}' | jq -r .data.id)

AGENT_B=$(curl -s -X POST http://localhost:3000/api/agents \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Codex Agent","type":"codex_local"}' | jq -r .data.id)

# 2. 引き継ぎ登録
HANDOFF_ID=$(curl -s -X POST http://localhost:3000/api/handoffs \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"from_agent_id\":\"$AGENT_A\",\"to_agent_id\":\"$AGENT_B\",\"prompt\":\"Hello, respond in one sentence.\"}" \
  | jq -r .data.id)

# 3. ステータス確認（pending）
curl -s http://localhost:3000/api/handoffs/$HANDOFF_ID \
  -H "X-API-Key: $API_KEY" | jq .data.status
# → "pending"

# 4. エンジン実行待ち（30秒）またはエンジン手動トリガー後
# → status が completed になること
# → result に to_agent の出力が入ること
```

**合否基準**:
- [ ] AT-01-1: handoff が pending で登録される
- [ ] AT-01-2: エンジンが自動実行し completed になる
- [ ] AT-01-3: result に codex の出力が含まれる
- [ ] AT-01-4: テナント外から取得不可（401/404）

---

## 評価ループ（5軸×5点 = 25点満点）

| 軸 | 評価観点 | 配点 |
|----|----------|------|
| 機能性 | FR-01〜FR-08 が全て動作するか | /5 |
| 安全性 | テナント分離・バリデーション | /5 |
| 信頼性 | エラー時に failed 記録・クラッシュなし | /5 |
| 保守性 | 既存コードとの一貫性・型安全 | /5 |
| テスト | UT全15件PASS / AT全4項目PASS | /5 |

**合格ライン**: 25/25 のみ合格。24点以下は設計書から見直し。
