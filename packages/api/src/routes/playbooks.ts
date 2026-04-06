import { Router, type Router as RouterType } from 'express';
import { getDb, playbooks, playbook_steps, playbook_jobs, plugins } from '@maestro/db';
import { eq, and, asc, desc } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';
import fs from 'fs';
import path from 'path';
import os from 'os';

// キューディレクトリ: ~/.maestro/queue/
const QUEUE_DIR = process.env.MAESTRO_QUEUE_DIR ?? path.join(os.homedir(), '.maestro', 'queue');
const DONE_DIR = path.join(path.dirname(QUEUE_DIR), 'done');

function ensureQueueDirs() {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  fs.mkdirSync(DONE_DIR, { recursive: true });
}

function writeStepFile(jobId: string, step: number, instruction: string) {
  ensureQueueDirs();
  const file = path.join(QUEUE_DIR, `${jobId}-step-${step}.txt`);
  fs.writeFileSync(file, instruction, 'utf8');
}

export const playbooksRouter: RouterType = Router();

// 生成ロジック
interface PlaybookStep {
  order: number;
  skill: string | null;
  label: string;
  instruction: string;
}

interface GeneratedPlaybook {
  title: string;
  steps: PlaybookStep[];
}

function generatePlaybook(task: string): GeneratedPlaybook {
  const t = task.toLowerCase();

  // タスクタイプ判定
  const isBug = /バグ|エラー|修正|直して|直す|fix|bug/.test(t);
  const isUI = /ui|デザイン|画面|コンポーネント|スタイル|見た目|ホームページ|ランディング|lp|トップページ|フロントエンド|frontend|レイアウト/.test(t);
  const isTest = /テスト|test|カバレッジ|spec/.test(t);
  const isRefactor = /リファクタ|整理|クリーンアップ|改善/.test(t);
  const isNew = /実装|開発|作成|追加|機能|新しい|作って|作る/.test(t);

  // キーワード抽出（最初の20文字程度）
  const keywords = task.slice(0, 30).replace(/[^\w\s\u3000-\u9fff]/g, ' ').trim();

  let steps: PlaybookStep[];

  if (isBug) {
    steps = [
      {
        order: 1,
        skill: 'sequential-thinking',
        label: '原因調査',
        instruction: `以下のバグについて、原因を深く分析してください。\n\n【依頼】${task}\n\n以下を整理してください:\n- エラーメッセージ・スタックトレースの読み解き\n- 再現手順\n- 根本原因の仮説（3つ以上）\n- 最も可能性が高い原因と根拠\n\n調査結果をまとめて次のステップに引き継げる形で出力してください。`,
      },
      {
        order: 2,
        skill: 'tdd-guide',
        label: 'テスト作成',
        instruction: `前のステップで特定したバグの根本原因に基づいて、バグを再現するテストを先に書いてください（Red フェーズ）。\n\n【依頼】${task}\n\nテストが失敗することを確認してから次のステップに進んでください。`,
      },
      {
        order: 3,
        skill: 'context7',
        label: '修正実装',
        instruction: `前のステップで作成したテストが通るように、バグを修正してください（Green フェーズ）。\n\n【依頼】${task}\n\n- 最小限の変更にとどめる\n- 関連ライブラリのドキュメントを確認してから修正する\n- 修正後にすべてのテストが通ることを確認する`,
      },
      {
        order: 4,
        skill: 'security-reviewer',
        label: 'セキュリティ確認',
        instruction: `前のステップで実装した修正箇所を対象に、セキュリティ問題がないかレビューしてください。\n\n【依頼】${task}\n\n特に以下を確認:\n- 入力値の検証\n- 認証・認可への影響\n- 機密情報の漏洩リスク`,
      },
      {
        order: 5,
        skill: 'code-reviewer',
        label: '最終レビュー',
        instruction: `修正全体をレビューしてください。\n\n【依頼】${task}\n\n確認ポイント:\n- 修正の意図が明確か\n- 副作用・意図しない変更がないか\n- テストカバレッジは十分か\n- リグレッションのリスクはないか`,
      },
    ];
  } else if (isUI) {
    steps = [
      {
        order: 1,
        skill: 'awesome-design-md',
        label: 'デザイン設計',
        instruction: `以下のUI実装のデザイン方針を決定してください。\n\n【依頼】${task}\n\nStripeデザインシステムを参考に以下を決定してください:\n- コンポーネント構成\n- カラー・タイポグラフィ・スペーシング\n- レスポンシブ対応方針\n- アニメーション・インタラクション\n\n設計内容を次のステップ（実装）に引き継げる形で出力してください。`,
      },
      {
        order: 2,
        skill: 'context7',
        label: 'コンポーネント実装',
        instruction: `前のステップのデザイン設計に基づいて、UIを実装してください。\n\n【依頼】${task}\n\n- 使用するUIライブラリのドキュメントをcontext7で取得してから実装する\n- アクセシビリティ（aria属性、キーボード操作）を考慮する\n- レスポンシブデザインを実装する`,
      },
      {
        order: 3,
        skill: 'e2e-runner',
        label: 'E2Eテスト',
        instruction: `前のステップで実装したUIコンポーネントのE2Eテストを作成・実行してください。\n\n【依頼】${task}\n\nテスト対象:\n- 表示の正確性\n- ユーザーインタラクション（クリック、入力等）\n- レスポンシブ表示\n- エラー状態の表示`,
      },
      {
        order: 4,
        skill: 'code-reviewer',
        label: 'コードレビュー',
        instruction: `実装したUIコードをレビューしてください。\n\n【依頼】${task}\n\n確認観点:\n- アクセシビリティ基準（WCAG）への準拠\n- パフォーマンス（不要な再レンダリング等）\n- コンポーネントの再利用性\n- デザイン設計との乖離がないか`,
      },
    ];
  } else if (isTest) {
    steps = [
      {
        order: 1,
        skill: 'tdd-guide',
        label: 'テスト設計',
        instruction: `以下の機能のテスト戦略を設計してください。\n\n【依頼】${task}\n\n以下を網羅したテストケース一覧を作成してください:\n- 正常系（期待通りの動作）\n- 異常系（エラー・例外）\n- 境界値（最小・最大・ゼロ等）\n- エッジケース\n\nテストケース一覧を次のステップに引き継いでください。`,
      },
      {
        order: 2,
        skill: 'tdd-guide',
        label: 'ユニットテスト',
        instruction: `前のステップで設計したテストケースに基づき、ユニットテストを実装してください。\n\n【依頼】${task}\n\nRed → Green → Refactor のサイクルで進めてください:\n1. テストを書く（Red）\n2. テストが通る最小限の実装（Green）\n3. コードをきれいにする（Refactor）`,
      },
      {
        order: 3,
        skill: 'e2e-runner',
        label: 'E2Eテスト',
        instruction: `ユニットテストでカバーできないクリティカルなユーザーフローのE2Eテストを追加してください。\n\n【依頼】${task}\n\n優先度の高いユーザーシナリオから順に実装してください。`,
      },
      {
        order: 4,
        skill: 'code-reviewer',
        label: 'テストレビュー',
        instruction: `実装したテストコード全体をレビューしてください。\n\n【依頼】${task}\n\n確認ポイント:\n- カバレッジ80%以上を達成しているか\n- テストの独立性（他のテストに依存していないか）\n- テストが仕様を正確に表現しているか\n- メンテナビリティ（壊れやすいテストがないか）`,
      },
    ];
  } else if (isRefactor) {
    steps = [
      {
        order: 1,
        skill: 'sequential-thinking',
        label: '現状分析',
        instruction: `以下のリファクタリングの対象コードを分析してください。\n\n【依頼】${task}\n\n分析内容:\n- 現在の問題点（可読性・保守性・パフォーマンス等）\n- リファクタリングの方針と優先順位\n- 影響範囲（依存関係・呼び出し元）\n- リスクの評価\n\n分析結果を次のステップに引き継いでください。`,
      },
      {
        order: 2,
        skill: 'refactor-cleaner',
        label: '不要コード削除',
        instruction: `前のステップの分析に基づき、不要なコードを削除してください。\n\n【依頼】${task}\n\n対象:\n- デッドコード（呼び出されていない関数・変数）\n- 重複コード\n- コメントアウトされたコード\n- 使われていないインポート`,
      },
      {
        order: 3,
        skill: 'context7',
        label: 'リファクタリング実装',
        instruction: `前のステップで整理したコードをリファクタリングしてください。\n\n【依頼】${task}\n\n- 外部から見た動作を変えずに内部構造を改善する\n- 関連ライブラリの最新のベストプラクティスを確認してから実装する\n- 変更は小さな単位で段階的に行う`,
      },
      {
        order: 4,
        skill: 'tdd-guide',
        label: 'テスト確認',
        instruction: `リファクタリング後に既存のテストがすべて通ることを確認してください。\n\n【依頼】${task}\n\n- 全テストを実行してグリーンを確認する\n- テストカバレッジが低下していないか確認する\n- 必要に応じてテストを追加・修正する`,
      },
      {
        order: 5,
        skill: 'code-reviewer',
        label: 'リファクタリングレビュー',
        instruction: `リファクタリング後のコードをレビューしてください。\n\n【依頼】${task}\n\n確認ポイント:\n- 当初の問題点が解決されているか\n- 可読性・保守性が向上しているか\n- パフォーマンスへの影響はないか\n- 新たな技術的負債を生んでいないか`,
      },
    ];
  } else if (isNew) {
    steps = [
      {
        order: 1,
        skill: 'github',
        label: '事前調査',
        instruction: `以下の機能開発に着手する前に、既存の実装・ライブラリ・参考コードを調査してください。\n\n【依頼】${task}\n\nGitHubで以下を検索:\ngh search repos "${keywords}"\ngh search code "${keywords}"\n\n調査結果（使えそうなライブラリ・参考実装）を次のステップの設計に活かしてください。`,
      },
      {
        order: 2,
        skill: 'sequential-thinking',
        label: '設計',
        instruction: `前のステップの調査結果を踏まえて、以下の機能の実装設計を行ってください。\n\n【依頼】${task}\n\n以下の順序で設計ドキュメントを作成してください:\n1. PRD（要件定義）: 機能の目的・ユーザーストーリー・受け入れ条件\n2. アーキテクチャ設計: コンポーネント構成・データフロー・技術選定\n3. タスクリスト: 実装を小さなタスクに分解\n\n設計内容を後続ステップ（DB設計・API実装・UI実装）に引き継いでください。`,
      },
      {
        order: 3,
        skill: 'supabase',
        label: 'DB設計',
        instruction: `前のステップの設計書に基づいて、必要なDBスキーマを設計してください。\n\n【依頼】${task}\n\n- Drizzle ORMのスキーマ定義として実装する\n- テーブル・カラム・インデックス・リレーションを定義する\n- マイグレーションファイルを生成する\n\nDBスキーマをAPI実装ステップに引き継いでください。`,
      },
      {
        order: 4,
        skill: 'context7',
        label: 'API実装',
        instruction: `前のステップで設計したDBスキーマを使って、APIエンドポイントを実装してください。\n\n【依頼】${task}\n\n- context7で使用するライブラリの最新ドキュメントを取得してから実装する\n- 設計書のPRDの受け入れ条件を満たすエンドポイントを実装する\n- バリデーション・エラーハンドリングを実装する\n\n実装したAPIの仕様をテスト・UI実装ステップに引き継いでください。`,
      },
      {
        order: 5,
        skill: 'tdd-guide',
        label: 'テスト実装',
        instruction: `前のステップで実装したAPIのテストを実装してください。\n\n【依頼】${task}\n\nTDDアプローチ（テストファースト）で進めてください:\n- 各エンドポイントの正常系・異常系・境界値テスト\n- DBとの統合テスト\n- 認証・認可のテスト\n\nカバレッジ80%以上を目指してください。`,
      },
      {
        order: 6,
        skill: 'awesome-design-md',
        label: 'UI実装',
        instruction: `前のステップで実装したAPIを使って、UIを実装してください。\n\n【依頼】${task}\n\nStripeデザインシステムを参考にしつつ:\n- 設計書のユーザーストーリーに沿ったUIを実装する\n- APIとの接続（データ取得・送信）を実装する\n- ローディング・エラー状態を適切に表示する`,
      },
      {
        order: 7,
        skill: 'code-reviewer',
        label: '総合レビュー',
        instruction: `実装全体（API・テスト・UI）をレビューしてください。\n\n【依頼】${task}\n\n確認ポイント:\n- PRDの受け入れ条件をすべて満たしているか\n- CRITICAL・HIGH問題を優先的に指摘する\n- セキュリティリスクがないか\n- パフォーマンス上の問題がないか`,
      },
    ];
  } else {
    steps = [
      {
        order: 1,
        skill: 'sequential-thinking',
        label: '方針検討',
        instruction: `以下のタスクの実施方針を検討してください。\n\n【依頼】${task}\n\n以下を明確にしてください:\n- タスクのゴールと完了条件\n- 取り得るアプローチと比較\n- 推奨アプローチとその根拠\n- リスクと対策\n\n検討結果を次のステップに引き継いでください。`,
      },
      {
        order: 2,
        skill: 'context7',
        label: '実装',
        instruction: `前のステップで決定した方針に基づいて実装してください。\n\n【依頼】${task}\n\n- 関連ライブラリのドキュメントをcontext7で取得してから実装する\n- 実装の各判断を記録して次のレビューに引き継ぐ`,
      },
      {
        order: 3,
        skill: 'code-reviewer',
        label: 'レビュー',
        instruction: `実装をレビューしてください。\n\n【依頼】${task}\n\n- 方針検討で決めたゴール・完了条件を満たしているか\n- コード品質・セキュリティ・パフォーマンスの観点で問題がないか`,
      },
    ];
  }

  const title = task.slice(0, 40) + 'の指示書';

  // スキルが設定されているステップは指示文の先頭に /スキル名 を付与してコピー時に直接使えるようにする
  const stepsWithSkillCmd = steps.map(s =>
    s.skill
      ? { ...s, instruction: `/${s.skill}\n\n${s.instruction}` }
      : s
  );

  return { title, steps: stepsWithSkillCmd };
}

// Claude Agent SDK を使ってスキル選定＆指示書生成（サブスクリプション利用）
async function generatePlaybookWithClaude(
  task: string,
  companyId: string
): Promise<GeneratedPlaybook> {
  const db = getDb();

  // 登録済みスキル一覧を取得
  const skillRows = await db
    .select({ name: plugins.name, description: plugins.description, category: plugins.category })
    .from(plugins)
    .where(eq(plugins.company_id, companyId))
    .limit(300);

  if (skillRows.length === 0) {
    return generatePlaybook(task);
  }

  const skillList = skillRows
    .map(s => `${s.name}${s.category ? ` [${s.category}]` : ''}${s.description && s.description !== '|' ? ` - ${s.description.slice(0, 60)}` : ''}`)
    .join('\n');

  const prompt = `以下の依頼文に対して、登録済みスキル一覧から最適なスキルを選んで実行ステップを設計してください。

## 依頼文
${task}

## 登録済みスキル一覧
${skillList}

## 出力形式（JSONのみ返す。マークダウンのコードブロック不要）
{"title":"タイトル（40文字以内、末尾に「の指示書」）","steps":[{"order":1,"skill":"スキル名（一覧から選ぶ。なければnull）","label":"ステップ名（10文字以内）","instruction":"/スキル名\\n\\n具体的な指示（依頼内容を含める）"}]}

## ルール
- ステップ数は3〜7個
- skillは必ず上記一覧に存在する名前を使う（一覧にないものはnull）
- instructionは /スキル名\\n\\n で始める（skillがnullなら不要）
- instructionには依頼文の具体的な内容を組み込む
- JSONのみ返す`;

  // Dynamic import で ESM モジュールを読み込む
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  let raw = '';
  for await (const msg of query({
    prompt,
    options: { allowedTools: [], maxTurns: 1 },
  })) {
    const m = msg as Record<string, unknown>;
    if (m.type === 'assistant' && Array.isArray(m.message)) {
      for (const block of m.message as Array<Record<string, unknown>>) {
        if (block.type === 'text') raw += block.text as string;
      }
    }
    if ('result' in m && typeof m.result === 'string') {
      raw = m.result;
    }
  }

  if (!raw) throw new Error('empty response from claude-agent-sdk');

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1] : raw;
  const parsed = JSON.parse(jsonText.trim()) as GeneratedPlaybook;

  if (!parsed.title || !Array.isArray(parsed.steps)) {
    throw new Error('invalid response format');
  }

  return parsed;
}

// POST /api/playbooks/generate — 生成のみ（保存なし）
// NOTE: /generateを/:idより先に定義しないとExpressが"generate"を:idとして解釈する
playbooksRouter.post('/generate', async (req, res, next) => {
  try {
    const { task } = req.body as { task?: string };
    if (!task || !task.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'task は必須です' });
      return;
    }

    let result: GeneratedPlaybook;
    try {
      result = await generatePlaybookWithClaude(task.trim(), req.companyId!);
    } catch (err) {
      // Agent SDK が使えない場合（クォータ上限など）はキーワードスコアリングにフォールバック
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('[playbooks] Agent SDK unavailable, falling back to keyword scoring:', reason);
      result = generatePlaybook(task.trim());
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/playbooks — 一覧
playbooksRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.company_id, req.companyId!))
      .orderBy(desc(playbooks.created_at));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/playbooks/:id — 詳細（steps付き）
playbooksRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(and(eq(playbooks.id, req.params.id), eq(playbooks.company_id, req.companyId!)));

    if (!playbook) {
      res.status(404).json({ error: 'not_found', message: '指示書が見つかりません' });
      return;
    }

    const steps = await db
      .select()
      .from(playbook_steps)
      .where(eq(playbook_steps.playbook_id, playbook.id))
      .orderBy(asc(playbook_steps.order));

    res.json({ data: { ...playbook, steps } });
  } catch (err) {
    next(err);
  }
});

// POST /api/playbooks — 生成＆保存
playbooksRouter.post('/', async (req, res, next) => {
  try {
    const { task, title: customTitle, steps: customSteps } = req.body as {
      task?: string;
      title?: string;
      steps?: Array<{ order: number; skill?: string; label: string; instruction: string }>;
    };

    if (!task || !task.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'task は必須です' });
      return;
    }

    const db = getDb();
    const generated = generatePlaybook(task.trim());
    const title = customTitle ? sanitizeString(customTitle) : generated.title;
    const steps = customSteps || generated.steps;

    const [created] = await db.insert(playbooks).values({
      company_id: req.companyId!,
      title,
      task: task.trim(),
    }).returning();

    if (steps && steps.length > 0) {
      await db.insert(playbook_steps).values(
        steps.map((s, i) => ({
          playbook_id: created.id,
          order: s.order ?? i + 1,
          skill: s.skill ? sanitizeString(s.skill) : null,
          label: sanitizeString(s.label),
          instruction: s.instruction,
        }))
      );
    }

    const insertedSteps = await db
      .select()
      .from(playbook_steps)
      .where(eq(playbook_steps.playbook_id, created.id))
      .orderBy(asc(playbook_steps.order));

    res.status(201).json({ data: { ...created, steps: insertedSteps } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/playbooks/:id — タイトル＋ステップ全置換（修正保存）
playbooksRouter.put('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const { title, steps } = req.body as {
      title?: string;
      steps?: Array<{ order: number; skill?: string | null; label: string; instruction: string }>;
    };

    const [existing] = await db
      .select()
      .from(playbooks)
      .where(and(eq(playbooks.id, req.params.id), eq(playbooks.company_id, req.companyId!)));

    if (!existing) {
      res.status(404).json({ error: 'not_found', message: '指示書が見つかりません' });
      return;
    }

    if (title) {
      await db
        .update(playbooks)
        .set({ title: sanitizeString(title) })
        .where(eq(playbooks.id, existing.id));
    }

    if (steps) {
      await db.delete(playbook_steps).where(eq(playbook_steps.playbook_id, existing.id));
      if (steps.length > 0) {
        await db.insert(playbook_steps).values(
          steps.map((s, i) => ({
            playbook_id: existing.id,
            order: s.order ?? i + 1,
            skill: s.skill ? sanitizeString(s.skill) : null,
            label: sanitizeString(s.label),
            instruction: s.instruction,
          }))
        );
      }
    }

    const updatedSteps = await db
      .select()
      .from(playbook_steps)
      .where(eq(playbook_steps.playbook_id, existing.id))
      .orderBy(asc(playbook_steps.order));

    res.json({ data: { ...existing, title: title ?? existing.title, steps: updatedSteps } });
  } catch (err) {
    next(err);
  }
});

// ─── ジョブ管理（fswatch 自動実行）────────────────────────────────────────

// POST /api/playbooks/:id/run — ジョブ開始（step 1 ファイルを書き出す）
playbooksRouter.post('/:id/run', async (req, res, next) => {
  try {
    const db = getDb();

    const [pb] = await db
      .select()
      .from(playbooks)
      .where(and(eq(playbooks.id, req.params.id), eq(playbooks.company_id, req.companyId!)));

    if (!pb) {
      res.status(404).json({ error: 'not_found', message: '指示書が見つかりません' });
      return;
    }

    const steps = await db
      .select()
      .from(playbook_steps)
      .where(eq(playbook_steps.playbook_id, pb.id))
      .orderBy(asc(playbook_steps.order));

    if (steps.length === 0) {
      res.status(400).json({ error: 'no_steps', message: 'ステップがありません' });
      return;
    }

    const [job] = await db
      .insert(playbook_jobs)
      .values({
        playbook_id: pb.id,
        company_id: req.companyId!,
        status: 'running',
        current_step: 1,
        total_steps: steps.length,
      })
      .returning();

    // step 1 のファイルをキューに書き出す
    writeStepFile(job.id, 1, steps[0].instruction);

    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
});

// GET /api/playbooks/jobs/:jobId — ジョブ状態取得（UIポーリング用）
playbooksRouter.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const db = getDb();
    const [job] = await db
      .select()
      .from(playbook_jobs)
      .where(and(eq(playbook_jobs.id, req.params.jobId), eq(playbook_jobs.company_id, req.companyId!)));

    if (!job) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
});

// POST /api/playbooks/jobs/:jobId/step-complete — ステップ完了通知（watch スクリプトが呼ぶ）
playbooksRouter.post('/jobs/:jobId/step-complete', async (req, res, next) => {
  try {
    const db = getDb();
    const { step } = req.body as { step: number };

    const [job] = await db
      .select()
      .from(playbook_jobs)
      .where(eq(playbook_jobs.id, req.params.jobId));

    if (!job) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const nextStep = step + 1;

    if (nextStep > job.total_steps) {
      // 全ステップ完了
      await db
        .update(playbook_jobs)
        .set({ status: 'completed', current_step: step, updated_at: new Date() })
        .where(eq(playbook_jobs.id, job.id));
      res.json({ data: { status: 'completed' } });
      return;
    }

    // 次ステップのファイルを書き出す
    const steps = await db
      .select()
      .from(playbook_steps)
      .where(eq(playbook_steps.playbook_id, job.playbook_id))
      .orderBy(asc(playbook_steps.order));

    const nextStepData = steps.find(s => s.order === nextStep);
    if (!nextStepData) {
      res.status(500).json({ error: 'step_not_found' });
      return;
    }

    await db
      .update(playbook_jobs)
      .set({ current_step: nextStep, updated_at: new Date() })
      .where(eq(playbook_jobs.id, job.id));

    writeStepFile(job.id, nextStep, nextStepData.instruction);

    res.json({ data: { status: 'running', current_step: nextStep } });
  } catch (err) {
    next(err);
  }
});

// POST /api/playbooks/jobs/:jobId/error — エラー通知（watch スクリプトが呼ぶ）
playbooksRouter.post('/jobs/:jobId/error', async (req, res, next) => {
  try {
    const db = getDb();
    const { error } = req.body as { step: number; error: string };

    await db
      .update(playbook_jobs)
      .set({ status: 'error', error_message: error, updated_at: new Date() })
      .where(eq(playbook_jobs.id, req.params.jobId));

    res.json({ data: { status: 'error' } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/playbooks/:id — 削除
playbooksRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(playbooks)
      .where(and(eq(playbooks.id, req.params.id), eq(playbooks.company_id, req.companyId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: '指示書が見つかりません' });
      return;
    }
    res.json({ data: deleted });
  } catch (err) {
    next(err);
  }
});
