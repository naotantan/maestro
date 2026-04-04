# 詳細設計書 — エージェント間引き継ぎ機能

**バージョン**: 1.0.0  
**作成日**: 2026-04-04

---

## 1. DBスキーマ (Drizzle ORM)

```typescript
// packages/db/src/schema/group-h.ts に H12 として追記

export const agent_handoffs = pgTable('agent_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  company_id: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  from_agent_id: uuid('from_agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  to_agent_id: uuid('to_agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  issue_id: uuid('issue_id'),  // 任意 (issues FK は循環参照リスクのため省略)
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  prompt: text('prompt').notNull(),
  context: text('context'),
  result: text('result'),
  error: text('error'),
  created_at: timestamp('created_at').defaultNow(),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
}, (table) => ({
  idxCompany: index('idx_handoffs_company').on(table.company_id),
  idxStatus: index('idx_handoffs_status').on(table.status),
  idxFromAgent: index('idx_handoffs_from_agent').on(table.from_agent_id),
  idxToAgent: index('idx_handoffs_to_agent').on(table.to_agent_id),
}));
```

---

## 2. API 詳細仕様

### POST /api/handoffs

**リクエスト**:
```json
{
  "from_agent_id": "uuid",
  "to_agent_id": "uuid",
  "prompt": "前のエージェントの出力を踏まえてコードを実装してください",
  "issue_id": "uuid (optional)"
}
```

**バリデーション**:
- `from_agent_id`, `to_agent_id`, `prompt` は必須
- `from_agent_id !== to_agent_id`（自己引き継ぎ禁止）
- 両エージェントが同一 company_id に属すること

**レスポンス** (201):
```json
{
  "data": {
    "id": "uuid",
    "status": "pending",
    "from_agent_id": "uuid",
    "to_agent_id": "uuid",
    "prompt": "...",
    "created_at": "ISO8601"
  }
}
```

### GET /api/handoffs

**クエリパラメータ**: `limit` (default 20), `offset` (default 0), `status` (optional filter)

**レスポンス** (200):
```json
{ "data": [...], "meta": { "limit": 20, "offset": 0 } }
```

### GET /api/handoffs/:id

**レスポンス** (200): handoff オブジェクト全フィールド  
**404**: 見つからない or 別テナント

### PATCH /api/handoffs/:id/cancel

**条件**: status === 'pending' のみキャンセル可能  
**レスポンス** (200): `{ "data": { "status": "cancelled" } }`

---

## 3. エンジン拡張 (heartbeat-engine.ts)

```typescript
// processHandoffs() の疑似コード

async function processHandoffs(): Promise<void> {
  const db = getDb();

  // 1. pending の引き継ぎを最大2件取得
  const pending = await db.select().from(agent_handoffs)
    .where(eq(agent_handoffs.status, 'pending'))
    .limit(2);

  await Promise.allSettled(pending.map(async (handoff) => {
    // 2. running に更新
    await db.update(agent_handoffs)
      .set({ status: 'running', started_at: new Date() })
      .where(eq(agent_handoffs.id, handoff.id));

    try {
      // 3. from_agent の最新セッション結果を context として取得
      const lastSession = await db.select()
        .from(agent_task_sessions)
        .where(eq(agent_task_sessions.agent_id, handoff.from_agent_id))
        .orderBy(desc(agent_task_sessions.started_at))
        .limit(1);
      const context = lastSession[0]?.result ?? undefined;

      // 4. to_agent の config・type を取得
      const toAgent = await db.select()
        .from(agents)
        .where(eq(agents.id, handoff.to_agent_id))
        .limit(1);
      if (!toAgent[0]) throw new Error('to_agent が見つかりません');

      // 5. アダプター実行
      const { createAdapter } = await import('@maestro/adapters');
      const adapter = createAdapter(toAgent[0].type as AgentType, toAgent[0].config ?? {});
      const response = await adapter.runTask({
        taskId: handoff.id,
        prompt: handoff.prompt,
        context,
      });

      // 6. completed に更新
      await db.update(agent_handoffs)
        .set({ status: 'completed', result: response.output, completed_at: new Date(), context })
        .where(eq(agent_handoffs.id, handoff.id));

    } catch (err) {
      // 7. failed に更新
      await db.update(agent_handoffs)
        .set({ status: 'failed', error: String(err), completed_at: new Date() })
        .where(eq(agent_handoffs.id, handoff.id));
    }
  }));
}
```

---

## 4. 実装対象ファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `packages/db/src/schema/group-h.ts` | 追記 | H12: agent_handoffs テーブル定義 |
| `packages/db/src/schema/index.ts` | 変更不要 | group-h は既にエクスポート済み |
| `packages/api/src/routes/handoffs.ts` | 新規 | CRUD API 実装 |
| `packages/api/src/server.ts` | 追記 | handoffsRouter の登録 |
| `packages/api/src/engine/heartbeat-engine.ts` | 追記 | processHandoffs() の追加 |
| `packages/api/src/__tests__/handoffs.test.ts` | 新規 | 単体テスト |

---

## 5. エラーハンドリング仕様

| ケース | HTTPステータス | エラーコード |
|--------|---------------|-------------|
| 必須パラメータ欠落 | 400 | validation_failed |
| 自己引き継ぎ（from = to） | 400 | validation_failed |
| エージェントが別テナント | 400 | validation_failed |
| handoff が見つからない | 404 | not_found |
| pending 以外のキャンセル | 409 | invalid_state |
