import { Router, type Router as RouterType } from 'express';
import { getDb, plugins, plugin_jobs, plugin_job_runs, plugin_webhooks } from '@company/db';
import { eq, and } from 'drizzle-orm';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import { sanitizeString } from '../middleware/validate';

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

export const pluginsRouter: RouterType = Router();

// --- Plugin CRUD ---

pluginsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(plugins)
      .where(eq(plugins.company_id, req.companyId!));
    res.json({ data: rows });
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
    const db = getDb();
    const newPlugin = await db
      .insert(plugins)
      .values({
        company_id: req.companyId!,
        name: sanitizeString(name),
        description: description ? sanitizeString(description) : description,
        repository_url,
      })
      .returning();
    res.status(201).json({ data: newPlugin[0] });
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
    if (description !== undefined) updates.description = description ? sanitizeString(description) : description;
    if (repository_url !== undefined) updates.repository_url = repository_url;
    if (is_active !== undefined) updates.is_active = is_active;
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
