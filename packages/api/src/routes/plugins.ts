import { Router, type Router as RouterType } from 'express';
import { getDb, plugins, plugin_jobs, plugin_job_runs, plugin_webhooks, companies } from '@maestro/db';
import { eq, and, sql, gte, desc, inArray } from 'drizzle-orm';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sanitizeString } from '../middleware/validate';

/**
 * スキル名+説明をもとにカテゴリを一括割り当てする。
 * claude -p CLI を使用。失敗時は 'その他' を返す。
 */
async function categorizeSkills(
  skills: { name: string; description: string }[]
): Promise<string[]> {
  if (skills.length === 0) return [];

  const categories = SKILL_CATEGORIES.join(', ');
  const input = JSON.stringify(skills.map((s) => ({ name: s.name, description: s.description.slice(0, 200) })));
  const prompt =
    `以下のスキル一覧を、次のカテゴリのいずれかに分類してください: ${categories}\n` +
    `入力と同じ順番で、カテゴリ名だけのJSON配列を返してください。他のテキストは不要です。\n\n${input}`;

  try {
    const { stdout } = await execFileAsync('claude', ['-p', prompt], {
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const match = stdout.trim().match(/\[[\s\S]*\]/);
    if (!match) return skills.map(() => 'その他');
    const parsed: unknown = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.length === skills.length) {
      return parsed.map((v) =>
        typeof v === 'string' && (SKILL_CATEGORIES as readonly string[]).includes(v) ? v : 'その他'
      );
    }
    return skills.map(() => 'その他');
  } catch {
    return skills.map(() => 'その他');
  }
}

/** 説明文のサニタイズ（HTMLエスケープなし・トリムのみ）
 * Reactが自動エスケープするためDBにHTMLエスケープは不要 */
function sanitizeDesc(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  return input.trim().slice(0, 10000);
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
 * Anthropic API を直接呼び出して descriptions を targetLang に一括翻訳する。
 * apiKey が未設定の場合は元の説明をそのまま返す。
 */
async function translateDescriptions(
  descriptions: string[],
  targetLang: string,
  apiKey: string,
): Promise<string[]> {
  if (targetLang === 'en' || descriptions.length === 0) return descriptions;
  if (!apiKey) return descriptions;

  const langName = getLangDisplayName(targetLang);

  // 50件ずつに分割してレート制限を回避
  const CHUNK = 50;
  const result: string[] = [];

  for (let i = 0; i < descriptions.length; i += CHUNK) {
    const chunk = descriptions.slice(i, i + CHUNK);
    const prompt =
      `Translate each description in this JSON array to ${langName}. ` +
      `Return a JSON array with the same number of elements, each being the translation. ` +
      `Output ONLY the JSON array, no other text.\n\n${JSON.stringify(chunk)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        result.push(...chunk);
        continue;
      }

      const json = await res.json() as { content?: Array<{ type: string; text: string }> };
      const text = json.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed: unknown = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length === chunk.length) {
          result.push(...parsed.map((v, idx) => (typeof v === 'string' ? v : chunk[idx])));
          continue;
        }
      }
      result.push(...chunk);
    } catch {
      result.push(...chunk);
    }
  }

  return result;
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

    const rows = await db
      .select()
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));

    // 言語に合った description を返す
    const data = rows.map((p) => ({
      ...p,
      description:
        p.translation_lang === companyLang && p.description_translated
          ? p.description_translated
          : p.description,
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
      const [translated] = await translateDescriptions([sanitizedDesc], companyLang, anthropicApiKey);
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

    res.status(201).json({ data: newPlugin[0] });
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

    await db
      .update(plugins)
      .set({
        usage_count: sql`${plugins.usage_count} + 1`,
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(
        inArray(plugins.id, matched.map(m => m.id)),
        eq(plugins.company_id, req.companyId!),
      ));

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

    // 期間内に最後に使用されたスキルをusage_count順で取得
    const rows = await db
      .select({
        name: plugins.name,
        usage_count: plugins.usage_count,
        last_used_at: plugins.last_used_at,
      })
      .from(plugins)
      .where(
        and(
          eq(plugins.company_id, req.companyId!),
          eq(plugins.enabled, true),
          gte(plugins.last_used_at, since),
        )
      )
      .orderBy(desc(plugins.usage_count))
      .limit(10);

    // 期間内データが0件の場合、使用実績ありのスキルを全期間で表示（フォールバック）
    let top10 = rows.map(r => ({
      name: r.name,
      count: r.usage_count,
      last_used_at: r.last_used_at,
      is_fallback: false,
    }));

    let isFallback = false;
    if (top10.length === 0) {
      const fallbackRows = await db
        .select({
          name: plugins.name,
          usage_count: plugins.usage_count,
          last_used_at: plugins.last_used_at,
        })
        .from(plugins)
        .where(
          and(
            eq(plugins.company_id, req.companyId!),
            eq(plugins.enabled, true),
            gte(plugins.usage_count, 1),
          )
        )
        .orderBy(desc(plugins.usage_count))
        .limit(10);

      top10 = fallbackRows.map(r => ({
        name: r.name,
        count: r.usage_count,
        last_used_at: r.last_used_at,
        is_fallback: true,
      }));
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
      usageContent: string | null;
      isNew: boolean;
      existingId?: string;
    };
    const toInsert: SkillEntry[] = [];
    const toUpdate: SkillEntry[] = [];
    let skipped = 0;
    const errors: { name: string; reason: string }[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      const content = fs.readFileSync(skillFile, 'utf-8');
      const { name: parsedName, description: parsedDesc, category: parsedCategory } = parseFrontmatter(content);

      // 循環スタブ検出: "Xスキルを使って実行してください" パターンはスキップ
      // （agent wrapperの "Xエージェントを使って実行してください" は正常なデリゲーションなのでOK）
      const bodyContent = extractBodyAfterFrontmatter(content);
      if (/スキルを使って実行してください/.test(bodyContent)) {
        errors.push({ name: entry.name, reason: '循環スタブ（スキルを使って実行してください）のためスキップ' });
        continue;
      }

      // Always use the directory name as the invocation key stored in DB.
      // The frontmatter `name:` field may differ (e.g. "ckm:banner-design" vs dir "banner-design"),
      // which would generate broken slash commands like `/ckmbanner-design`.
      const skillName = sanitizeString(entry.name);
      const description = parsedDesc ?? `Imported from ${entry.name}`;
      const usageContent = extractBodyAfterFrontmatter(content);

      const sanitizedDesc = sanitizeDesc(description) ?? description;
      // Migration: look up by current directory name first, then by old frontmatter-based name.
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
            dirName: entry.name,
            description: sanitizedDesc,
            category: parsedCategory ?? existingEntry.category,
            usageContent: usageContent || null,
            isNew: false,
            existingId: existingEntry.id,
          });
        } else {
          skipped++;
        }
      } else {
        toInsert.push({ name: skillName, dirName: entry.name, description: sanitizedDesc, category: parsedCategory, usageContent: usageContent || null, isNew: true });
      }
    }

    // 翻訳が必要なものをまとめて翻訳
    const needsTranslation = companyLang !== 'en';
    const allToProcess = [...toInsert, ...toUpdate];
    let translations: string[] = allToProcess.map((s) => s.description);

    if (needsTranslation && allToProcess.length > 0) {
      translations = await translateDescriptions(
        allToProcess.map((s) => s.description),
        companyLang,
        anthropicApiKey,
      );
    }

    // カテゴリがないものをまとめて分類
    const needsCategoryIdx = allToProcess
      .map((s, i) => (s.category ? null : i))
      .filter((i): i is number => i !== null);

    if (needsCategoryIdx.length > 0) {
      const toCategorizeBatch = needsCategoryIdx.map((i) => ({
        name: allToProcess[i].name,
        description: allToProcess[i].description,
      }));
      const assignedCategories = await categorizeSkills(toCategorizeBatch);
      needsCategoryIdx.forEach((skillIdx, batchIdx) => {
        allToProcess[skillIdx].category = assignedCategories[batchIdx];
      });
    }

    // DB に書き込み
    let imported = 0;
    let updated = 0;

    for (let i = 0; i < allToProcess.length; i++) {
      const skill = allToProcess[i];
      const translated = translations[i];
      const descTranslated = needsTranslation && translated !== skill.description ? translated : null;

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
            usage_examples = EXCLUDED.usage_examples,
            trigger_type = EXCLUDED.trigger_type,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `);
        const wasInserted2 = (syncResult2.rows[0] as { inserted?: boolean })?.inserted;
        if (wasInserted2) imported++;
        else updated++;
      } catch (e) {
        errors.push({ name: skill.name, reason: e instanceof Error ? e.message : 'unknown' });
      }
    }

    // エージェントラッパーを自動生成（~/.claude/agents/ → ~/.claude/skills/<name>.md）
    const HOME = process.env.HOME || '/root';
    const agentsDir = path.join(HOME, '.claude', 'agents');
    const { created: wrappersCreated } = ensureAgentWrappers(agentsDir, skillsDir);

    res.json({
      data: { imported, updated, skipped, errors, wrappers_created: wrappersCreated },
      meta: { skills_dir: skillsDir, total_scanned: imported + updated + skipped + errors.length },
    });
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
            usage_examples = EXCLUDED.usage_examples,
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
      const categories = await categorizeSkills(
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

// POST /api/plugins/translate-usage — usage_content を日本語に翻訳（claude -p CLIを使用）
pluginsRouter.post('/translate-usage', async (req, res, next) => {
  try {
    const db = getDb();

    // 英語の usage_content を持つスキルを取得（すでに日本語の場合はスキップ）
    const allPlugins = await db
      .select({ id: plugins.id, name: plugins.name, usage_content: plugins.usage_content })
      .from(plugins)
      .where(and(eq(plugins.company_id, req.companyId!), sql`${plugins.usage_content} IS NOT NULL`));

    // 英語判定: 先頭200文字に ASCII が 60% 以上なら英語とみなす
    const needsTranslation = allPlugins.filter((p) => {
      if (!p.usage_content) return false;
      const sample = p.usage_content.slice(0, 200);
      const ascii = sample.split('').filter((c) => c.charCodeAt(0) < 128).length;
      return ascii / sample.length > 0.6;
    });

    if (needsTranslation.length === 0) {
      res.json({ data: { translated: 0, total: allPlugins.length, message: '翻訳が必要なスキルはありません' } });
      return;
    }

    let translated = 0;
    let failed = 0;

    // 1件ずつ claude -p で翻訳（usage_content が長いためバッチ不可）
    for (const plugin of needsTranslation) {
      try {
        const content = plugin.usage_content!;
        // 5000文字以下に切り詰め
        const truncated = content.slice(0, 5000);
        const prompt =
          `以下の技術ドキュメントを日本語に翻訳してください。` +
          `Markdown書式を維持してください。コード例はそのまま英語で残してください。` +
          `翻訳結果だけを出力してください。\n\n${truncated}`;

        const { stdout } = await execFileAsync('claude', ['-p', prompt], {
          timeout: 60000,
          maxBuffer: 2 * 1024 * 1024,
        });

        const result = stdout.trim();
        if (result.length > 50) {
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

    res.json({ data: { translated, failed, total: needsTranslation.length } });
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
