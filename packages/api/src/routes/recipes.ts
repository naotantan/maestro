import { Router, type Router as RouterType } from 'express';
import { getDb, recipes, recipe_steps } from '@maestro/db';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

export const recipesRouter: RouterType = Router();

// GET /api/recipes — レシピ一覧
recipesRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { category } = req.query as Record<string, string | undefined>;
    const conditions = [eq(recipes.company_id, req.companyId!)];
    if (category) conditions.push(eq(recipes.category, category));

    const rows = await db
      .select()
      .from(recipes)
      .where(and(...conditions))
      .orderBy(desc(recipes.created_at));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id — レシピ詳細（ステップ付き）
recipesRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, req.params.id), eq(recipes.company_id, req.companyId!)));

    if (!recipe) {
      res.status(404).json({ error: 'not_found', message: 'レシピが見つかりません' });
      return;
    }

    const steps = await db
      .select()
      .from(recipe_steps)
      .where(eq(recipe_steps.recipe_id, recipe.id))
      .orderBy(asc(recipe_steps.order));

    res.json({ data: { ...recipe, steps } });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes — レシピ作成（ステップ含む）
recipesRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, category, steps } = req.body as {
      name?: string;
      description?: string;
      category?: string;
      steps?: Array<{
        order: number;
        phase_label: string;
        skill?: string;
        instruction: string;
        note?: string;
      }>;
    };

    if (!name) {
      res.status(400).json({ error: 'validation_failed', message: 'name は必須です' });
      return;
    }

    const db = getDb();
    const [created] = await db.insert(recipes).values({
      company_id: req.companyId!,
      name: sanitizeString(name),
      description: description || null,
      category: category ? sanitizeString(category) : null,
    }).returning();

    if (steps && steps.length > 0) {
      await db.insert(recipe_steps).values(
        steps.map((s, i) => ({
          recipe_id: created.id,
          order: s.order ?? i + 1,
          phase_label: sanitizeString(s.phase_label),
          skill: s.skill ? sanitizeString(s.skill) : null,
          instruction: s.instruction,
          note: s.note || null,
        }))
      );
    }

    const insertedSteps = await db
      .select()
      .from(recipe_steps)
      .where(eq(recipe_steps.recipe_id, created.id))
      .orderBy(asc(recipe_steps.order));

    res.status(201).json({ data: { ...created, steps: insertedSteps } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/recipes/:id — レシピ更新（メタ情報のみ）
recipesRouter.patch('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const { name, description, category } = req.body as {
      name?: string;
      description?: string;
      category?: string;
    };

    const updateFields: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) updateFields.name = sanitizeString(name);
    if (description !== undefined) updateFields.description = description;
    if (category !== undefined) updateFields.category = sanitizeString(category);

    const [updated] = await db
      .update(recipes)
      .set(updateFields)
      .where(and(eq(recipes.id, req.params.id), eq(recipes.company_id, req.companyId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: 'レシピが見つかりません' });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:id — レシピ削除（ステップもカスケード削除）
recipesRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(recipes)
      .where(and(eq(recipes.id, req.params.id), eq(recipes.company_id, req.companyId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: 'レシピが見つかりません' });
      return;
    }
    res.json({ data: deleted });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes/seed — 開発レシピをシード（初期データ投入）
recipesRouter.post('/seed', async (req, res, next) => {
  try {
    const db = getDb();
    const existing = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(recipes)
      .where(and(eq(recipes.company_id, req.companyId!), eq(recipes.name, 'maestro 標準開発レシピ')));

    if ((existing[0]?.cnt ?? 0) > 0) {
      res.json({ message: '既にシード済みです' });
      return;
    }

    const [recipe] = await db.insert(recipes).values({
      company_id: req.companyId!,
      name: 'maestro 標準開発レシピ',
      description: 'maestroに登録済みスキルを使った標準的な機能開発ワークフロー（Phase 0〜6）',
      category: '開発',
    }).returning();

    const steps = [
      { order: 1, phase_label: 'Phase 0: 調査', skill: 'github', instruction: 'gh search repos / gh search code で既存実装・テンプレートを検索。npm/PyPIなどパッケージレジストリも確認し、再利用できる実装を探す。', note: '車輪の再発明を避けるため、実装前に必ず調査する' },
      { order: 2, phase_label: 'Phase 1: 設計', skill: 'sequential-thinking', instruction: 'sequential-thinking で設計を検討。PRD・アーキテクチャ・システム設計・技術仕様・タスクリストを生成してから実装に入る。', note: '複雑な機能はplanner agentも活用' },
      { order: 3, phase_label: 'Phase 2: DB設計', skill: 'supabase', instruction: 'Drizzle ORMでスキーマ定義 → マイグレーション生成 → 適用。テーブル設計はsupabaseのベストプラクティスに従う。', note: 'group-*.tsのパターンを参照' },
      { order: 4, phase_label: 'Phase 3: API実装', skill: 'context7', instruction: 'context7 で使用ライブラリの最新ドキュメントを取得してからAPIルートを実装。エラーハンドリング・バリデーション・レート制限を必ず含める。', note: 'memoriesRouterのパターンを参考に' },
      { order: 5, phase_label: 'Phase 4: テスト', skill: 'tdd-guide', instruction: 'tdd-guideでテスト駆動開発。APIインテグレーションテスト・ユニットテストを先に書いてからE2Eテストを追加。カバレッジ80%以上を目標。', note: 'Red→Green→Refactorのサイクルで進める' },
      { order: 6, phase_label: 'Phase 5: UI実装', skill: 'awesome-design-md', instruction: 'awesome-design-mdのStripeデザインシステムを参考にReactコンポーネントを実装。TanStack Queryでデータ取得、楽観的更新を活用する。', note: 'デザインはStripeスタイル（Inter/weight300/--purple #533afd）に統一' },
      { order: 7, phase_label: 'Phase 6: レビュー', skill: 'code-reviewer', instruction: 'code-reviewerでコード品質を確認。security-reviewerでセキュリティチェック。TypeScript型エラーなし・ビルド成功を確認してからcommit/PR作成。', note: 'CRITICALとHIGH問題はマージ前に必ず修正' },
    ];

    await db.insert(recipe_steps).values(
      steps.map(s => ({ recipe_id: recipe.id, ...s, skill: s.skill }))
    );

    res.status(201).json({ message: 'シード完了', data: recipe });
  } catch (err) {
    next(err);
  }
});
