import { Router, type Router as RouterType } from 'express';
import { getDb, agents, heartbeat_runs, agent_api_keys } from '@maestro/db';
import { eq, and, desc } from 'drizzle-orm';
import { generateApiKey, encrypt } from '../utils/crypto';
import { API_KEY_PREFIXES, type AgentType } from '@maestro/shared';
import { sanitizeString } from '../middleware/validate';

// 有効なエージェントタイプ一覧（AgentType ユニオンを配列で保持）
const VALID_AGENT_TYPES: AgentType[] = [
  'claude_local',   // Claude サブスクリプション（claude -p CLI、APIキー不要）
  'claude_api',     // Anthropic API キー（従量課金）
  'codex_local',
  'gemini_local',
  'openclaw_gateway',
  'opencode_local',
  'pi_local',
];

export const agentsRouter: RouterType = Router();

// GET /api/agents
agentsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select().from(agents).where(eq(agents.company_id, req.companyId!));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/agents
agentsRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, description, config } = req.body as {
      name?: string;
      type?: string;
      description?: string;
      config?: Record<string, unknown>;
    };
    if (!name || !type) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'name と type は必須です',
      });
      return;
    }
    // type が有効な AgentType かチェック
    if (!VALID_AGENT_TYPES.includes(type as AgentType)) {
      res.status(400).json({
        error: 'validation_failed',
        message: `type が無効です。有効な値: ${VALID_AGENT_TYPES.join(', ')}`,
      });
      return;
    }
    // claude_api は config.apiKey が必須
    if (type === 'claude_api' && !config?.apiKey) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'claude_api タイプには config.apiKey（Anthropic API キー）が必要です',
      });
      return;
    }
    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : description;
    const db = getDb();
    // APIキーが含まれる場合は暗号化して保存（平文DB保存防止）
    const configToSave = config ? encryptApiKeyInConfig(config) : config;
    const newAgent = await db
      .insert(agents)
      .values({
        company_id: req.companyId!,
        name: sanitizedName,
        type,
        description: sanitizedDescription,
        config: configToSave,
      })
      .returning();

    // API キー生成
    const { rawKey, keyHash, prefix } = await generateApiKey(API_KEY_PREFIXES.AGENT);
    await db.insert(agent_api_keys).values({
      agent_id: newAgent[0].id,
      key_hash: keyHash,
      key_prefix: prefix,
      name: '初期キー',
    });

    res.status(201).json({ data: newAgent[0], agentApiKey: rawKey });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:agentId
agentsRouter.get('/:agentId', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, req.params.agentId), eq(agents.company_id, req.companyId!)))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'not_found', message: 'エージェントが見つかりません' });
      return;
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/agents/:agentId
agentsRouter.patch('/:agentId', async (req, res, next) => {
  try {
    const { name, description, config, enabled } = req.body as {
      name?: string;
      description?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    };
    const db = getDb();
    // APIキーが含まれる場合は暗号化して保存（平文DB保存防止）
    const configToSave = config !== undefined ? encryptApiKeyInConfig(config) : undefined;
    const updated = await db
      .update(agents)
      .set({
        ...(name && { name: sanitizeString(name) }),
        ...(description !== undefined && { description: description ? sanitizeString(description) : description }),
        ...(configToSave !== undefined && { config: configToSave }),
        ...(enabled !== undefined && { enabled }),
        updated_at: new Date(),
      })
      .where(and(eq(agents.id, req.params.agentId), eq(agents.company_id, req.companyId!)))
      .returning();
    if (!updated.length) {
      res.status(404).json({ error: 'not_found', message: 'エージェントが見つかりません' });
      return;
    }
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/agents/:agentId
agentsRouter.delete('/:agentId', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .delete(agents)
      .where(
        and(eq(agents.id, req.params.agentId), eq(agents.company_id, req.companyId!))
      );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/agents/:agentId/heartbeat — ハートビート更新
agentsRouter.post('/:agentId/heartbeat', async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .update(agents)
      .set({ last_heartbeat_at: new Date() })
      .where(
        and(eq(agents.id, req.params.agentId), eq(agents.company_id, req.companyId!))
      );
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:agentId/runs — 実行履歴
agentsRouter.get('/:agentId/runs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);
    const db = getDb();
    // 自社エージェントか確認してからログを返す
    const agentCheck = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, req.params.agentId), eq(agents.company_id, req.companyId!)))
      .limit(1);
    if (!agentCheck.length) {
      res.status(404).json({ error: 'not_found', message: 'エージェントが見つかりません' });
      return;
    }
    const runs = await db
      .select()
      .from(heartbeat_runs)
      .where(eq(heartbeat_runs.agent_id, req.params.agentId))
      .orderBy(desc(heartbeat_runs.started_at))
      .limit(limit);
    res.json({ data: runs });
  } catch (err) {
    next(err);
  }
});

/** config.apiKey が存在する場合のみ暗号化する（他のフィールドはそのまま） */
function encryptApiKeyInConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (typeof config.apiKey !== 'string' || !config.apiKey) return config;
  try {
    return { ...config, apiKey: encrypt(config.apiKey) };
  } catch {
    // ENCRYPTION_KEY 未設定時はエラーを上位に伝播させる
    throw new Error('APIキーの暗号化に失敗しました。ENCRYPTION_KEY 環境変数を確認してください');
  }
}
