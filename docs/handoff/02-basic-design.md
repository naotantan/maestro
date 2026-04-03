# 基本設計書 — エージェント間引き継ぎ機能

**バージョン**: 1.0.0  
**作成日**: 2026-04-04

---

## 1. システム構成図

```
[クライアント / CLI]
       │ POST /api/handoffs
       ▼
[API サーバー (Express)]
  ├── /api/handoffs ─── handoffsRouter (新規)
  └── /api/agents   ─── agentsRouter (既存)
       │
       ▼
[PostgreSQL (Drizzle ORM)]
  ├── agents         (既存)
  ├── agent_task_sessions (既存)
  └── agent_handoffs (新規 H12)
       │
       ▼
[HeartbeatEngine (拡張)]
  processHandoffs() が pending 引き継ぎを自動実行
       │
       ├── from_agent の最新 result を取得
       └── createAdapter(to_agent.type) → runTask({ prompt, context })
```

---

## 2. 新規テーブル: agent_handoffs (H12)

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| company_id | uuid FK | テナント分離キー |
| from_agent_id | uuid FK → agents.id | 引き継ぎ元 |
| to_agent_id | uuid FK → agents.id | 引き継ぎ先 |
| issue_id | uuid nullable FK → issues.id | 関連 Issue（任意） |
| status | varchar(20) | pending / running / completed / failed / cancelled |
| prompt | text NOT NULL | to_agent へのタスク指示 |
| context | text nullable | from_agent の出力（自動セット） |
| result | text nullable | to_agent の実行結果 |
| error | text nullable | 失敗時エラー内容 |
| created_at | timestamp | |
| started_at | timestamp nullable | |
| completed_at | timestamp nullable | |

---

## 3. API 一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /api/handoffs | 引き継ぎ登録（pending） |
| GET | /api/handoffs | 一覧取得（company_id フィルタ） |
| GET | /api/handoffs/:id | 詳細取得 |
| PATCH | /api/handoffs/:id/cancel | キャンセル（pending のみ） |

---

## 4. データフロー

```
1. POST /api/handoffs
   → agent_handoffs INSERT (status=pending)
   → 201 Created

2. HeartbeatEngine.processHandoffs() (30秒毎)
   → SELECT pending handoffs
   → status = running
   → agent_task_sessions から from_agent の最新 result 取得
   → createAdapter(to_agent.type).runTask({ prompt, context: result })
   → status = completed (result 保存) or failed (error 保存)
```

---

## 5. エンジン拡張方針

- `heartbeat-engine.ts` の `runAllHeartbeats()` の末尾に `processHandoffs()` を追加
- `processHandoffs()` は同ファイル内に実装（依存の局所化）
- 最大2並列で pending handoff を処理する
