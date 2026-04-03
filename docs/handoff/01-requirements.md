# 要件定義書 — エージェント間引き継ぎ機能

**バージョン**: 1.0.0  
**作成日**: 2026-04-04  
**対象**: company-cli コミュニティ版

---

## 1. 背景・目的

company-cli は複数の AI エージェント（claude_local / codex_local 等）を管理するバックエンドである。
現状、各エージェントは独立して動作しており、エージェント間でタスクを引き継ぐ仕組みが存在しない。

本機能は、エージェント A が完了したタスクの出力を、エージェント B の入力（context）として自動的に渡す「引き継ぎ（handoff）」を実現する。

---

## 2. 機能要件

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-01 | 引き継ぎ（handoff）をDBに登録できる | Must |
| FR-02 | 登録時に from_agent_id / to_agent_id / prompt を指定する | Must |
| FR-03 | 引き継ぎ実行時、from_agent の最新出力を context として to_agent に渡す | Must |
| FR-04 | 引き継ぎステータスを pending → running → completed/failed で管理する | Must |
| FR-05 | ハートビートエンジンが pending の引き継ぎを自動実行する | Must |
| FR-06 | API で引き継ぎ一覧・詳細を取得できる | Must |
| FR-07 | issue_id を任意で紐付けられる | Should |
| FR-08 | 引き継ぎをキャンセル（cancelled）できる | Should |

---

## 3. 非機能要件

| ID | 要件 |
|----|------|
| NFR-01 | テナント分離: 全操作に company_id フィルタを適用する |
| NFR-02 | 引き継ぎ実行タイムアウトはエージェント config.timeout（デフォルト120秒）に従う |
| NFR-03 | 引き継ぎ失敗時はステータスを failed にし、エラー内容を記録する |
| NFR-04 | 既存 API との破壊的変更なし |

---

## 4. 制約条件

- TypeScript strict モード準拠
- Drizzle ORM を使用（生SQL禁止）
- 新規エンドポイントには単体テストを追加する

---

## 5. 用語定義

| 用語 | 定義 |
|------|------|
| handoff | あるエージェントから別エージェントへのタスク引き継ぎ |
| from_agent | 引き継ぎ元エージェント |
| to_agent | 引き継ぎ先エージェント |
| context | from_agent の実行結果を to_agent に渡す文字列 |
| prompt | to_agent に実行させるタスク指示 |
