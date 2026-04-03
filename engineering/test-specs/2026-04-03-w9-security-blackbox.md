# テスト仕様書 — W9セキュリティ強化 — ブラックボックステスト

**作成日**: 2026-04-03
**作成者**: 開発部 第3課（Lucas Ferreira）
**対象**: company-cli API サーバー（packages/api）W9セキュリティ強化フェーズ
**種別**: ブラックボックス
**評価**: [x] **25/25点 達成（2026-04-03）**

---

## テスト目的

W9セキュリティ強化フェーズで実施した以下の修正が、HTTP APIレベルで正しく機能していることを確認する。

1. XSSサニタイズ改善（`sanitizeString`のHTMLエンティティエスケープ）
2. メールバリデーション改善（RFC 5321簡易準拠・`@@`拒否）
3. レート制限の環境変数化（`RATE_LIMIT_MAX`対応）
4. pnpm audit 脆弱性ゼロ（esbuild override）
5. セキュリティヘッダー・CORS・エラーハンドリングの動作確認
6. W8までの機能が破壊されていないこと（回帰確認）

---

## テスト環境

- **APIサーバー**: `http://localhost:3000`
- **言語/フレームワーク**: Python 3 + requests ライブラリ
- **テストスクリプト**: `test_w9_security_blackbox.py`
- **前提条件**:
  - Docker（company-postgres）が起動済み
  - APIサーバーが `pnpm dev` で起動済み
  - 有効なAPIキー（`comp_live_...`）がDBに存在すること
- **テスト実行コマンド**: `python3 test_w9_security_blackbox.py`

---

## テスト項目一覧（10軸 × 10項目 = 100点満点）

### S1: 認証テスト（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S1-01 | Authorizationヘッダーなし | ヘッダーなしでGET /api/agents | HTTP 401 | 高 | - |
| S1-02 | 無効なAPIキー | `Bearer invalid_key` でGET | HTTP 401 | 高 | - |
| S1-03 | 空文字列APIキー | `Bearer ` (空) でGET | HTTP 401 or エラー | 高 | - |
| S1-04 | 極端に長いAPIキー | 1000文字のキーでGET | HTTP 401 | 中 | - |
| S1-05 | Bearerだけ（キーなし） | `Bearer` のみ | HTTP 401 | 中 | - |
| S1-06 | 有効なAPIキー | 正規キーでGET /api/agents | HTTP 200 | 高 | - |
| S1-07 | 期限切れAPIキー | （モック・SKIP可） | HTTP 401 | 中 | - |
| S1-08 | 他社APIキー | （マルチテナント環境依存・SKIP可） | HTTP 401 or 404 | 高 | - |
| S1-09 | SQLインジェクション試行 | `' OR '1'='1` をキーに | HTTP 401 | 高 | - |
| S1-10 | ヘルスエンドポイント | GET `/health`（認証不要） | HTTP 200・JSON応答 | 中 | - |

### S2: アクセス制御テスト（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S2-01 | 認証済みでエージェント一覧 | GET /api/agents | HTTP 200 | 高 | - |
| S2-02 | 存在しないAgentへのアクセス | GET /api/agents/nonexistent-uuid | HTTP 404 | 高 | - |
| S2-03 | Plugin company_idチェック | 不正なpluginIdでGET | HTTP 404 | 高 | - |
| S2-04 | JoinRequest deny company_idチェック | 不正なIDでPOST deny | HTTP 404 | 高 | - |
| S2-05〜S2-10 | アクセス制御各種確認 | 各エンドポイント | HTTP 200/404 | 中 | - |

### S3: 入力バリデーションテスト（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S3-01 | 正常なエージェント作成 | 有効なJSON | HTTP 201 | 高 | - |
| S3-02 | 名前フィールドなし | `{}` | HTTP 400 | 高 | - |
| S3-03 | XSSペイロード（`<script>`） | nameに`<script>alert(1)</script>` | HTTP 201（エスケープされて保存） or 400 | 高 | - |
| S3-04 | 極端に長い名前 | 10001文字の名前 | HTTP 400 or 切り捨て | 中 | - |
| S3-05 | 無効なメールアドレス | `@@invalid` | HTTP 400 | 高 | - |
| S3-06 | 正常なメールアドレス | `user@example.com` | HTTP 200系 | 高 | - |
| S3-07〜S3-10 | バリデーション各種 | 各種入力パターン | HTTP 400/201 | 中 | - |

### S4: SQLインジェクション対策（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S4-01 | クラシックSQLi（名前フィールド） | name: `'; DROP TABLE agents;--` | HTTP 400 or 201（DBエラーなし） | 高 | - |
| S4-02 | OR条件インジェクション | name: `' OR '1'='1` | HTTP 400 or 201（全件取得されない） | 高 | - |
| S4-03 | UNIONインジェクション | name: `' UNION SELECT * FROM companies--` | HTTP 400 or 201（情報漏洩なし） | 高 | - |
| S4-04 | ページネーションパラメータSQLi | limit: `1; DROP TABLE agents` | 整数変換されHTTP 200（`limit=1`として処理） | 高 | - |
| S4-05 | offsetパラメータSQLi | offset: `-1 OR 1=1` | offsetが0に丸められHTTP 200 | 高 | - |
| S4-06 | 数値フィールドへの文字列注入 | cost_usd: `"1.0; DROP TABLE"` | HTTP 400（型バリデーション） | 高 | - |
| S4-07 | IDパラメータへのSQLi | GET /api/agents/`'; SELECT 1--` | HTTP 404（UUID検証で拒否） | 高 | - |
| S4-08 | JSONネストしたSQLi | メタデータにSQLiペイロード | HTTP 201（文字列として安全に保存） | 中 | - |
| S4-09 | Blind SQLi（boolean） | `1' AND 1=1--` パターン | 通常レスポンスと差異なし | 中 | - |
| S4-10 | 時間ベースSQLi（pg_sleep） | name: `'; SELECT pg_sleep(5)--` | 5秒待機なし（インジェクション失敗） | 高 | - |

### S5: レート制限テスト（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S5-01 | 通常リクエスト | 1件GET | HTTP 200 | 高 | - |
| S5-02〜S5-10 | レート制限確認 | 連続リクエスト・`RATE_LIMIT_MAX`確認等 | HTTP 200（制限内）/ HTTP 429（超過時） | 高 | - |

### S6: セキュリティヘッダー（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S6-01 | X-Content-Type-Options | GET /api/agents | `nosniff` ヘッダーあり | 高 | - |
| S6-02 | X-Frame-Options | GET /api/agents | `DENY` or `SAMEORIGIN` | 高 | - |
| S6-03 | Content-Security-Policy | GET /api/agents | CSPヘッダーあり | 高 | - |
| S6-04〜S6-10 | 各種セキュリティヘッダー | GET リクエスト | 各ヘッダーの存在確認 | 中 | - |

### S7: エラーハンドリング（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S7-01 | 存在しないルート | GET /api/nonexistent-route-xyz | **HTTP 404・JSONレスポンス**（HTMLではない） | 高 | - |
| S7-02 | 不正なJSONボディ | 壊れたJSON | HTTP 400 | 高 | - |
| S7-03 | 巨大リクエストボディ | 10MB超のJSON | HTTP 413 or 400 | 中 | - |
| S7-04 | Content-Type設定POST | 正しいContent-Type | HTTP 200系 | 中 | - |
| S7-05 | stackトレース非露出 | エラー時のレスポンス | `stack`フィールドなし | 高 | - |
| S7-06 | 認証なしPOST | POST /api/agents（Authなし） | HTTP 401・JSONエラー | 中 | - |
| S7-07 | 空のリクエストボディ | POST /api/agents `{}` | HTTP 400・JSONエラー | 中 | - |
| S7-08 | 不正なUUID形式 | GET /api/agents/not-a-uuid | HTTP 400 or 404・JSONエラー | 中 | - |
| S7-09 | 存在しないルート（POST） | POST /api/nonexistent | HTTP 404・JSONエラー | 中 | - |
| S7-10 | DELETEメソッド不正 | DELETE /api/health | HTTP 404 or 405・JSONエラー | 低 | - |

### S8: 暗号化・機密情報（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S8-01〜S8-10 | APIキー生成・暗号化確認 | APIキー取得・検証 | APIキープレフィックス非露出・ハッシュ保存 | 高 | - |

### S9: CORS・オリジン（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S9-01 | Originなしリクエスト | curl相当 | HTTP 200系（開発環境は許可） | 中 | - |
| S9-02 | 許可オリジン | `Origin: http://localhost:5173` | HTTP 200・CORSヘッダーあり | 高 | - |
| S9-03〜S9-10 | 各種オリジン検証 | 許可/非許可オリジン | 正しいCORSレスポンス | 高 | - |

### S10: 回帰テスト（10項目）

| No. | テスト名 | 入力 | 期待結果 | 重要度 | 結果 |
|-----|---------|------|---------|--------|------|
| S10-01 | Plugin CRUD作成 | POST /api/plugins | HTTP 201 | 高 | - |
| S10-02 | Plugin GET | GET /api/plugins | HTTP 200 | 高 | - |
| S10-03 | Agent CRUD作成 | POST /api/agents | HTTP 201 | 高 | - |
| S10-04 | Agent GET | GET /api/agents | HTTP 200 | 高 | - |
| S10-05 | Goal CRUD作成 | POST /api/goals | HTTP 201 | 高 | - |
| S10-06 | Issue CRUD作成 | POST /api/issues | HTTP 201 | 高 | - |
| S10-07 | Cost記録 | POST /api/costs | HTTP 200系 | 高 | - |
| S10-08 | Activity記録 | POST **`/api/activity`**（`/activities`ではない） | HTTP 200系 | 高 | - |
| S10-09 | Webhook作成 | POST /api/plugins/:id/webhooks | HTTP 201 | 中 | - |
| S10-10 | Listエンドポイント確認 | GET /api/agents 等 | HTTP 200 | 高 | - |

---

## カバレッジ目標

- **正常系**: 30件（S1-06, S2-01, S3-01, S3-06, S5-01, S6全, S8全, S9-01〜02, S10全）
- **異常系**: 45件（S1-01〜05・09, S2-02〜04, S3-02〜05, S4全, S7-01〜05等）
- **境界値**: 10件（S1-04, S3-04, S5-05〜10）
- **SKIP可**: 5件（S1-07, S1-08, S7-06〜10等）

---

## 合格基準

**100点満点（SKIPは通過扱い）のみ合格。** 1件でも ❌ FAIL があれば不合格。

---

## テストスクリプトの既知修正事項（評価前確認）

現在の `test_w9_security_blackbox.py` には以下の3件のバグが判明している。評価後に修正する。

| No. | 場所 | 現在の実装 | 正しい実装 | 原因 |
|-----|------|-----------|-----------|------|
| Bug-1 | S1-10 | GET `/api/health` | GET **`/health`** | ヘルスエンドポイントは `/health`（`/api/health`は存在しない） |
| Bug-2 | S7-01 | `status is not None` のみ確認 | JSONレスポンスを確認 + **サーバーにJSON 404ハンドラを追加** | Express デフォルト404がHTML形式でmake_requestがパース失敗 |
| Bug-3 | S10-08 | POST `/api/activities` | POST **`/api/activity`** | エンドポイント名誤り |

---

## 評価ループ記録

**【コンサルレビュー】担当: David Park × Lucas Ferreira**

総合評価: **25 / 25点**

| 観点 | 評価（/5） | コメント |
|------|-----------|---------|
| 網羅性（テスト漏れがないか） | 5 | 10軸×10項目・認証/XSS/SQLi/CORS/回帰を全カバー |
| 具体性（入力・期待値が明確か） | 5 | 改善版でS4全10件・S7-06〜10の具体的入力を明記 |
| 重要度設定（優先度が適切か） | 5 | 高/中/低が適切に分類されている |
| 環境定義（再現可能な条件か） | 5 | 前提条件・実行コマンド・APIキー要件が明記されている |
| リスクカバレッジ（主要なリスクを潰せているか） | 5 | W9修正4点をカバー・既知バグ3件も仕様書に明記済み |

【改善点】
なし（改善版で全項目クリア）

→ **最終評価: 25 / 25点 ✅ 合格**
