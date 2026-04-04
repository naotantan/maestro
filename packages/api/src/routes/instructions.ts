import { Router, type Router as RouterType } from 'express';
import { getDb, issues, projects, agents, agent_handoffs } from '@maestro/db';
import { eq, and, sql } from 'drizzle-orm';
import { sanitizeString } from '../middleware/validate';

export const instructionsRouter: RouterType = Router();

// 開発指示と判断するキーワード（これがなければ登録しない）
const DEV_KEYWORDS = [
  '実装', '開発', '作成', '追加', '修正', '変更', '削除', '更新', '改善',
  '直して', '直す', 'バグ', 'エラー', 'テスト', '設計', '調査', '調べ',
  'リファクタ', 'リファクト', '機能', '対応', 'ページ', '画面', 'API',
  'エンドポイント', 'コンポーネント', 'データベース', 'スキーマ', 'マイグレ',
  'デプロイ', 'ビルド', '設定', 'インストール', 'セットアップ', '確認して',
  'チェック', 'レビュー', '修正して', '追加して', '作って', '直して',
  'ください', 'しろ', 'すること', 'する必要', 'すべき',
];

// todo として分類するキーワード（短く具体的なタスク）
const TODO_KEYWORDS = [
  '修正して', '修正しろ', '直して', '直しろ', '確認して', '確認しろ',
  '更新して', '更新しろ', '削除して', '削除しろ', '変更して', '変更しろ',
  'チェック', 'レビュー', '直す', '調整', '追記', '修正',
];

/**
 * テキストが開発指示かどうかを判定する
 * 雑談・質問・天気などは false を返す
 */
function isDevInstruction(text: string): boolean {
  return DEV_KEYWORDS.some(k => text.includes(k));
}

/**
 * todo / backlog を分類する
 * - 短くて具体的なアクション → todo
 * - 長い・設計・実装 → backlog（issue）
 */
function classifyStatus(text: string): 'todo' | 'backlog' {
  const isTodoKeyword = TODO_KEYWORDS.some(k => text.includes(k));
  const isShort = text.length <= 80;
  return isTodoKeyword && isShort ? 'todo' : 'backlog';
}

/**
 * アクティブなプロジェクト一覧からテキストに最もマッチするプロジェクトを返す
 * プロジェクト名の単語がテキストに含まれていれば一致とみなす
 */
function matchProject(
  text: string,
  projectList: { id: string; name: string; description: string | null }[],
): string | null {
  const lower = text.toLowerCase();
  for (const p of projectList) {
    // プロジェクト名を空白・記号で分割して各単語でマッチ
    const words = p.name.toLowerCase().split(/[\s\-_・　/]+/);
    const matched = words.some(w => w.length >= 2 && lower.includes(w));
    if (matched) return p.id;

    // 説明文にキーワードが含まれる場合もマッチ
    if (p.description) {
      const descWords = p.description.toLowerCase().split(/[\s\-_・　/]+/);
      if (descWords.some(w => w.length >= 2 && lower.includes(w))) return p.id;
    }
  }
  return null;
}

/**
 * POST /api/instructions
 * 開発指示テキストを自動分類して Issue として登録する
 *
 * リクエスト: { text: string }
 * レスポンス: { data: Issue, meta: { classified_as, project_id, skipped } }
 */
instructionsRouter.post('/', async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'validation_failed', message: 'text は必須です' });
      return;
    }

    const sanitized = sanitizeString(text.trim());

    // 開発指示でない場合はスキップ（雑談・天気などは登録しない）
    if (!isDevInstruction(sanitized)) {
      res.json({
        data: null,
        meta: { skipped: true, reason: '開発指示として認識できないためスキップしました' },
      });
      return;
    }

    const status = classifyStatus(sanitized);
    const db = getDb();

    // アクティブプロジェクト一覧を取得してプロジェクト自動判定
    const projectList = await db
      .select({ id: projects.id, name: projects.name, description: projects.description })
      .from(projects)
      .where(and(eq(projects.company_id, req.companyId!), eq(projects.status, 'active')));

    const matchedProjectId = matchProject(sanitized, projectList);

    // タイトル: 最初の改行または80文字まで
    const title = sanitized.split('\n')[0].slice(0, 200);
    const description = sanitized.length > title.length ? sanitized : null;

    // トランザクション内で identifier を採番
    const newIssue = await db.transaction(async (tx) => {
      const maxResult = await tx
        .select({ max_id: sql<string | null>`max(identifier)` })
        .from(issues)
        .where(eq(issues.company_id, req.companyId!));

      const maxIdentifier = maxResult[0]?.max_id;
      let nextNum = 1;
      if (maxIdentifier) {
        const match = maxIdentifier.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const identifier = `COMP-${String(nextNum).padStart(3, '0')}`;

      return tx.insert(issues).values({
        company_id: req.companyId!,
        project_id: matchedProjectId,
        identifier,
        title,
        description,
        status,
        created_by: req.userId,
      }).returning();
    });

    const issue = newIssue[0];

    // 有効なエージェントを1件取得して agent_handoffs(pending) を生成
    // → heartbeat-engine が最大 HEARTBEAT_INTERVAL_MS(デフォルト30秒)以内に処理する
    const availableAgents = await db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(and(eq(agents.company_id, req.companyId!), eq(agents.enabled, true)))
      .limit(1);

    let handoffAgentName: string | null = null;
    if (availableAgents.length > 0) {
      const agent = availableAgents[0];
      handoffAgentName = agent.name;
      await db.insert(agent_handoffs).values({
        company_id: req.companyId!,
        from_agent_id: agent.id, // システム起点のため自己参照
        to_agent_id: agent.id,
        issue_id: issue.id,
        status: 'pending',
        prompt: `新しい開発指示が登録されました。\n\nIssue: ${issue.identifier}\n内容: ${issue.title}${issue.description ? '\n\n' + issue.description : ''}`,
      });
    }

    res.status(201).json({
      data: issue,
      meta: {
        skipped: false,
        classified_as: status === 'todo' ? 'todo' : 'issue',
        project_id: matchedProjectId,
        project_name: projectList.find(p => p.id === matchedProjectId)?.name ?? null,
        handoff_agent: handoffAgentName,
      },
    });
  } catch (err) {
    next(err);
  }
});
