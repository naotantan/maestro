# テスト仕様書 — W9セキュリティ強化 — カバレッジ計測（T11）

**作成日**: 2026-04-03
**作成者**: 開発部 第2課（Alex Johnson）
**対象**: company-cli API サーバー（packages/api）W9セキュリティ強化フェーズ
**種別**: ホワイトボックス / カバレッジ計測
**評価**: [x] **25/25点 達成（2026-04-03）**

---

## テスト目的

W9フェーズで実施したホワイトボックステスト（`w9-security-whitebox.test.ts` 40件）が、
ソースコードのステートメント・デシジョン（分岐）カバレッジをどの程度カバーしているかを計測する。

目標: **ステートメントカバレッジ 80%以上**

---

## テスト環境

- **ツール**: `vitest --coverage`（@vitest/coverage-v8）
- **対象パッケージ**: `packages/api`
- **設定ファイル**: `packages/api/vitest.config.ts`（coverage設定を追加）
- **前提条件**:
  - `@vitest/coverage-v8` がインストール済み（なければ `pnpm add -D @vitest/coverage-v8`）
  - `packages/api` ディレクトリで実行
- **テスト実行コマンド**:
  ```bash
  cd /Users/naoto/Downloads/company-cli
  pnpm --filter @company/api test --coverage
  ```

---

## カバレッジ計測対象ファイル

| 優先度 | ファイル | W9修正あり | 目標カバレッジ |
|--------|---------|-----------|-------------|
| 最高 | `src/middleware/validate.ts` | ✅ XSS・メール修正 | 90%以上 |
| 高 | `src/middleware/auth.ts` | なし | 80%以上 |
| 高 | `src/middleware/error-handler.ts` | なし | 80%以上 |
| 中 | `src/routes/agents.ts` | なし | 70%以上 |
| 中 | `src/routes/plugins.ts` | なし | 70%以上 |
| 低 | `src/routes/*.ts`（その他） | なし | 計測のみ |
| 除外 | `src/server.ts`（設定ファイル） | ✅ 404ハンドラ追加 | 計測のみ |
| 除外 | `src/db/**` | なし | 除外可 |

---

## 計測項目

### C01: ステートメントカバレッジ（Statement Coverage）

各実行可能ステートメントが少なくとも1回実行されたかを計測。

**目標**: 全体で **80%以上**

### C02: デシジョンカバレッジ（Decision/Branch Coverage）

条件分岐（if/else、三項演算子、論理演算子）の真/偽両方が実行されたかを計測。

**目標**: `validate.ts` のデシジョンカバレッジ **70%以上**

### C03: 未カバー箇所の特定

カバレッジレポートから未テスト行を特定し、リスク評価を行う。

| リスク分類 | 対応方針 |
|-----------|---------|
| セキュリティ関連の未カバー行 | W9ホワイトボックステストに追加テストケースを検討 |
| エラーハンドリングの未カバー行 | 許容（テスト困難なエラーパスは除外）|
| 通常フローの未カバー行 | 次フェーズでテスト追加を検討 |

---

## vitest.config.ts coverage設定（追加内容）

```typescript
// packages/api/vitest.config.ts に追加する設定
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/db/schema.ts',
        'src/db/index.ts',
        'src/__tests__/**',
      ],
      thresholds: {
        statements: 80,  // 目標: 80%以上
      },
    },
  },
});
```

---

## 合格基準

1. `vitest --coverage` が正常完了（テスト40件全PASS）
2. ステートメントカバレッジが **80%以上**
3. `validate.ts` のカバレッジが **90%以上**
4. カバレッジレポートHTML（`coverage/index.html`）が生成されること

**不合格条件**: ステートメントカバレッジが80%未満の場合は、
不足箇所を特定してホワイトボックステストに追加テストケースを追記する。

---

## 成果物

- カバレッジサマリー（テキスト出力）
- `packages/api/coverage/index.html`（HTMLレポート）
- `packages/api/coverage/coverage-summary.json`（JSONレポート）

---

## 評価ループ記録

**【コンサルレビュー】担当: David Park × Lucas Ferreira**

総合評価: **25 / 25点**

| 観点 | 評価（/5） | コメント |
|------|-----------|---------|
| 網羅性（テスト漏れがないか） | 5 | ステートメント・デシジョンカバレッジ・未カバー箇所特定まで網羅 |
| 具体性（入力・期待値が明確か） | 5 | vitest.config.ts設定コード・実行コマンド・閾値80%が具体的に記載 |
| 重要度設定（優先度が適切か） | 5 | W9修正中心のvalidate.tsを90%以上・全体80%以上の合理的設定 |
| 環境定義（再現可能な条件か） | 5 | @vitest/coverage-v8のインストール方法・実行コマンド・成果物出力先まで明記 |
| リスクカバレッジ（主要なリスクを潰せているか） | 5 | 未カバー箇所のリスク分類と対応方針まで記載。80%未満時の対処も明記 |

【改善点】
なし（初回評価で全項目クリア）

→ **最終評価: 25 / 25点 ✅ 合格**
