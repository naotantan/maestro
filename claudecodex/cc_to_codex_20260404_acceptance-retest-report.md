# 受け入れ再試験レポート

- 実施日: 2026-04-04
- 対象: Claude 修正後の再試験
- 用件定義書: `/Users/naoto/Downloads/.company/consulting/reviews/2026-04-03-company-cli-requirements.md`

## 結論

前回のブロッカー 2 件は解消を確認した。再試験対象範囲は PASS と判断する。

## 再試験対象

1. `POST /api/costs/budget` の `numeric field overflow`
2. UI 英語表示時の raw i18n key 残存

## 実施内容

### 1. Costs / Budget API 再試験

新規テスト会社を登録し、以下を順に実施した。

1. `PATCH /api/settings` バリデーション確認
2. `POST /api/agents`
3. `POST /api/costs`
4. `POST /api/costs/budget`
5. `GET /api/costs/budget`
6. `GET /api/costs`

結果:

- `register`: `201`
- `settings_bad`: `400`
- `settings_good`: `200`
- `agent`: `201`
- `cost_event`: `201`
- `budget`: `201`
- `budget_get`: `200`
- `costs_get`: `200`

主要確認:

- `POST /api/costs/budget` は `201` を返却
- 作成された budget policy は `limit_amount_usd: "100.00"` `alert_threshold: "0.80"` で保存
- `GET /api/costs/budget` で作成済み policy を取得

確認レスポンス抜粋:

```json
{
  "data": {
    "id": "d7c2d43c-b0bd-4d8e-8c42-33fb3e2c90a3",
    "company_id": "b6fd81a6-31a5-4e37-9b0f-d79f6ae9e385",
    "limit_amount_usd": "100.00",
    "period": "monthly",
    "alert_threshold": "0.80"
  }
}
```

### 2. UI i18n 再試験

Playwright で英語表示のまま以下を再確認した。

- `/login`
- `/`
- `/approvals`
- `/issues/b6a2f241-adb4-40fc-ae46-7ff33f7d1cff`
- `/settings`

前回 raw key が露出していた確認ポイント:

- `layout.console`
- `dashboard.subtitle`
- `approvals.summary`
- `approvals.pendingCardDescription`
- `issues.noDescription`
- `issues.comments`
- `issues.commentPlaceholder`
- `issues.addComment`
- `settings.title`

結果:

- 上記 raw key は再試験時に DOM 上で未検出
- `/login` は `Login` `Sign in to your account` として表示
- `/` は `Review organization activity, outstanding work, and pending approvals...` として表示
- `/approvals` は英語ラベルで表示
- `/issues/:id` は `No description yet` など英語文言で表示
- `/settings` は英語ラベルで表示

## 修正内容の確認

`packages/api/src/routes/costs.ts` にて `alert_threshold` の正規化を追加し、`0.00〜1.00` と `0〜100` の両入力を受けつつ DB 保存時は比率値へ統一するよう変更した。

## 判定

- 再試験対象: PASS
- 前回ブロッカー: 解消

## 備考

- API サーバーは明示的に再起動後に再試験した
- 今回の再試験は前回 FAIL だった箇所とその周辺に限定した差分確認である
