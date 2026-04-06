import { Router, type Router as RouterType } from 'express';
import { getDb, companies } from '@maestro/db';
import { eq } from 'drizzle-orm';
import type { AgentType } from '@maestro/shared';
import { isValidEmail } from '../middleware/validate';
import { getGdriveAuthStatus } from '../services/gdrive.js';
import { runBackup } from '../services/backup.js';

export const settingsRouter: RouterType = Router();

const VALID_AGENT_TYPES: AgentType[] = ['claude_local', 'claude_api'];

// バックアップ設定の型定義
interface BackupConfig {
  enabled?: boolean;
  scheduleType?: string;
  scheduleTime?: string;
  timezone?: string;
  retentionDays?: number;
  destinationType?: string;
  s3Bucket?: string;
  s3Region?: string;
  gcsBucket?: string;
  localPath?: string;
  gdriveFolderId?: string;   // Google Drive フォルダ ID（URLから抽出済み）
  includeActivityLog?: boolean;
  compression?: string;
  encryption?: boolean;
  notifyEmail?: string;
  notifyOnFailure?: boolean;
  notifyOnSuccess?: boolean;
}

// Google Drive フォルダ ID のフォーマット検証（英数字・ハイフン・アンダースコア）
const GDRIVE_FOLDER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

const VALID_SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_DESTINATION_TYPES = ['local', 's3', 'gcs', 'gdrive'];
const VALID_RETENTION_DAYS = [7, 14, 30, 60, 90, 180, 365];
const VALID_COMPRESSION_TYPES = ['none', 'gzip'];
// HH:mm 形式（00:00〜23:59）
const SCHEDULE_TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
// パストラバーサル検出
const PATH_TRAVERSAL_REGEX = /\.\./;

// バックアップ設定バリデーション関数
// enabled=false のとき他フィールドのバリデーションをスキップ
// enabled=true のとき scheduleType, scheduleTime, destinationType が必須
// destinationType に応じて追加フィールドが必須
// 戻り値: エラーメッセージ文字列 or null（正常）
function validateBackupConfig(backup: BackupConfig): string | null {
  // フォーマット検証は enabled に関わらず常に実施する
  // gdriveFolderId フォーマット検証（英数字・ハイフン・アンダースコアのみ）
  if (backup.gdriveFolderId !== undefined && backup.gdriveFolderId !== '') {
    if (!GDRIVE_FOLDER_ID_REGEX.test(backup.gdriveFolderId)) {
      return 'gdriveFolderId の形式が無効です（英数字・ハイフン・アンダースコアのみ）';
    }
  }
  // localPath のパストラバーサル検証（enabled に関わらず）
  if (backup.localPath !== undefined && PATH_TRAVERSAL_REGEX.test(backup.localPath)) {
    return 'localPath に無効なパスが含まれています';
  }

  // enabled=false の場合はスケジュール・必須フィールドのバリデーションをスキップ
  if (backup.enabled === false) {
    return null;
  }

  // 以下は enabled=true または undefined（新規設定時）の場合
  if (backup.scheduleType !== undefined && !VALID_SCHEDULE_TYPES.includes(backup.scheduleType)) {
    return `scheduleType が無効です。有効な値: ${VALID_SCHEDULE_TYPES.join(', ')}`;
  }
  if (backup.scheduleTime !== undefined && backup.scheduleTime !== '' && !SCHEDULE_TIME_REGEX.test(backup.scheduleTime)) {
    return 'scheduleTime は HH:mm 形式（例: 02:00）で指定してください';
  }
  if (backup.retentionDays !== undefined && !VALID_RETENTION_DAYS.includes(backup.retentionDays)) {
    return `retentionDays が無効です。有効な値: ${VALID_RETENTION_DAYS.join(', ')}`;
  }
  if (backup.destinationType !== undefined && !VALID_DESTINATION_TYPES.includes(backup.destinationType)) {
    return `destinationType が無効です。有効な値: ${VALID_DESTINATION_TYPES.join(', ')}`;
  }
  if (backup.compression !== undefined && !VALID_COMPRESSION_TYPES.includes(backup.compression)) {
    return `compression が無効です。有効な値: ${VALID_COMPRESSION_TYPES.join(', ')}`;
  }
  if (backup.notifyEmail !== undefined && backup.notifyEmail !== '') {
    if (!isValidEmail(backup.notifyEmail)) {
      return 'notifyEmail のメールアドレス形式が無効です';
    }
  }

  // enabled=true の場合の必須チェック
  if (backup.enabled === true) {
    if (!backup.scheduleType) {
      return 'バックアップ有効時は scheduleType が必要です';
    }
    if (!backup.scheduleTime) {
      return 'バックアップ有効時は scheduleTime が必要です';
    }
    if (!backup.destinationType) {
      return 'バックアップ有効時は destinationType が必要です';
    }
    if (backup.destinationType === 's3') {
      if (!backup.s3Bucket) return 's3 バックアップには s3Bucket が必要です';
      if (!backup.s3Region) return 's3 バックアップには s3Region が必要です';
    }
    if (backup.destinationType === 'gcs') {
      if (!backup.gcsBucket) return 'gcs バックアップには gcsBucket が必要です';
    }
    if (backup.destinationType === 'local') {
      if (!backup.localPath) return 'local バックアップには localPath が必要です';
    }
    if (backup.destinationType === 'gdrive') {
      if (!backup.gdriveFolderId) return 'gdrive バックアップには gdriveFolderId が必要です';
    }
  }

  return null;
}

// GET /api/settings/backup/gdrive/status — Google Drive 認証状態確認（ADC）
settingsRouter.get('/backup/gdrive/status', async (_req, res, next) => {
  try {
    const connected = await getGdriveAuthStatus();
    res.json({ data: { connected } });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/backup/run — バックアップ即時実行
settingsRouter.post('/backup/run', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);

    const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    const backup = (settings.backup ?? {}) as Record<string, unknown>;

    const result = await runBackup({
      destinationType: (backup.destinationType as string) || 'local',
      compression: backup.compression as string | undefined,
      gdriveFolderId: backup.gdriveFolderId as string | undefined,
      localPath: backup.localPath as string | undefined,
      language: (settings.language as string) || 'ja',
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings — 組織設定取得
settingsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const settings = rows[0]?.settings ?? {};
    // APIキーはマスク（存在確認のみ）
    const masked = {
      ...settings,
      anthropicApiKey: settings.anthropicApiKey ? '***masked***' : null,
      hasAnthropicApiKey: !!settings.anthropicApiKey,
    };
    res.json({ data: masked });
  } catch (err) {
    next(err);
  }
});

const VALID_LANGUAGES = ['ja', 'en'];

// PATCH /api/settings — 組織設定更新
settingsRouter.patch('/', async (req, res, next) => {
  try {
    const { defaultAgentType, anthropicApiKey, backup, language } = req.body as {
      defaultAgentType?: string;
      anthropicApiKey?: string;
      backup?: BackupConfig;
      language?: string;
    };

    if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
      res.status(400).json({
        error: 'validation_failed',
        message: `language が無効です。有効な値: ${VALID_LANGUAGES.join(', ')}`,
      });
      return;
    }

    // バリデーション
    if (defaultAgentType && !VALID_AGENT_TYPES.includes(defaultAgentType as AgentType)) {
      res.status(400).json({
        error: 'validation_failed',
        message: `defaultAgentType が無効です。有効な値: ${VALID_AGENT_TYPES.join(', ')}`,
      });
      return;
    }
    if (defaultAgentType === 'claude_api' && anthropicApiKey === '') {
      res.status(400).json({
        error: 'validation_failed',
        message: 'claude_api モードには anthropicApiKey が必要です',
      });
      return;
    }

    // バックアップ設定のバリデーション
    if (backup !== undefined) {
      const backupError = validateBackupConfig(backup);
      if (backupError) {
        res.status(400).json({ error: 'validation_failed', message: backupError });
        return;
      }
    }

    const db = getDb();
    // 現在の settings を取得してマージ
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const current = (rows[0]?.settings ?? {}) as Record<string, unknown>;

    const updated: Record<string, unknown> = { ...current };
    if (defaultAgentType !== undefined) updated.defaultAgentType = defaultAgentType;
    if (language !== undefined) updated.language = language;
    // anthropicApiKey が明示的に渡された場合のみ更新（空文字は削除）
    if (anthropicApiKey !== undefined) {
      if (anthropicApiKey === '') {
        delete updated.anthropicApiKey;
      } else {
        updated.anthropicApiKey = anthropicApiKey;
      }
    }
    // バックアップ設定のマージ
    if (backup !== undefined) {
      updated.backup = { ...(current.backup as Record<string, unknown> ?? {}), ...backup };
    }

    // マージ後の整合性チェック — claude_api なのにキーがない状態を防ぐ
    if (updated.defaultAgentType === 'claude_api' && !updated.anthropicApiKey) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'claude_api モードには anthropicApiKey が必要です',
      });
      return;
    }

    await db
      .update(companies)
      .set({ settings: updated, updated_at: new Date() })
      .where(eq(companies.id, req.companyId!));

    res.json({
      data: {
        ...updated,
        anthropicApiKey: updated.anthropicApiKey ? '***masked***' : null,
        hasAnthropicApiKey: !!updated.anthropicApiKey,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/plane — Plane 設定取得
settingsRouter.get('/plane', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    const plane = (settings.plane ?? {}) as Record<string, string>;
    res.json({
      data: {
        baseUrl: plane.baseUrl || 'http://localhost:8090',
        workspaceSlug: plane.workspaceSlug || '',
        projectId: plane.projectId || '',
        apiToken: plane.apiToken ? '***masked***' : '',
        hasApiToken: !!plane.apiToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings/plane — Plane 設定保存
settingsRouter.patch('/plane', async (req, res, next) => {
  try {
    const { baseUrl, workspaceSlug, projectId, apiToken, adminEmail, adminPassword } = req.body as {
      baseUrl?: string;
      workspaceSlug?: string;
      projectId?: string;
      apiToken?: string;
      adminEmail?: string;
      adminPassword?: string;
    };

    const db = getDb();
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const current = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    const currentPlane = (current.plane ?? {}) as Record<string, string>;

    const updatedPlane: Record<string, string> = { ...currentPlane };
    if (baseUrl !== undefined) updatedPlane.baseUrl = baseUrl;
    if (workspaceSlug !== undefined) updatedPlane.workspaceSlug = workspaceSlug;
    if (projectId !== undefined) updatedPlane.projectId = projectId;
    if (apiToken !== undefined && apiToken !== '***masked***') {
      if (apiToken === '') delete updatedPlane.apiToken;
      else updatedPlane.apiToken = apiToken;
    }
    if (adminEmail !== undefined) {
      if (adminEmail === '') delete updatedPlane.adminEmail;
      else updatedPlane.adminEmail = adminEmail;
    }
    if (adminPassword !== undefined && adminPassword !== '***masked***') {
      if (adminPassword === '') delete updatedPlane.adminPassword;
      else updatedPlane.adminPassword = adminPassword;
    }

    await db
      .update(companies)
      .set({ settings: { ...current, plane: updatedPlane }, updated_at: new Date() })
      .where(eq(companies.id, req.companyId!));

    res.json({ data: { saved: true } });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/claude-integration — Claude Code 連携用の設定情報を返す
settingsRouter.get('/claude-integration', async (req, res, next) => {
  try {
    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://maestro:changeme@127.0.0.1:5432/maestro';
    const apiUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

    const mcpConfig = {
      mcpServers: {
        'maestro-db': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', dbUrl],
        },
      },
    };

    res.json({ data: { dbUrl, apiUrl, mcpConfig } });
  } catch (err) {
    next(err);
  }
});
