import { Router, type Router as RouterType } from 'express';
import { getDb, plugins, plugin_jobs, plugin_job_runs, plugin_webhooks, plugin_usage_events, companies } from '@maestro/db';
import { eq, and, sql, gte, desc, inArray } from 'drizzle-orm';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sanitizeString } from '../middleware/validate';

/** プラグイン登録・更新後にバックグラウンドでembeddingを生成する */
async function schedulePluginEmbedding(pluginId: string, plugin: { name: string; description?: string | null; usage_content?: string | null; category?: string | null }): Promise<void> {
  try {
    const { embedPassage, buildPluginEmbedText } = await import('../services/embedding.js');
    const vec = await embedPassage(buildPluginEmbedText(plugin));
    const db = getDb();
    await db.execute(sql`UPDATE plugins SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${pluginId}`);
  } catch { /* embedding失敗は無視 */ }
}

/**
 * キーワードベースの高速カテゴリ分類（Ollama不使用）
 * スキル名・説明文のキーワードでカテゴリを推定する
 */
function guessCategoryByKeyword(name: string, description: string): string {
  const text = (name + ' ' + description).toLowerCase();
  if (/\bai\b|agent|llm|claude|gpt|ollama|model|embed|vector|rag|anthropic|openai/.test(text)) return 'AI・エージェント';
  if (/react|vue|angular|frontend|front.end|css|html|tailwind|ui\b|component|svelte|next\.?js|remix/.test(text)) return 'フロントエンド';
  if (/\bapi\b|backend|back.end|express|fastapi|django|flask|server|rest\b|graphql|endpoint|hono/.test(text)) return 'バックエンド・API';
  if (/sql|database|postgres|mysql|mongo|redis|supabase|\bdb\b|query|schema|drizzle|prisma/.test(text)) return 'データベース';
  if (/test|jest|playwright|vitest|spec|coverage|e2e|unit.test|assert|cypress/.test(text)) return 'テスト・品質';
  if (/docker|k8s|kubernetes|\bci\b|\bcd\b|deploy|terraform|aws|gcp|azure|infra|github.action|devops/.test(text)) return 'DevOps・インフラ';
  if (/security|auth|oauth|jwt|encrypt|crypto|ssl|permission|vulnerability|csrf|xss|owasp/.test(text)) return 'セキュリティ';
  if (/content|blog|seo|marketing|copy.?writ|article|social.media/.test(text)) return 'コンテンツ・マーケティング';
  if (/git\b|github|commit|\bpr\b|review|workflow|task|todo|plan|hook|refactor|format|lint/.test(text)) return 'ワークフロー・ツール';
  if (/python|typescript|javascript|\bgo\b|golang|rust|java\b|kotlin|swift|\bphp\b|ruby|lang|framework/.test(text)) return '言語・フレームワーク';
  return 'その他';
}

/**
 * スキル名+説明をもとにカテゴリを一括割り当てする。
 * Ollama (Qwen3:14b) を使用。失敗時は 'その他' を返す。
 */
async function categorizeSkillsWithOllama(
  skills: { name: string; description: string }[]
): Promise<string[]> {
  if (skills.length === 0) return [];
  const { categorizeSkillsWithOllama: ollamaCategorize } = await import('../services/ollama.js');
  return ollamaCategorize(skills, SKILL_CATEGORIES, 'その他');
}

/**
 * バックグラウンドで翻訳・Ollamaカテゴリ精度向上を行う（レスポンス後に実行）
 * フロントマターにカテゴリがなかったスキルをOllamaで正確に再分類する。
 * 翻訳も行う。処理はバッチ分割するのでタイムアウトしない。
 */
export async function refineSyncInBackground(
  companyId: string,
  companyLang: string,
  skillIds: { id: string; name: string; description: string; usageContent: string | null }[]
): Promise<void> {
  if (skillIds.length === 0) return;
  try {
    const db = getDb();
    const { translateTexts, translateUsageContent, categorizeSkillsWithOllama: ollamaCategorize } = await import('../services/ollama.js');

    // Ollamaカテゴリ分類（30スキル/バッチ）
    console.log(`[bg-refine] 開始: ${skillIds.length}件`);
    const CHUNK = 30;
    for (let i = 0; i < skillIds.length; i += CHUNK) {
      const chunk = skillIds.slice(i, i + CHUNK);
      console.log(`[bg-refine] カテゴリ分類: ${i + 1}〜${Math.min(i + CHUNK, skillIds.length)}件目`);
      try {
        const refined = await ollamaCategorize(
          chunk.map((s) => ({ name: s.name, description: s.description })),
          SKILL_CATEGORIES,
          'その他',
        );
        for (let j = 0; j < chunk.length; j++) {
          if (refined[j]) {
            await db.execute(sql`UPDATE plugins SET category = ${refined[j]} WHERE id = ${chunk[j].id}`);
          }
        }
      } catch {
        // このチャンクの分類失敗は無視して次へ
      }
    }

    if (companyLang !== 'en') {
      // description翻訳（20件/バッチ）
      const TRANS_CHUNK = 20;
      for (let i = 0; i < skillIds.length; i += TRANS_CHUNK) {
        const chunk = skillIds.slice(i, i + TRANS_CHUNK);
        try {
          const translated = await translateTexts(chunk.map((s) => s.description), companyLang);
          for (let j = 0; j < chunk.length; j++) {
            if (translated[j] && translated[j] !== chunk[j].description) {
              await db.execute(sql`
                UPDATE plugins SET description_translated = ${translated[j]}, translation_lang = ${companyLang}
                WHERE id = ${chunk[j].id} AND description_translated IS NULL
              `);
            }
          }
        } catch {
          // このチャンクの翻訳失敗は無視して次へ
        }
      }

      // usage_examples翻訳（20件/バッチ — 各スキルの例文配列をまとめて翻訳）
      // DBから usage_examples を取得して翻訳
      for (let i = 0; i < skillIds.length; i += TRANS_CHUNK) {
        const chunk = skillIds.slice(i, i + TRANS_CHUNK);
        try {
          const rows = await db.execute(sql`
            SELECT id, usage_examples FROM plugins
            WHERE id = ANY(ARRAY[${sql.raw(chunk.map(s => `'${s.id}'`).join(','))}]::uuid[])
            AND usage_examples IS NOT NULL AND usage_examples_translated IS NULL
          `);
          for (const row of rows.rows as { id: string; usage_examples: string }[]) {
            try {
              const examples: string[] = JSON.parse(row.usage_examples);
              if (!examples.length) continue;
              const translated = await translateTexts(examples, companyLang);
              await db.execute(sql`
                UPDATE plugins SET usage_examples_translated = ${JSON.stringify(translated)}
                WHERE id = ${row.id}
              `);
            } catch {
              // 1件失敗しても次へ
            }
          }
        } catch {
          // このチャンク失敗は無視
        }
      }

      // usage_content翻訳（長文のため1件ずつ）
      for (const skill of skillIds) {
        if (!skill.usageContent) continue;
        try {
          const translated = await translateUsageContent(skill.usageContent, companyLang);
          if (translated) {
            await db.execute(sql`
              UPDATE plugins SET usage_content_translated = ${translated}
              WHERE id = ${skill.id} AND usage_content_translated IS NULL
            `);
          }
        } catch {
          // 1件失敗しても次へ継続
        }
      }
    }
    // 全バッチ完了後にモデルをアンロードしてメモリを解放
    try {
      const { unloadModel } = await import('../services/ollama.js');
      await unloadModel();
    } catch { /* アンロード失敗は無視 */ }
  } catch {
    // バックグラウンド処理全体の失敗は無視
  }
}

/** 説明文のサニタイズ（HTMLエスケープなし・トリムのみ）
 * Reactが自動エスケープするためDBにHTMLエスケープは不要 */
/** YAML ブロックスカラー記号（説明として無意味な値）の一覧 */
const YAML_BLOCK_SCALARS = new Set(['|', '|-', '|+', '>', '>-', '>+']);

function sanitizeDesc(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed || YAML_BLOCK_SCALARS.has(trimmed)) return undefined;
  return trimmed.slice(0, 10000);
}

const execFileAsync = promisify(execFile);

/** スキルのカテゴリ定義（表示名） */
export const SKILL_CATEGORIES = [
  'AI・エージェント',
  'フロントエンド',
  'バックエンド・API',
  'データベース',
  'テスト・品質',
  'DevOps・インフラ',
  '言語・フレームワーク',
  'コンテンツ・マーケティング',
  'セキュリティ',
  'ワークフロー・ツール',
  'その他',
] as const;

/** フロントマター解析（YAML block scalar `>`, `>-`, `|`, `|-` 対応） */
function parseFrontmatter(content: string): { name: string | null; description: string | null; category: string | null } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { name: null, description: null, category: null };

  const lines = fmMatch[1].split('\n');
  let name: string | null = null;
  let description: string | null = null;
  let category: string | null = null;
  let collectingKey: 'description' | null = null;
  const blockLines: string[] = [];

  for (const line of lines) {
    if (collectingKey) {
      if (/^\s+/.test(line)) {
        blockLines.push(line.trim());
        continue;
      }
      // block scalar 終了
      description = blockLines.join(' ');
      collectingKey = null;
      blockLines.length = 0;
    }

    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();

    if (key === 'name' && val) {
      name = val;
    } else if (key === 'category' && val) {
      category = val.replace(/^["']|["']$/g, '');
    } else if (key === 'description') {
      const BLOCK_SCALARS = ['>', '>-', '|', '|-', '>+', '|+'];
      if (!val || BLOCK_SCALARS.includes(val)) {
        collectingKey = 'description';
        blockLines.length = 0;
      } else {
        // 引用符を除去
        description = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  // frontmatter 末尾で block scalar が終わる場合
  if (collectingKey === 'description' && blockLines.length > 0) {
    description = blockLines.join(' ');
  }

  return { name, description, category };
}

/** SKILL.md のフロントマター以降の本文を取り出す */
function extractBodyAfterFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  return match ? match[1].trim() : content.trim();
}

/**
 * ローカルの SKILL.md または GitHub から usage_content を取得する。
 * ローカルファイルが存在する場合はそちらを優先する。
 */
async function fetchUsageContent(skillName: string, localSkillsDir: string): Promise<string | null> {
  const localFile = path.join(localSkillsDir, skillName, 'SKILL.md');
  if (fs.existsSync(localFile)) {
    const content = fs.readFileSync(localFile, 'utf-8');
    return extractBodyAfterFrontmatter(content);
  }
  // GitHub フォールバック（ディレクトリトラバーサル対策のためスキル名を制限）
  const safeName = skillName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeName) return null;
  const ghUrl = `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/${safeName}/SKILL.md`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(ghUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return extractBodyAfterFrontmatter(await res.text());
    }
  } catch {
    // GitHub 取得失敗は無視
  }
  return null;
}

/**
 * usage_content の "When to Activate/Use" セクションから使い方の例を最大3件抽出する。
 * 抽出結果は JSON 文字列として返す。
 */
function extractUsageExamples(usageContent: string | null | undefined): string | null {
  if (!usageContent) return null;

  // コードブロックを除去
  const noCode = usageContent.replace(/```[\s\S]*?```/g, '');

  // "When to Activate / Use / Invoke / Trigger / Apply" セクションを探す
  const whenMatch = noCode.match(
    /##\s+When to (?:Activate|Use|Invoke|Trigger|Apply)[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
  );
  if (whenMatch) {
    const bullets = whenMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-*]\s+/, '').trim())
      .filter(isGoodExample);
    if (bullets.length > 0) {
      return JSON.stringify(bullets.slice(0, 3));
    }
  }

  // フォールバック: 全体の箇条書きから先頭3件
  const bullets = noCode
    .split('\n')
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(isGoodExample);
  if (bullets.length > 0) {
    return JSON.stringify(bullets.slice(0, 3));
  }
  return null;
}

function isGoodExample(l: string): boolean {
  if (!l) return false;
  if (l.startsWith('#') || l.startsWith('|')) return false;
  if (l.endsWith(':')) return false;
  if (l.includes('**')) return false;
  if (/^\d+\.\s/.test(l)) return false;
  return l.length >= 5 && l.length <= 100;
}

/**
 * trigger_type を自動判定する。
 * description または usage_content に 'PROACTIVELY' が含まれる場合は 'auto'、
 * それ以外は 'explicit'。
 */
function detectTriggerType(
  description: string | null | undefined,
  usage: string | null | undefined
): 'auto' | 'explicit' {
  const combined = ((description ?? '') + ' ' + (usage ?? '')).toUpperCase();
  return combined.includes('PROACTIVELY') ? 'auto' : 'explicit';
}

/**
 * ~/.claude/agents/ のエージェントに対応するスキルラッパーを ~/.claude/skills/<name>.md に作成する。
 * - trigger_type が 'auto' のエージェントはスキップ
 * - すでにラッパー（フラット .md またはディレクトリ形式）が存在する場合はスキップ
 */
function ensureAgentWrappers(agentsDir: string, skillsDir: string): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  if (!fs.existsSync(agentsDir)) return { created, skipped };

  const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));

  for (const agentFile of agentFiles) {
    const agentName = agentFile.replace(/\.md$/, '');
    const agentPath = path.join(agentsDir, agentFile);

    let content: string;
    try {
      content = fs.readFileSync(agentPath, 'utf-8');
    } catch {
      skipped++;
      continue;
    }

    const { description } = parseFrontmatter(content);

    // すでにラッパーが存在する場合はスキップ
    const wrapperPath = path.join(skillsDir, `${agentName}.md`);
    const wrapperDirPath = path.join(skillsDir, agentName, 'SKILL.md');
    if (fs.existsSync(wrapperPath) || fs.existsSync(wrapperDirPath)) {
      skipped++;
      continue;
    }

    // ラッパーファイルを作成
    const desc = description
      ? `${agentName}エージェントを起動する — ${description}`
      : `${agentName}エージェントを起動する`;
    const wrapperContent = `---\ndescription: ${desc}\n---\n\n${agentName}エージェントを使って実行してください。\n\n$ARGUMENTS\n`;

    try {
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(wrapperPath, wrapperContent, 'utf-8');
      created++;
    } catch {
      skipped++;
    }
  }

  return { created, skipped };
}

/** 翻訳対象の言語名を返す */
function getLangDisplayName(lang: string): string {
  const map: Record<string, string> = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' };
  return map[lang] ?? lang;
}

/**
 * スキルの description を対象言語に一括翻訳する。
 * Ollama (Qwen3:14b) を使用。失敗時は元のテキストをそのまま返す。
 */
async function translateDescriptions(
  descriptions: string[],
  targetLang: string,
): Promise<string[]> {
  if (targetLang === 'en' || descriptions.length === 0) return descriptions;
  const { translateTexts } = await import('../services/ollama.js');
  return translateTexts(descriptions, targetLang);
}

/**
 * SSRF対策: webhook URL がプライベート/ループバックIPを指していないか検証する
 * - ホスト名は DNS 解決して IP アドレスを確認する
 */
async function validateWebhookUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'http または https のみ許可されます' };
    }
  } catch {
    return { valid: false, reason: 'url の形式が不正です' };
  }

  // URL.hostname はIPv6を [::ffff:c0a8:101] 形式（括弧付き）で返す
  // isIP() は括弧付きを認識しないため、括弧を除去してから判定する
  const hostname = parsed.hostname;
  const rawHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // IPv4-mapped IPv6 を先にチェック（brackets stripped 後のアドレスに適用）
  const mappedV4 = extractMappedV4(rawHostname);
  if (mappedV4) {
    if (isPrivateIp(mappedV4)) {
      return { valid: false, reason: 'プライベートまたはループバックアドレスへのアクセスは禁止されています' };
    }
    return { valid: true };
  }

  // IP アドレスが直接指定された場合はそのままチェック
  const directIp = isIP(rawHostname) !== 0 ? rawHostname : null;
  const ipsToCheck: string[] = [];

  if (directIp) {
    ipsToCheck.push(directIp);
  } else {
    // DNS 解決してすべての A/AAAA レコードを検査
    try {
      const v4 = await dns.resolve4(hostname).catch(() => []);
      const v6 = await dns.resolve6(hostname).catch(() => []);
      ipsToCheck.push(...v4, ...v6);
    } catch {
      return { valid: false, reason: 'ホスト名を解決できません' };
    }
  }

  for (const ip of ipsToCheck) {
    if (isPrivateIp(ip)) {
      return { valid: false, reason: 'プライベートまたはループバックアドレスへのアクセスは禁止されています' };
    }
  }

  return { valid: true };
}

/** RFC 1918 / ループバック / リンクローカル などプライベートIP判定 */
function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:A.B.C.D or ::ffff:XXXX:XXXX) を IPv4 に変換して再チェック
  const mappedV4 = extractMappedV4(ip);
  if (mappedV4) return isPrivateIp(mappedV4);

  // IPv4
  const v4Parts = ip.split('.').map(Number);
  if (v4Parts.length === 4 && v4Parts.every(n => !isNaN(n))) {
    const [a, b] = v4Parts;
    if (a === 127) return true;                           // 127.0.0.0/8 ループバック
    if (a === 10) return true;                            // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
    if (a === 192 && b === 168) return true;              // 192.168.0.0/16
    if (a === 169 && b === 254) return true;              // 169.254.0.0/16 リンクローカル
    if (a === 0) return true;                             // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10 共有アドレス空間
    return false;
  }
  // IPv6 ループバック / リンクローカル / ULA
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;            // リンクローカル
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  return false;
}

/**
 * IPv4-mapped IPv6 アドレスから IPv4 部分を抽出する
 * URL.hostname は IPv6 アドレスを [::ffff:c0a8:101] 形式（括弧付き hex）で返すため
 * 括弧除去と hex 変換を行う
 *
 * 例: [::ffff:c0a8:101] → 192.168.1.1
 *     [::ffff:7f00:1]   → 127.0.0.1
 *     ::ffff:192.168.1.1 → 192.168.1.1（括弧なし形式も対応）
 */
function extractMappedV4(ip: string): string | null {
  // URL.hostname が返す [::ffff:xxxx:xxxx] 形式の括弧を除去
  const stripped = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  const lower = stripped.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;
  const rest = lower.slice(7); // "::ffff:" を取り除く

  // ドット記法 (::ffff:192.168.1.1)
  if (rest.includes('.')) return rest;

  // hex 記法 (::ffff:c0a8:101 など)
  const hexParts = rest.split(':');
  if (hexParts.length === 2) {
    const hi = parseInt(hexParts[0], 16);
    const lo = parseInt(hexParts[1], 16);
    if (!isNaN(hi) && !isNaN(lo)) {
      return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
    }
  }
  return null;
}

// webhook events の有効な値
const VALID_WEBHOOK_EVENTS = ['push', 'issue.created', 'issue.updated', 'issue.closed', 'agent.started', 'agent.completed', 'agent.failed'] as const;

export const pluginsRouter: RouterType = Router();

// --- Plugin CRUD ---

pluginsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    // 会社の言語設定を取得
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const companyLang = (companyRows[0]?.settings as Record<string, unknown> | null)?.language as string ?? 'ja';

    const rawRows = await db.execute(sql`
      SELECT *, usage_content_translated FROM plugins
      WHERE company_id = ${req.companyId!}
    `);
    const rows = rawRows.rows as (typeof plugins.$inferSelect & { usage_content_translated?: string | null })[];

    // 言語に合ったフィールドを返す（翻訳済みのものがあれば優先）
    const data = rows.map((p) => ({
      ...p,
      description:
        p.translation_lang === companyLang && p.description_translated
          ? p.description_translated
          : p.description,
      usage_content:
        p.usage_content_translated
          ? p.usage_content_translated
          : p.usage_content,
    }));

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, repository_url } = req.body as {
      name?: string;
      description?: string;
      repository_url?: string;
    };
    if (!name) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name は必須です',
      });
      return;
    }

    // repository_url — URL 形式チェック（存在する場合のみ）
    if (repository_url !== undefined && repository_url !== null) {
      try {
        const parsed = new URL(repository_url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        res.status(400).json({ error: 'validation_failed', message: 'repository_url は http または https で始まる URL を指定してください' });
        return;
      }
    }

    const db = getDb();
    const sanitizedDesc = sanitizeDesc(description);

    // 重複スキル検知（embedding が利用可能な場合のみ）
    let duplicateWarning: { id: string; name: string; similarity: number }[] | undefined;
    try {
      const { embedQuery, buildPluginEmbedText } = await import('../services/embedding.js');
      const candidateText = buildPluginEmbedText({ name: sanitizeString(name), description: sanitizedDesc });
      const vec = await embedQuery(candidateText);
      const dupRows = await db.execute(sql`
        SELECT id, name,
          1 - (embedding <=> ${`[${vec.join(',')}]`}::vector) AS similarity
        FROM plugins
        WHERE company_id = ${req.companyId!}
          AND enabled = true
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${`[${vec.join(',')}]`}::vector) >= 0.90
        ORDER BY embedding <=> ${`[${vec.join(',')}]`}::vector
        LIMIT 3
      `);
      if (dupRows.rows.length > 0) {
        duplicateWarning = dupRows.rows.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          similarity: Math.round(Number(r.similarity) * 100),
        }));
      }
    } catch { /* embedding未初期化時は無視 */ }

    // 会社の言語設定を取得して翻訳
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const companySettings = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;
    const companyLang = companySettings.language as string ?? 'ja';
    const anthropicApiKey = (companySettings.anthropicApiKey as string) || process.env.ANTHROPIC_API_KEY || '';

    let descTranslated: string | undefined;
    if (sanitizedDesc && companyLang !== 'en') {
      const [translated] = await translateDescriptions([sanitizedDesc], companyLang);
      if (translated !== sanitizedDesc) descTranslated = translated;
    }

    // usage_content と trigger_type を取得
    const skillsDir = path.join(process.env.HOME || '/root', '.claude', 'skills');
    const usageContent = await fetchUsageContent(sanitizeString(name), skillsDir);
    const usageExamples = extractUsageExamples(usageContent);
    const triggerType = detectTriggerType(sanitizedDesc, usageContent);

    const newPlugin = await db
      .insert(plugins)
      .values({
        company_id: req.companyId!,
        name: sanitizeString(name),
        description: sanitizedDesc,
        description_translated: descTranslated,
        translation_lang: descTranslated ? companyLang : undefined,
        repository_url,
        usage_content: usageContent ?? undefined,
        usage_examples: usageExamples ?? undefined,
        trigger_type: triggerType,
      })
      .returning();

    // 登録と同時にエージェントラッパーを自動生成
    const agentsDir = path.join(process.env.HOME || '/root', '.claude', 'agents');
    ensureAgentWrappers(agentsDir, skillsDir);

    res.status(201).json({
      data: newPlugin[0],
      ...(duplicateWarning && duplicateWarning.length > 0 && {
        warning: {
          code: 'possible_duplicates',
          message: '類似スキルが既に存在します。重複登録でないか確認してください。',
          similar_plugins: duplicateWarning,
        },
      }),
    });

    // バックグラウンドでembeddingを生成（レスポンスをブロックしない）
    schedulePluginEmbedding(newPlugin[0].id, newPlugin[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:id/generate-pitch — スキルの推薦文をOllamaで自動生成
pluginsRouter.post('/:id/generate-pitch', async (req, res, next) => {
  try {
    const id = req.params.id;
    const db = getDb();

    const rows = await db
      .select({
        id: plugins.id,
        name: plugins.name,
        description: plugins.description,
        usage_content: plugins.usage_content,
        category: plugins.category,
      })
      .from(plugins)
      .where(and(eq(plugins.id, id), eq(plugins.company_id, req.companyId!)))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'スキルが見つかりません' });
      return;
    }

    const { generateSkillPitch } = await import('../services/ollama.js');
    const result = await generateSkillPitch(rows[0]);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/plugins/recommend?q=text&limit=5&min_similarity=0.5 — セマンティック検索でスキルを推薦
pluginsRouter.get('/recommend', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'クエリが必要です' });
      return;
    }
    const limit = Math.min(Number(req.query.limit ?? 5), 20);
    const minSimilarity = Math.max(0, Math.min(1, Number(req.query.min_similarity ?? 0.5)));
    const { embedQuery } = await import('../services/embedding.js');
    const vec = await embedQuery(q);
    const vecStr = `[${vec.join(',')}]`;
    const db = getDb();
    // コサイン類似度で上位N件を取得（pgvector: 1 - cosine_distance）
    const rows = await db.execute(sql`
      SELECT
        id, name, description, description_translated, category,
        trigger_type, usage_count, last_used_at, enabled,
        1 - (embedding <=> ${vecStr}::vector) AS similarity
      FROM plugins
      WHERE company_id = ${req.companyId!}
        AND enabled = true
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
      ORDER BY embedding <=> ${vecStr}::vector
      LIMIT ${limit}
    `);
    res.json({ data: rows.rows, meta: { min_similarity: minSimilarity } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/reset-usage — 全スキルの使用統計をリセット
// POST /api/plugins/track-usage — スキル使用を記録（Claude Code フックから呼ばれる）
// body: { skill_name: string } or { skill_names: string[] }
pluginsRouter.post('/track-usage', async (req, res, next) => {
  try {
    const { skill_name, skill_names } = req.body as {
      skill_name?: string;
      skill_names?: string[];
    };

    const names: string[] = [];
    if (skill_name) names.push(skill_name);
    if (Array.isArray(skill_names)) names.push(...skill_names);

    if (names.length === 0) {
      res.status(400).json({ error: 'validation_failed', message: 'skill_name または skill_names が必要です' });
      return;
    }

    const db = getDb();
    // 名前の正規化: 先頭スラッシュ除去、小文字化
    const normalized = names.map(n => n.replace(/^\//, '').toLowerCase().trim());

    // 対応するプラグインを取得
    const rows = await db
      .select({ id: plugins.id, name: plugins.name })
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));

    const matched = rows.filter(r =>
      normalized.includes(r.name.replace(/^\//, '').toLowerCase().trim())
    );

    if (matched.length === 0) {
      res.json({ data: { updated: 0, not_found: names } });
      return;
    }

    const now = new Date();
    await db
      .update(plugins)
      .set({
        usage_count: sql`${plugins.usage_count} + 1`,
        last_used_at: now,
        updated_at: now,
      })
      .where(and(
        inArray(plugins.id, matched.map(m => m.id)),
        eq(plugins.company_id, req.companyId!),
      ));

    // 使用イベントを個別記録（期間別集計に使用）
    await db.insert(plugin_usage_events).values(
      matched.map(m => ({
        plugin_id: m.id,
        company_id: req.companyId!,
        used_at: now,
      }))
    );

    res.json({ data: { updated: matched.length, skills: matched.map(m => m.name) } });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.post('/reset-usage', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .update(plugins)
      .set({ usage_count: 0, last_used_at: null, updated_at: new Date() })
      .where(eq(plugins.company_id, req.companyId!));
    res.json({ data: { message: '使用履歴をリセットしました' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/plugins/usage-stats?period=24h|7d — 期間内Top10スキル使用頻度
// DBのusage_count/last_used_atを直接使用（テキスト再スキャンなし）
// GET /api/plugins/duplicates — 類似度0.90以上のスキルペアを検出（重複候補一覧）
pluginsRouter.get('/duplicates', async (req, res, next) => {
  try {
    const threshold = Math.min(Number(req.query.threshold ?? 0.95), 0.99);
    const db = getDb();
    // 自己結合でコサイン類似度が閾値以上のペアを抽出（重複しないよう a.id < b.id で制限）
    const rows = await db.execute(sql`
      SELECT
        a.id AS id_a, a.name AS name_a, a.description AS desc_a, a.enabled AS enabled_a,
        b.id AS id_b, b.name AS name_b, b.description AS desc_b, b.enabled AS enabled_b,
        1 - (a.embedding <=> b.embedding) AS similarity
      FROM plugins a
      JOIN plugins b ON a.id < b.id
      WHERE a.company_id = ${req.companyId!}
        AND b.company_id = ${req.companyId!}
        AND a.embedding IS NOT NULL
        AND b.embedding IS NOT NULL
        AND 1 - (a.embedding <=> b.embedding) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT 50
    `);
    res.json({
      data: rows.rows.map((r) => ({
        similarity: Math.round(Number(r.similarity) * 100),
        plugin_a: { id: r.id_a, name: r.name_a, description: r.desc_a, enabled: r.enabled_a },
        plugin_b: { id: r.id_b, name: r.name_b, description: r.desc_b, enabled: r.enabled_b },
      })),
      meta: { threshold: Math.round(threshold * 100) },
    });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.get('/usage-stats', async (req, res, next) => {
  try {
    const period = req.query.period === '7d' ? '7d' : '24h';
    const since = new Date();
    if (period === '7d') {
      since.setDate(since.getDate() - 7);
    } else {
      since.setHours(since.getHours() - 24);
    }

    const db = getDb();

    // plugin_usage_events から期間内の実際の使用回数を集計
    const rows = await db.execute(sql`
      SELECT p.name, COUNT(e.id)::int AS count, MAX(e.used_at) AS last_used_at
      FROM plugin_usage_events e
      JOIN plugins p ON p.id = e.plugin_id
      WHERE e.company_id = ${req.companyId!}
        AND e.used_at >= ${since}
        AND p.enabled = true
      GROUP BY p.name
      ORDER BY count DESC
      LIMIT 10
    `);

    let top10 = rows.rows.map((r: Record<string, unknown>) => ({
      name: r.name as string,
      count: r.count as number,
      last_used_at: r.last_used_at as string | null,
      is_fallback: false,
    }));

    // 期間内データが0件の場合、累計ベースでフォールバック表示
    let isFallback = false;
    if (top10.length === 0) {
      const fallbackRows = await db
        .select({ name: plugins.name, usage_count: plugins.usage_count, last_used_at: plugins.last_used_at })
        .from(plugins)
        .where(and(eq(plugins.company_id, req.companyId!), eq(plugins.enabled, true), gte(plugins.usage_count, 1)))
        .orderBy(desc(plugins.usage_count))
        .limit(10);
      top10 = fallbackRows.map(r => ({ name: r.name, count: r.usage_count, last_used_at: r.last_used_at as unknown as string | null, is_fallback: true }));
      isFallback = fallbackRows.length > 0;
    }

    res.json({ data: top10, meta: { period, since: since.toISOString(), is_fallback: isFallback } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/sync — ~/.claude/skills/ からスキルを同期（新規追加 + 説明更新）
pluginsRouter.post('/sync', async (req, res, next) => {
  try {
    const skillsDir = req.body?.skills_dir
      || path.join(process.env.HOME || '/root', '.claude', 'skills');

    if (!fs.existsSync(skillsDir)) {
      res.status(400).json({
        error: 'not_found',
        message: `スキルディレクトリが見つかりません: ${skillsDir}`,
      });
      return;
    }

    const db = getDb();

    // 会社の言語設定を取得
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const companySettings = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;
    const companyLang = companySettings.language as string ?? 'ja';
    const anthropicApiKey = (companySettings.anthropicApiKey as string) || process.env.ANTHROPIC_API_KEY || '';

    // 既存スキル取得
    const existing = await db
      .select({
        id: plugins.id,
        name: plugins.name,
        description: plugins.description,
        translation_lang: plugins.translation_lang,
        category: plugins.category,
        usage_content: plugins.usage_content,
      })
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));
    const existingMap = new Map(
      existing.map((r) => [r.name.toLowerCase(), r])
    );

    // スキルディレクトリをスキャン
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    // 新規・更新が必要なスキルを収集（まず翻訳なしで処理）
    type SkillEntry = {
      name: string;
      dirName: string;  // スキルディレクトリ名（usage_content 取得に使用）
      description: string;
      category: string | null;
      hasExplicitCategory: boolean;  // フロントマターにカテゴリが明示されているか
      usageContent: string | null;
      isNew: boolean;
      existingId?: string;
    };
    const toInsert: SkillEntry[] = [];
    const toUpdate: SkillEntry[] = [];
    let skipped = 0;
    const errors: { name: string; reason: string }[] = [];

    /** スキルエントリを処理して toInsert/toUpdate/skipped/errors に振り分けるヘルパー */
    function processSkillContent(
      rawName: string,
      content: string,
      filePath: string,
    ): void {
      const { name: parsedName, description: parsedDesc, category: parsedCategory } = parseFrontmatter(content);
      const bodyContent = extractBodyAfterFrontmatter(content);

      // 循環スタブ: "Xスキルを使って実行してください" はスキップ
      if (/スキルを使って実行してください/.test(bodyContent)) {
        errors.push({ name: rawName, reason: '循環スタブ（スキルを使って実行してください）のためスキップ' });
        return;
      }
      // エージェントラッパー（薄い委譲のみ）はスキップ
      // body が短くかつ "エージェントを使って実行してください" だけの場合
      if (/エージェントを使って実行してください/.test(bodyContent) && bodyContent.trim().split('\n').length < 5) {
        skipped++;
        return;
      }

      const skillName = sanitizeString(rawName);
      if (!skillName) {
        errors.push({ name: rawName, reason: 'スキル名が空になりました' });
        return;
      }
      const description = parsedDesc ?? `Imported from ${rawName}`;
      const sanitizedDesc = sanitizeDesc(description) ?? description;

      const oldParsedKey = parsedName ? sanitizeString(parsedName).toLowerCase() : null;
      const existingEntry = existingMap.get(skillName.toLowerCase())
        ?? (oldParsedKey ? existingMap.get(oldParsedKey) : undefined);

      if (existingEntry) {
        if (
          existingEntry.name !== skillName ||
          existingEntry.description !== sanitizedDesc ||
          existingEntry.translation_lang !== companyLang ||
          (parsedCategory && existingEntry.category !== parsedCategory) ||
          !existingEntry.usage_content
        ) {
          toUpdate.push({
            name: skillName,
            dirName: rawName,
            description: sanitizedDesc,
            category: parsedCategory ?? existingEntry.category,
            hasExplicitCategory: !!parsedCategory,
            usageContent: bodyContent || null,
            isNew: false,
            existingId: existingEntry.id,
          });
        } else {
          skipped++;
        }
      } else {
        toInsert.push({
          name: skillName,
          dirName: rawName,
          description: sanitizedDesc,
          category: parsedCategory,
          hasExplicitCategory: !!parsedCategory,
          usageContent: bodyContent || null,
          isNew: true,
        });
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // SKILL.md サブディレクトリ形式
        const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;
        const content = fs.readFileSync(skillFile, 'utf-8');
        processSkillContent(entry.name, content, skillFile);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // フラット .md 形式
        const filePath = path.join(skillsDir, entry.name);
        const rawName = entry.name.replace(/\.md$/, '');
        const content = fs.readFileSync(filePath, 'utf-8');
        processSkillContent(rawName, content, filePath);
      }
    }

    // Phase 1: フロントマターにカテゴリがない場合のみキーワード推定で仮設定（Ollama不使用）
    // フロントマターのカテゴリは権威的なソースとして変更しない
    const allToProcess = [...toInsert, ...toUpdate];

    for (const skill of allToProcess) {
      if (!skill.category) {
        skill.category = guessCategoryByKeyword(skill.name, skill.description);
      }
    }

    // 翻訳はバックグラウンドで実施するため、ここではスキップ
    const translations: string[] = allToProcess.map((s) => s.description);

    // DB に書き込み
    let imported = 0;
    let updated = 0;
    // バックグラウンド精度向上対象：フロントマターにカテゴリがないスキル
    const skillsForBgRefine: { id: string; name: string; description: string; usageContent: string | null }[] = [];

    for (let i = 0; i < allToProcess.length; i++) {
      const skill = allToProcess[i];
      const translated = translations[i];
      // 翻訳はバックグラウンドで実施するため、ここでは常にnull
      const descTranslated = translated !== skill.description ? translated : null;

      try {
        const triggerType = detectTriggerType(skill.description, skill.usageContent);
        const usageExamples = extractUsageExamples(skill.usageContent);

        // ON CONFLICT で重複を防止（UNIQUE制約: company_id + name）
        const syncResult2 = await db.execute(sql`
          INSERT INTO plugins (company_id, name, description, description_translated, translation_lang, category, usage_content, usage_examples, trigger_type)
          VALUES (
            ${req.companyId!}, ${skill.name}, ${skill.description},
            ${descTranslated ?? null}, ${descTranslated ? companyLang : null},
            ${skill.category ?? null}, ${skill.usageContent ?? null}, ${usageExamples ?? null}, ${triggerType}
          )
          ON CONFLICT (company_id, name)
          DO UPDATE SET
            description = EXCLUDED.description,
            description_translated = EXCLUDED.description_translated,
            translation_lang = EXCLUDED.translation_lang,
            category = COALESCE(EXCLUDED.category, plugins.category),
            usage_content = EXCLUDED.usage_content,
            usage_examples = COALESCE(plugins.usage_examples, EXCLUDED.usage_examples),
            trigger_type = EXCLUDED.trigger_type,
            updated_at = now()
          RETURNING id, (xmax = 0) AS inserted
        `);
        const row = syncResult2.rows[0] as { id?: string; inserted?: boolean } | undefined;
        if (row?.inserted) imported++;
        else updated++;
        // フロントマターにカテゴリがないスキルはバックグラウンドでOllama精度向上の対象
        if (row?.id && !skill.hasExplicitCategory) {
          skillsForBgRefine.push({ id: row.id, name: skill.name, description: skill.description, usageContent: skill.usageContent });
        }
      } catch (e) {
        errors.push({ name: skill.name, reason: e instanceof Error ? e.message : 'unknown' });
      }
    }

    // エージェントラッパーを自動生成（~/.claude/agents/ → ~/.claude/skills/<name>.md）
    const HOME = process.env.HOME || '/root';
    const agentsDir = path.join(HOME, '.claude', 'agents');
    const { created: wrappersCreated } = ensureAgentWrappers(agentsDir, skillsDir);

    // Phase 1完了: 即時レスポンスを返す（スキルはすでにDBに反映済み）
    res.json({
      data: { imported, updated, skipped, errors, wrappers_created: wrappersCreated },
      meta: { skills_dir: skillsDir, total_scanned: imported + updated + skipped + errors.length, bg_refine: skillsForBgRefine.length },
    });

    // Phase 2: バックグラウンドで翻訳・カテゴリ精度向上（レスポンス後に実行）
    // Phase 2: バックグラウンドでOllama精度向上（翻訳 + カテゴリ再分類）
    // フロントマターにカテゴリがなかったスキルのみ対象（タイムアウトしない設計）
    if (skillsForBgRefine.length > 0) {
      refineSyncInBackground(req.companyId!, companyLang, skillsForBgRefine).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/translate-pending — 翻訳が未完了のスキルをバックグラウンドで再開する
pluginsRouter.post('/translate-pending', async (req, res, next) => {
  try {
    const db = getDb();
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const companyLang = ((companyRows[0]?.settings ?? {}) as Record<string, unknown>).language as string ?? 'ja';

    if (companyLang === 'en') {
      res.json({ data: { message: '言語が英語のため翻訳不要', scheduled: 0 } });
      return;
    }

    // 翻訳が未完了のスキルを取得
    const rows = await db.execute(sql`
      SELECT id, name, description, usage_content
      FROM plugins
      WHERE company_id = ${req.companyId!}
        AND (description_translated IS NULL OR usage_examples_translated IS NULL OR usage_content_translated IS NULL)
      LIMIT 500
    `);
    const pending = rows.rows as { id: string; name: string; description: string; usage_content: string | null }[];

    res.json({ data: { scheduled: pending.length, lang: companyLang } });

    if (pending.length > 0) {
      refineSyncInBackground(req.companyId!, companyLang, pending.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        usageContent: r.usage_content,
      }))).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/regenerate-examples — 全スキルの usage_examples をLLMで再生成する
pluginsRouter.post('/regenerate-examples', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT id, name, description, usage_content
      FROM plugins
      WHERE company_id = ${req.companyId!}
        AND (description IS NOT NULL OR usage_content IS NOT NULL)
      ORDER BY updated_at ASC
      LIMIT 500
    `);
    const skills = rows.rows as { id: string; name: string; description: string | null; usage_content: string | null }[];

    res.json({ data: { scheduled: skills.length } });

    // バックグラウンドで処理
    (async () => {
      const { generateUsageExamples } = await import('../services/ollama.js');
      const CHUNK = 10;
      let done = 0;
      for (let i = 0; i < skills.length; i += CHUNK) {
        const chunk = skills.slice(i, i + CHUNK);
        try {
          const examples = await generateUsageExamples(
            chunk.map(s => ({ name: s.name, description: s.description ?? '', usageContent: s.usage_content }))
          );
          for (let j = 0; j < chunk.length; j++) {
            const ex = examples[j];
            if (!ex || ex.length === 0) continue;
            const exJson = JSON.stringify(ex);
            await db.execute(sql`
              UPDATE plugins
              SET usage_examples = ${exJson},
                  usage_examples_translated = ${exJson},
                  updated_at = now()
              WHERE id = ${chunk[j].id}
            `);
            done++;
          }
          console.log(`[regenerate-examples] ${done}/${skills.length} 完了`);
        } catch (err) {
          console.error(`[regenerate-examples] チャンク失敗:`, err);
        }
      }
      console.log(`[regenerate-examples] 全件完了: ${done}件`);
    })().catch((err) => console.error('[regenerate-examples] 失敗:', err));
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/generate-embeddings — embedding が未生成のスキルに対してバッチ生成する
pluginsRouter.post('/generate-embeddings', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT id, name, description, usage_content, category
      FROM plugins
      WHERE company_id = ${req.companyId!} AND embedding IS NULL
      LIMIT 500
    `);
    const targets = rows.rows as { id: string; name: string; description: string | null; usage_content: string | null; category: string | null }[];

    res.json({ data: { scheduled: targets.length } });

    // バックグラウンドでembedding生成
    (async () => {
      for (const p of targets) {
        try {
          await schedulePluginEmbedding(p.id, p);
        } catch { /* 1件失敗しても継続 */ }
      }
    })().catch(() => {});
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/sync-ecc — everything-claude-code リポジトリの更新チェック＆スキル同期
// GitHub API で最新コミット SHA を取得し、前回と差異があればインストール→スキル同期を実行する
pluginsRouter.post('/sync-ecc', async (req, res, next) => {
  try {
    const db = getDb();

    // 会社設定から前回の ECC コミット SHA を取得
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const settings = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;
    const lastCommitSha = settings.ecc_last_commit_sha as string | undefined;

    // GitHub API で最新コミット SHA を確認
    let latestSha: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const ghRes = await fetch(
        'https://api.github.com/repos/affaan-m/everything-claude-code/commits/main',
        {
          headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'maestro-app' },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (ghRes.ok) {
        const json = await ghRes.json() as { sha?: string };
        latestSha = json.sha ?? null;
      }
    } catch {
      // GitHub API 失敗時はスキップ（タイムアウト等）
    }

    if (!latestSha) {
      res.status(503).json({ error: 'github_unavailable', message: 'GitHub API に接続できませんでした' });
      return;
    }

    // 更新なし
    if (latestSha === lastCommitSha) {
      res.json({ data: { updated: false, sha: latestSha, message: '更新はありません' } });
      return;
    }

    // ECC リポジトリのインストール / 更新
    const HOME = process.env.HOME || '/root';
    const eccDir = path.join(HOME, '.claude', 'everything-claude-code');
    const skillsDir = path.join(HOME, '.claude', 'skills');
    const agentsDir = path.join(HOME, '.claude', 'agents');

    try {
      if (fs.existsSync(path.join(eccDir, '.git'))) {
        // 既存リポジトリを pull
        await execFileAsync('git', ['-C', eccDir, 'pull', '--ff-only'], { timeout: 60000 });
      } else {
        // 初回クローン
        fs.mkdirSync(eccDir, { recursive: true });
        await execFileAsync('git', ['clone', '--depth', '1', 'https://github.com/affaan-m/everything-claude-code.git', eccDir], { timeout: 120000 });
      }
    } catch (e) {
      res.status(500).json({ error: 'git_failed', message: `git 操作に失敗しました: ${e instanceof Error ? e.message : 'unknown'}` });
      return;
    }

    // skills/ と agents/ ディレクトリをコピー
    const eccSkillsDir = path.join(eccDir, 'skills');
    if (fs.existsSync(eccSkillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
      await execFileAsync('cp', ['-r', eccSkillsDir + '/.', skillsDir + '/'], { timeout: 30000 }).catch(() => {
        // cp -r ./ ./ 形式の代替
      });
      // Node でコピー（cpが利用できない環境のフォールバック）
      // 循環スタブ（"スキルを使って実行してください"）はコピーしない
      const isCircularStub = (filePath: string): boolean => {
        try {
          const c = fs.readFileSync(filePath, 'utf-8');
          const body = extractBodyAfterFrontmatter(c);
          return /スキルを使って実行してください/.test(body);
        } catch { return false; }
      };
      const copyDir = (src: string, dest: string) => {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dest, { recursive: true });
        for (const item of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, item.name);
          const destPath = path.join(dest, item.name);
          if (item.isDirectory()) {
            copyDir(srcPath, destPath);
          } else if (item.name === 'SKILL.md' && isCircularStub(srcPath)) {
            // 循環スタブはコピーしない（既存の正常ファイルを上書きしないため）
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyDir(eccSkillsDir, skillsDir);
    }

    const eccAgentsDir = path.join(eccDir, 'agents');
    if (fs.existsSync(eccAgentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
      const copyDir = (src: string, dest: string) => {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dest, { recursive: true });
        for (const item of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, item.name);
          const destPath = path.join(dest, item.name);
          if (item.isDirectory()) {
            // agents サブディレクトリはスキップ（フラット構造を維持）
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyDir(eccAgentsDir, agentsDir);
    }

    // company settings に最新 SHA を保存
    await db
      .update(companies)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ settings: { ...settings, ecc_last_commit_sha: latestSha } as any, updated_at: new Date() })
      .where(eq(companies.id, req.companyId!));

    res.json({
      data: {
        updated: true,
        sha: latestSha,
        previous_sha: lastCommitSha ?? null,
        message: 'スキルを最新バージョンに更新しました',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/update-all — DBのrepository_urlを正として全リポジトリをgit pull→DB同期
pluginsRouter.post('/update-all', async (req, res, next) => {
  try {
    const HOME = process.env.HOME || '/root';
    const skillsDir = path.join(HOME, '.claude', 'skills');
    const reposDir = path.join(HOME, '.claude', 'skills-repos');
    const eccDir = path.join(HOME, '.claude', 'everything-claude-code');
    const db = getDb();
    const results: { repo: string; status: string; error?: string }[] = [];

    const copyDir = (src: string, dest: string) => {
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(dest, { recursive: true });
      for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        if (item.isDirectory()) copyDir(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
      }
    };

    // 1. ECC リポジトリを更新（固定）
    try {
      if (fs.existsSync(path.join(eccDir, '.git'))) {
        await execFileAsync('git', ['-C', eccDir, 'pull', '--ff-only'], { timeout: 60000 });
      } else {
        fs.mkdirSync(eccDir, { recursive: true });
        await execFileAsync('git', ['clone', '--depth', '1', 'https://github.com/affaan-m/everything-claude-code.git', eccDir], { timeout: 120000 });
      }
      copyDir(path.join(eccDir, 'skills'), skillsDir);
      copyDir(path.join(eccDir, 'agents'), path.join(HOME, '.claude', 'agents'));
      results.push({ repo: 'everything-claude-code', status: 'updated' });
    } catch (e) {
      results.push({ repo: 'everything-claude-code', status: 'error', error: e instanceof Error ? e.message : 'unknown' });
    }

    // 2. DBに保存されたrepository_urlを正として各リポジトリをclone/pull
    const repoRows = await db
      .selectDistinct({ repository_url: plugins.repository_url })
      .from(plugins)
      .where(and(eq(plugins.company_id, req.companyId!), sql`${plugins.repository_url} IS NOT NULL`));

    for (const row of repoRows) {
      const repoUrl = row.repository_url!;
      let repoName: string;
      try {
        const parsed = new URL(repoUrl);
        repoName = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\//g, '_');
      } catch {
        results.push({ repo: repoUrl, status: 'error', error: 'invalid URL' });
        continue;
      }

      const repoDir = path.join(reposDir, repoName);
      try {
        fs.mkdirSync(reposDir, { recursive: true });
        if (fs.existsSync(path.join(repoDir, '.git'))) {
          await execFileAsync('git', ['-C', repoDir, 'pull', '--ff-only', 'origin', 'HEAD'], { timeout: 60000 });
        } else {
          await execFileAsync('git', ['clone', '--depth', '1', repoUrl, repoDir], { timeout: 120000 });
        }

        // .claude/skills/ 配下をシンボリックリンク（なければ作成）
        const cloneSkillsDir = path.join(repoDir, '.claude', 'skills');
        if (fs.existsSync(cloneSkillsDir)) {
          for (const entry of fs.readdirSync(cloneSkillsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const linkPath = path.join(skillsDir, entry.name);
            if (!fs.existsSync(linkPath)) {
              await execFileAsync('ln', ['-s', path.join(cloneSkillsDir, entry.name), linkPath]);
            }
          }
        } else {
          const linkPath = path.join(skillsDir, repoName);
          if (!fs.existsSync(linkPath)) {
            await execFileAsync('ln', ['-s', repoDir, linkPath]);
          }
        }
        results.push({ repo: repoName, status: 'updated' });
      } catch (e) {
        results.push({ repo: repoName, status: 'error', error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    // 3. ~/.claude/skills/ → DB 同期
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    if (fs.existsSync(skillsDir)) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillName = entry.name;
        const skillDir = fs.realpathSync(path.join(skillsDir, skillName));
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillMdPath)) { skipped++; continue; }

        const content = fs.readFileSync(skillMdPath, 'utf-8');
        const { description: parsedDesc } = parseFrontmatter(content);
        const sanitizedDesc = parsedDesc ? sanitizeDesc(parsedDesc) : null;
        const usageContent = await fetchUsageContent(skillName, skillsDir);
        const usageExamples = extractUsageExamples(usageContent);
        const triggerType = detectTriggerType(sanitizedDesc ?? '', usageContent);

        // ON CONFLICT DO UPDATE で重複を防止
        const result = await db.execute(sql`
          INSERT INTO plugins (company_id, name, description, usage_content, usage_examples, trigger_type)
          VALUES (${req.companyId!}, ${skillName}, ${sanitizedDesc ?? null}, ${usageContent ?? null}, ${usageExamples ?? null}, ${triggerType})
          ON CONFLICT (company_id, name)
          DO UPDATE SET
            description = EXCLUDED.description,
            usage_content = EXCLUDED.usage_content,
            usage_examples = COALESCE(plugins.usage_examples, EXCLUDED.usage_examples),
            trigger_type = EXCLUDED.trigger_type,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `);
        const wasInserted = (result.rows[0] as { inserted?: boolean })?.inserted;
        if (wasInserted) imported++;
        else updated++;
      }
    }

    // エージェントラッパーを自動生成（ECC更新でエージェントが追加された場合も対応）
    const agentsDir = path.join(HOME, '.claude', 'agents');
    const { created: wrappersCreated } = ensureAgentWrappers(agentsDir, skillsDir);

    res.json({ data: { repos: results, imported, updated, skipped, wrappers_created: wrappersCreated } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/categorize — 既存スキルをまとめてカテゴリ分類
pluginsRouter.post('/categorize', async (req, res, next) => {
  try {
    const db = getDb();
    // カテゴリが未設定のスキルを取得
    const uncategorized = await db
      .select({ id: plugins.id, name: plugins.name, description: plugins.description })
      .from(plugins)
      .where(and(eq(plugins.company_id, req.companyId!), sql`${plugins.category} IS NULL`));

    if (uncategorized.length === 0) {
      res.json({ data: { categorized: 0, message: '分類が必要なスキルはありません' } });
      return;
    }

    // バッチサイズを50に分けて処理（Claudeのレスポンス精度のため）
    const BATCH_SIZE = 50;
    let totalCategorized = 0;

    for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
      const batch = uncategorized.slice(i, i + BATCH_SIZE);
      const categories = await categorizeSkillsWithOllama(
        batch.map((s) => ({ name: s.name, description: s.description ?? '' }))
      );

      for (let j = 0; j < batch.length; j++) {
        await db
          .update(plugins)
          .set({ category: categories[j] })
          .where(and(eq(plugins.id, batch[j].id), eq(plugins.company_id, req.companyId!)));
        totalCategorized++;
      }
    }

    res.json({ data: { categorized: totalCategorized } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/fetch-usage — 既存スキルの usage_content と trigger_type を一括更新
pluginsRouter.post('/fetch-usage', async (req, res, next) => {
  try {
    const skillsDir = req.body?.skills_dir
      || path.join(process.env.HOME || '/root', '.claude', 'skills');
    const db = getDb();

    const allPlugins = await db
      .select({ id: plugins.id, name: plugins.name, description: plugins.description })
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));

    let updated = 0;
    let failed = 0;

    for (const plugin of allPlugins) {
      try {
        const usageContent = await fetchUsageContent(plugin.name, skillsDir);
        const triggerType = detectTriggerType(plugin.description, usageContent);
        await db
          .update(plugins)
          .set({ usage_content: usageContent, trigger_type: triggerType, updated_at: sql`now()` })
          .where(and(eq(plugins.id, plugin.id), eq(plugins.company_id, req.companyId!)));
        updated++;
      } catch {
        failed++;
      }
    }

    res.json({ data: { updated, failed, total: allPlugins.length } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/translate-usage — usage_content と description を対象言語に翻訳
pluginsRouter.post('/translate-usage', async (req, res, next) => {
  try {
    const db = getDb();

    // 会社の言語設定を取得
    const companyRows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const companySettings = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;
    const companyLang = (companySettings.language as string) ?? 'ja';
    const anthropicApiKey = (companySettings.anthropicApiKey as string) || process.env.ANTHROPIC_API_KEY || '';

    // --- Phase 1: description フィールドを一括翻訳（Anthropic API 使用）---
    let descTranslated = 0;
    if (companyLang !== 'en') {
      const descRows = await db
        .select({
          id: plugins.id,
          description: plugins.description,
          description_translated: plugins.description_translated,
          translation_lang: plugins.translation_lang,
        })
        .from(plugins)
        .where(
          and(
            eq(plugins.company_id, req.companyId!),
            sql`${plugins.description} IS NOT NULL`,
          ),
        );

      // translation_lang が現在の言語でないものだけ翻訳対象
      const needsDescTranslation = descRows.filter(
        (p) => p.translation_lang !== companyLang && p.description,
      );

      if (needsDescTranslation.length > 0) {
        const rawDescs = needsDescTranslation.map((p) => p.description!);
        const translated = await translateDescriptions(rawDescs, companyLang);

        for (let i = 0; i < needsDescTranslation.length; i++) {
          const row = needsDescTranslation[i];
          const translatedDesc = translated[i];
          if (translatedDesc && translatedDesc !== row.description) {
            await db
              .update(plugins)
              .set({
                description_translated: translatedDesc,
                translation_lang: companyLang,
                updated_at: sql`now()`,
              })
              .where(and(eq(plugins.id, row.id), eq(plugins.company_id, req.companyId!)));
            descTranslated++;
          }
        }
      }
    }

    // --- Phase 2: usage_content を Ollama (Qwen3:14b) で翻訳 ---
    const { translateUsageContent } = await import('../services/ollama.js');
    const allPlugins = await db
      .select({ id: plugins.id, name: plugins.name, usage_content: plugins.usage_content })
      .from(plugins)
      .where(and(eq(plugins.company_id, req.companyId!), sql`${plugins.usage_content} IS NOT NULL`));

    // 英語判定: 先頭200文字に ASCII が 60% 以上なら英語とみなす
    const needsUsageTranslation = allPlugins.filter((p) => {
      if (!p.usage_content) return false;
      const sample = p.usage_content.slice(0, 200);
      const ascii = sample.split('').filter((c) => c.charCodeAt(0) < 128).length;
      return ascii / sample.length > 0.6;
    });

    if (needsUsageTranslation.length === 0 && descTranslated === 0) {
      res.json({ data: { translated: 0, descTranslated, total: allPlugins.length, message: '翻訳が必要なスキルはありません' } });
      return;
    }

    let translated = 0;
    let failed = 0;

    // 1件ずつ Ollama で翻訳（usage_content が長いためバッチ不可）
    for (const plugin of needsUsageTranslation) {
      try {
        const result = await translateUsageContent(plugin.usage_content!, companyLang);
        if (result) {
          await db
            .update(plugins)
            .set({ usage_content: result, updated_at: sql`now()` })
            .where(and(eq(plugins.id, plugin.id), eq(plugins.company_id, req.companyId!)));
          translated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    res.json({ data: { translated, descTranslated, failed, total: needsUsageTranslation.length } });
  } catch (err) {
    next(err);
  }
});

// README.md からSKILL.md を自動生成する
function generateSkillMdFromReadme(readmeContent: string, skillName: string): string {
  // README 先頭から説明文を抽出（最初の段落）
  const lines = readmeContent.split('\n');
  const descLines: string[] = [];
  let inDesc = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inDesc && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && !trimmed.startsWith('<') && !trimmed.startsWith('[')) {
      inDesc = true;
    }
    if (inDesc) {
      if (trimmed === '' && descLines.length > 0) break;
      if (trimmed) descLines.push(trimmed);
    }
    if (descLines.length >= 3) break;
  }
  const desc = descLines.join(' ').slice(0, 300) || skillName;

  // README の最初の見出しをスキル名として使用
  const titleMatch = readmeContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : skillName;

  // README 本文から使い方セクションを抽出（## Usage / ## How to use / ## Getting Started など）
  const usageMatch = readmeContent.match(/##\s+(Usage|How to use|Getting Started|使い方|使用方法)[\s\S]*?(?=\n##|\n#|$)/i);
  const usageSection = usageMatch ? usageMatch[0].slice(0, 2000) : '';

  const body = usageSection || `## 使い方\n\nこのスキルを使うには、会話の中で \`${skillName}\` に関連する指示を出してください。\n\nREADME: ${title}`;

  return `---
name: ${skillName}
description: ${desc}
---

${body}
`;
}

// DESIGN.md ファイルを再帰探索してブランド名リストを返す
function findDesignMdFiles(dir: string): Array<{ brand: string; filePath: string; content: string }> {
  const results: Array<{ brand: string; filePath: string; content: string }> = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(path.join(currentDir, entry.name));
      } else if (entry.name === 'DESIGN.md') {
        const filePath = path.join(currentDir, entry.name);
        const brand = path.basename(currentDir);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          results.push({ brand, filePath, content });
        } catch { /* skip unreadable */ }
      }
    }
  }
  walk(dir);
  return results;
}

// POST /api/plugins/install-from-github — GitHubリポジトリからスキルをインストール
pluginsRouter.post('/install-from-github', async (req, res, next) => {
  try {
    const { repository_url } = req.body as { repository_url?: string };
    if (!repository_url) {
      res.status(400).json({ error: 'validation_failed', message: 'repository_url は必須です' });
      return;
    }
    // GitHub URL 検証
    let repoName: string;
    try {
      const parsed = new URL(repository_url);
      if (parsed.hostname !== 'github.com') throw new Error();
      repoName = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\//g, '_');
      if (!repoName) throw new Error();
    } catch {
      res.status(400).json({ error: 'validation_failed', message: 'GitHub の URL を指定してください（例: https://github.com/owner/repo）' });
      return;
    }

    const homeDir = process.env.HOME || '/root';
    const reposDir = path.join(homeDir, '.claude', 'skills-repos');
    const repoDir = path.join(reposDir, repoName);
    const skillsDir = path.join(homeDir, '.claude', 'skills');

    // リポジトリのクローン or pull
    await execFileAsync('mkdir', ['-p', reposDir]);
    await execFileAsync('mkdir', ['-p', skillsDir]);

    if (fs.existsSync(path.join(repoDir, '.git'))) {
      await execFileAsync('git', ['-C', repoDir, 'pull', '--ff-only', 'origin', 'HEAD'], { timeout: 60000 });
    } else {
      await execFileAsync('git', ['clone', '--depth', '1', repository_url, repoDir], { timeout: 120000 });
    }

    // .claude/skills/ 配下のスキルディレクトリをシンボリックリンク
    const cloneSkillsDir = path.join(repoDir, '.claude', 'skills');
    const installedSkillNames: string[] = [];

    if (fs.existsSync(cloneSkillsDir)) {
      const entries = fs.readdirSync(cloneSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const linkPath = path.join(skillsDir, entry.name);
        const targetPath = path.join(cloneSkillsDir, entry.name);
        if (!fs.existsSync(linkPath)) {
          await execFileAsync('ln', ['-s', targetPath, linkPath]);
        }
        installedSkillNames.push(entry.name);
      }
    } else {
      // .claude/skills/ がない場合はリポジトリ直下をスキルとしてリンク
      const linkPath = path.join(skillsDir, repoName);
      if (fs.existsSync(linkPath) && !fs.lstatSync(linkPath).isSymbolicLink()) {
        // ディレクトリが既に存在する場合はスキップ
      } else if (!fs.existsSync(linkPath)) {
        await execFileAsync('ln', ['-s', repoDir, linkPath]);
      }
      installedSkillNames.push(repoName);
    }

    const db = getDb();

    // DESIGN.md コレクション型リポジトリを検出してコレクションスキルとして登録
    const designFiles = findDesignMdFiles(repoDir);
    interface SkillRecord { name: string; description: string; isDesign: boolean; samplePrompt?: string }
    const skillRecords: SkillRecord[] = [];

    if (designFiles.length > 0) {
      // コレクション全体を表すスキルを1件登録
      const brandList = designFiles.map((d) => d.brand).join(', ');
      const collectionSkillName = repoName;
      const collectionSkillDir = path.join(skillsDir, collectionSkillName);
      const collectionSkillMd = path.join(collectionSkillDir, 'SKILL.md');

      // SKILL.md を生成（ブランド一覧をUsage として記述）
      const brandListMd = designFiles.map((d) =>
        `- **${d.brand}**: \`${d.brand}デザインで作って\` または \`${d.brand}のスタイルで\``
      ).join('\n');
      const collectionContent = `---
name: ${repoName}
description: ${designFiles.length}種類のブランドデザインガイド集（${designFiles.slice(0, 5).map((d) => d.brand).join('・')}など）
---

## 使い方

以下のいずれかのブランドデザインを指定して UI を作成できます。

\`\`\`
[ブランド名]デザインで作って
[ブランド名]のスタイルで画面を作って
\`\`\`

## 利用可能なブランド（${designFiles.length}種類）

${brandListMd}

## 例

- \`stripeデザインで決済フォームを作って\`
- \`notionスタイルでダッシュボードを作って\`
- \`appleのデザインシステムでランディングページを作って\`
`;

      if (fs.existsSync(collectionSkillDir) && fs.lstatSync(collectionSkillDir).isSymbolicLink()) {
        // シンボリックリンクの場合は書き込めないので実ディレクトリを作成
        const realTarget = fs.readlinkSync(collectionSkillDir);
        fs.writeFileSync(path.join(realTarget, 'SKILL.md'), collectionContent, 'utf-8');
      } else if (fs.existsSync(collectionSkillDir)) {
        fs.writeFileSync(collectionSkillMd, collectionContent, 'utf-8');
      }

      skillRecords.push({
        name: collectionSkillName,
        description: `${designFiles.length}種類のブランドデザインガイド集（${designFiles.slice(0, 5).map((d) => d.brand).join('・')}など）`,
        isDesign: true,
        samplePrompt: `stripeデザインで作って`,
      });
    }

    // 通常スキルの登録（SKILL.md がなければ README.md から自動生成）
    for (const skillName of installedSkillNames) {
      const skillDir = path.join(skillsDir, skillName);
      let skillMdPath = path.join(skillDir, 'SKILL.md');

      // SKILL.md がなければ README.md から生成
      if (!fs.existsSync(skillMdPath)) {
        const readmePath = path.join(skillDir, 'README.md');
        if (fs.existsSync(readmePath)) {
          const readmeContent = fs.readFileSync(readmePath, 'utf-8');
          const generated = generateSkillMdFromReadme(readmeContent, skillName);
          // シンボリックリンク先に書き込む
          const realDir = fs.lstatSync(skillDir).isSymbolicLink()
            ? fs.readlinkSync(skillDir)
            : skillDir;
          const realSkillMd = path.join(realDir, 'SKILL.md');
          fs.writeFileSync(realSkillMd, generated, 'utf-8');
          skillMdPath = realSkillMd;
        }
      }

      if (!fs.existsSync(skillMdPath)) continue;

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const { description: parsedDesc } = parseFrontmatter(content);
      const sanitizedDesc = parsedDesc ? sanitizeDesc(parsedDesc) : null;
      const usageBody = extractBodyAfterFrontmatter(content);
      const triggerType = detectTriggerType(sanitizedDesc ?? '', usageBody);

      // DESIGN.md コレクションとして既に登録済みならスキップ
      const alreadyInRecords = skillRecords.some((r) => r.name === skillName);

      const existing = await db
        .select({ id: plugins.id })
        .from(plugins)
        .where(and(eq(plugins.company_id, req.companyId!), eq(plugins.name, skillName)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(plugins).values({
          company_id: req.companyId!,
          name: skillName,
          description: sanitizedDesc ?? undefined,
          repository_url,
          usage_content: usageBody || null,
          trigger_type: triggerType,
        });
        if (!alreadyInRecords) {
          skillRecords.push({ name: skillName, description: sanitizedDesc ?? skillName, isDesign: false });
        }
      } else {
        await db.update(plugins)
          .set({
            description: sanitizedDesc ?? undefined,
            repository_url,
            usage_content: usageBody || null,
            trigger_type: triggerType,
            updated_at: new Date(),
          })
          .where(and(eq(plugins.id, existing[0].id), eq(plugins.company_id, req.companyId!)));
        if (!alreadyInRecords) {
          skillRecords.push({ name: skillName, description: sanitizedDesc ?? skillName, isDesign: false });
        }
      }
    }

    const imported = skillRecords.length;
    res.json({
      data: {
        imported,
        skills: installedSkillNames,
        skillDetails: skillRecords,
        repo: repoName,
        designCount: designFiles.length,
      },
    });
  } catch (err: unknown) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/use — スキル使用を記録（usage_count++, last_used_at 更新）
pluginsRouter.post('/:pluginId/use', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: plugins.id, usage_count: plugins.usage_count })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const newCount = (rows[0].usage_count ?? 0) + 1;
    await db
      .update(plugins)
      .set({ usage_count: newCount, last_used_at: new Date(), updated_at: new Date() })
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)));
    res.json({ data: { usage_count: newCount, last_used_at: new Date() } });
  } catch (err) {
    next(err);
  }
});

pluginsRouter.get('/:pluginId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(plugins)
      .where(
        and(
          eq(plugins.id, req.params.pluginId),
          eq(plugins.company_id, req.companyId!)
        )
      )
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/plugins/:pluginId — Plugin更新
pluginsRouter.patch('/:pluginId', async (req, res, next) => {
  try {
    const { name, description, repository_url, is_active } = req.body as {
      name?: string;
      description?: string;
      repository_url?: string;
      is_active?: boolean;
    };

    // repository_url — URL 形式チェック（存在する場合のみ）
    if (repository_url !== undefined && repository_url !== null) {
      try {
        const parsed = new URL(repository_url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        res.status(400).json({ error: 'validation_failed', message: 'repository_url は http または https で始まる URL を指定してください' });
        return;
      }
    }

    const db = getDb();
    const existing = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = sanitizeString(name);
    if (description !== undefined) updates.description = sanitizeDesc(description) ?? null;
    if (repository_url !== undefined) updates.repository_url = repository_url;
    if (is_active !== undefined) updates.enabled = is_active;
    const updated = await db.update(plugins)
      .set({ ...updates, updated_at: new Date() })
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .returning();
    res.json({ data: updated[0] });

    // name/description/usage_content が変わった場合はembeddingを再生成
    if (updates.name !== undefined || updates.description !== undefined) {
      schedulePluginEmbedding(updated[0].id, updated[0]);
    }
  } catch (err) {
    next(err);
  }
});

pluginsRouter.delete('/:pluginId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(plugins)
      .where(
        and(
          eq(plugins.id, req.params.pluginId),
          eq(plugins.company_id, req.companyId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Plugin Jobs ---

// GET /api/plugins/:pluginId/jobs — ジョブ一覧
pluginsRouter.get('/:pluginId/jobs', async (req, res, next) => {
  try {
    const db = getDb();
    // Pluginが自社に属するか確認
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const jobs = await db.select()
      .from(plugin_jobs)
      .where(eq(plugin_jobs.plugin_id, req.params.pluginId));
    res.json({ data: jobs });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/jobs — ジョブ作成
pluginsRouter.post('/:pluginId/jobs', async (req, res, next) => {
  try {
    const { name, schedule } = req.body as { name?: string; schedule?: string };
    if (!name) {
      res.status(400).json({ error: 'validation_failed', message: 'name は必須です' });
      return;
    }
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const job = await db.insert(plugin_jobs)
      .values({ plugin_id: req.params.pluginId, name: sanitizeString(name), schedule: schedule ? sanitizeString(schedule) : schedule })
      .returning();
    res.status(201).json({ data: job[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/jobs/:jobId/run — ジョブ実行（run record を作成）
pluginsRouter.post('/:pluginId/jobs/:jobId/run', async (req, res, next) => {
  try {
    const db = getDb();
    // Pluginが自社に属するか確認（アクセス制御）
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    // ジョブ存在確認
    const job = await db.select({ id: plugin_jobs.id })
      .from(plugin_jobs)
      .where(and(eq(plugin_jobs.id, req.params.jobId), eq(plugin_jobs.plugin_id, req.params.pluginId)))
      .limit(1);
    if (!job.length) {
      res.status(404).json({ error: 'not_found', message: 'Jobが見つかりません' });
      return;
    }
    // 実行レコード作成
    const run = await db.insert(plugin_job_runs)
      .values({ job_id: req.params.jobId, status: 'running' })
      .returning();
    // 即座にcompleted扱い（同期実行モデル）
    await db.update(plugin_job_runs)
      .set({ status: 'completed', ended_at: new Date() })
      .where(eq(plugin_job_runs.id, run[0].id));
    res.status(201).json({ data: { ...run[0], status: 'completed' } });
  } catch (err) {
    next(err);
  }
});

// --- Plugin Webhooks ---

// GET /api/plugins/:pluginId/webhooks — Webhook一覧
pluginsRouter.get('/:pluginId/webhooks', async (req, res, next) => {
  try {
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const hooks = await db.select()
      .from(plugin_webhooks)
      .where(eq(plugin_webhooks.plugin_id, req.params.pluginId));
    res.json({ data: hooks });
  } catch (err) {
    next(err);
  }
});

// POST /api/plugins/:pluginId/webhooks — Webhook作成
pluginsRouter.post('/:pluginId/webhooks', async (req, res, next) => {
  try {
    const { url, events } = req.body as { url?: string; events?: string[] };
    if (!url || !events?.length) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'url と events は必須です',
      });
      return;
    }
    // URL バリデーション（プロトコル + SSRF対策でプライベートIPブロック）
    const urlCheck = await validateWebhookUrl(url);
    if (!urlCheck.valid) {
      res.status(400).json({ error: 'validation_failed', message: urlCheck.reason || 'url が無効です' });
      return;
    }

    // events の内容を検証
    if (events.length > 20) {
      res.status(400).json({ error: 'validation_failed', message: 'events は最大20件です' });
      return;
    }
    const invalidEvents = events.filter(e => !VALID_WEBHOOK_EVENTS.includes(e as typeof VALID_WEBHOOK_EVENTS[number]));
    if (invalidEvents.length > 0) {
      res.status(400).json({ error: 'validation_failed', message: `無効な event: ${invalidEvents.join(', ')}。有効な値: ${VALID_WEBHOOK_EVENTS.join(', ')}` });
      return;
    }
    const db = getDb();
    const plugin = await db.select({ id: plugins.id })
      .from(plugins)
      .where(and(eq(plugins.id, req.params.pluginId), eq(plugins.company_id, req.companyId!)))
      .limit(1);
    if (!plugin.length) {
      res.status(404).json({ error: 'not_found', message: 'Pluginが見つかりません' });
      return;
    }
    const hook = await db.insert(plugin_webhooks)
      .values({ plugin_id: req.params.pluginId, url, events })
      .returning();
    res.status(201).json({ data: hook[0] });
  } catch (err) {
    next(err);
  }
});
