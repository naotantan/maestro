import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import i18n from '@maestro/i18n';
import api from '../../lib/api.ts';

interface Plugin {
  id: string;
  name: string;
  description?: string;
  repository_url?: string;
  version: string;
  enabled: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();

  // エージェント実行モード
  const [defaultAgentType, setDefaultAgentType] = useState<'claude_local' | 'claude_api'>('claude_local');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  // 組織情報
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');

  // 言語
  const [language, setLanguage] = useState(i18n.language || 'ja');

  // バックアップ設定
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupScheduleType, setBackupScheduleType] = useState('daily');
  const [backupScheduleTime, setBackupScheduleTime] = useState('02:00');
  const [backupRetentionDays, setBackupRetentionDays] = useState(30);
  const [backupDestinationType, setBackupDestinationType] = useState('local');
  const [backupLocalPath, setBackupLocalPath] = useState('');
  const [backupS3Bucket, setBackupS3Bucket] = useState('');
  const [backupS3Region, setBackupS3Region] = useState('');
  const [backupGcsBucket, setBackupGcsBucket] = useState('');
  const [backupGdriveFolderUrl, setBackupGdriveFolderUrl] = useState('');
  const [backupGdriveFolderId, setBackupGdriveFolderId] = useState('');
  const [backupCompression, setBackupCompression] = useState('gzip');
  const [backupEncryption, setBackupEncryption] = useState(true);
  const [backupIncludeActivityLog, setBackupIncludeActivityLog] = useState(false);
  const [backupNotifyEmail, setBackupNotifyEmail] = useState('');
  const [backupNotifyOnFailure, setBackupNotifyOnFailure] = useState(true);
  const [backupNotifyOnSuccess, setBackupNotifyOnSuccess] = useState(false);

  // プラグイン管理
  const queryClient = useQueryClient();
  const [showPluginForm, setShowPluginForm] = useState(false);
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginRepoUrl, setNewPluginRepoUrl] = useState('');

  const { data: plugins } = useQuery<Plugin[]>(
    'settings-plugins',
    () => api.get('/plugins').then((r) => r.data.data),
  );

  const handlePluginInstall = async () => {
    if (!newPluginName.trim()) return;
    try {
      await api.post('/plugins', {
        name: newPluginName.trim(),
        ...(newPluginRepoUrl.trim() ? { repository_url: newPluginRepoUrl.trim() } : {}),
      });
      setNewPluginName('');
      setNewPluginRepoUrl('');
      setShowPluginForm(false);
      queryClient.invalidateQueries('settings-plugins');
      queryClient.invalidateQueries('plugins');
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    }
  };

  const handlePluginToggle = async (plugin: Plugin) => {
    try {
      await api.patch(`/plugins/${plugin.id}`, { is_active: !plugin.enabled });
      queryClient.invalidateQueries('settings-plugins');
      queryClient.invalidateQueries('plugins');
    } catch {
      showMessage('error', t('errors.serverError'));
    }
  };

  const handlePluginUninstall = async (plugin: Plugin) => {
    if (!window.confirm(t('settings.pluginsUninstallConfirm', { name: plugin.name }))) return;
    try {
      await api.delete(`/plugins/${plugin.id}`);
      queryClient.invalidateQueries('settings-plugins');
      queryClient.invalidateQueries('plugins');
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    }
  };

  // UI状態
  const [saving, setSaving] = useState('');  // セクション名
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // 設定を取得
    api.get('/settings').then(r => {
      const s = r.data.data;
      if (s.defaultAgentType) setDefaultAgentType(s.defaultAgentType);
      setHasApiKey(!!s.hasAnthropicApiKey);

      // バックアップ設定を読み込む
      if (s.backup) {
        const b = s.backup as Record<string, unknown>;
        if (typeof b.enabled === 'boolean') setBackupEnabled(b.enabled);
        if (typeof b.scheduleType === 'string') setBackupScheduleType(b.scheduleType);
        if (typeof b.scheduleTime === 'string') setBackupScheduleTime(b.scheduleTime);
        if (typeof b.retentionDays === 'number') setBackupRetentionDays(b.retentionDays);
        if (typeof b.destinationType === 'string') setBackupDestinationType(b.destinationType);
        if (typeof b.localPath === 'string') setBackupLocalPath(b.localPath);
        if (typeof b.s3Bucket === 'string') setBackupS3Bucket(b.s3Bucket);
        if (typeof b.s3Region === 'string') setBackupS3Region(b.s3Region);
        if (typeof b.gcsBucket === 'string') setBackupGcsBucket(b.gcsBucket);
        if (typeof b.gdriveFolderId === 'string') {
          setBackupGdriveFolderId(b.gdriveFolderId);
          setBackupGdriveFolderUrl(`https://drive.google.com/drive/folders/${b.gdriveFolderId}`);
        }
        if (typeof b.compression === 'string') setBackupCompression(b.compression);
        if (typeof b.encryption === 'boolean') setBackupEncryption(b.encryption);
        if (typeof b.includeActivityLog === 'boolean') setBackupIncludeActivityLog(b.includeActivityLog);
        if (typeof b.notifyEmail === 'string') setBackupNotifyEmail(b.notifyEmail);
        if (typeof b.notifyOnFailure === 'boolean') setBackupNotifyOnFailure(b.notifyOnFailure);
        if (typeof b.notifyOnSuccess === 'boolean') setBackupNotifyOnSuccess(b.notifyOnSuccess);
      }
    }).catch(() => {});

    // 組織情報を取得
    api.get('/org').then(r => {
      const o = r.data.data;
      setOrgName(o.name || '');
      setOrgDescription(o.description || '');
    }).catch(() => {});
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveAgentMode = async () => {
    setSaving('agentMode');
    try {
      const body: Record<string, string> = { defaultAgentType };
      // APIキーが入力されている場合のみ送信
      if (anthropicApiKey) body.anthropicApiKey = anthropicApiKey;
      await api.patch('/settings', body);
      if (anthropicApiKey) setHasApiKey(true);
      setAnthropicApiKey('');
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleSaveOrg = async () => {
    setSaving('org');
    try {
      await api.patch('/org', { name: orgName, description: orgDescription });
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleSaveLanguage = async () => {
    setSaving('language');
    try {
      await i18n.changeLanguage(language);
      localStorage.setItem('language', language);
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleSaveBackup = async () => {
    setSaving('backup');
    try {
      const backupPayload: Record<string, unknown> = { enabled: backupEnabled };
      if (backupEnabled) {
        backupPayload.scheduleType = backupScheduleType;
        backupPayload.scheduleTime = backupScheduleTime;
        backupPayload.retentionDays = backupRetentionDays;
        backupPayload.destinationType = backupDestinationType;
        backupPayload.compression = backupCompression;
        backupPayload.encryption = backupEncryption;
        backupPayload.includeActivityLog = backupIncludeActivityLog;
        if (backupNotifyEmail) backupPayload.notifyEmail = backupNotifyEmail;
        backupPayload.notifyOnFailure = backupNotifyOnFailure;
        backupPayload.notifyOnSuccess = backupNotifyOnSuccess;
        if (backupDestinationType === 'local') backupPayload.localPath = backupLocalPath;
        if (backupDestinationType === 's3') {
          backupPayload.s3Bucket = backupS3Bucket;
          backupPayload.s3Region = backupS3Region;
        }
        if (backupDestinationType === 'gcs') backupPayload.gcsBucket = backupGcsBucket;
        if (backupDestinationType === 'gdrive') backupPayload.gdriveFolderId = backupGdriveFolderId;
      }
      await api.patch('/settings', { backup: backupPayload });
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      {message && (
        <div className={`px-4 py-2 rounded border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-200'
            : 'bg-red-900 border-red-700 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* エージェント実行モード */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('settings.agentMode')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('settings.agentModeDesc')}</p>
        </div>

        <div className="space-y-3">
          {/* claude_local */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            defaultAgentType === 'claude_local'
              ? 'border-sky-500 bg-sky-900/20'
              : 'border-slate-600 hover:border-slate-500'
          }`}>
            <input
              type="radio"
              name="agentType"
              value="claude_local"
              checked={defaultAgentType === 'claude_local'}
              onChange={() => setDefaultAgentType('claude_local')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium">{t('settings.agentModeSubscription')}</div>
              <div className="text-sm text-slate-400 mt-0.5">{t('settings.agentModeSubscriptionDesc')}</div>
            </div>
          </label>

          {/* claude_api */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            defaultAgentType === 'claude_api'
              ? 'border-sky-500 bg-sky-900/20'
              : 'border-slate-600 hover:border-slate-500'
          }`}>
            <input
              type="radio"
              name="agentType"
              value="claude_api"
              checked={defaultAgentType === 'claude_api'}
              onChange={() => setDefaultAgentType('claude_api')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium">{t('settings.agentModeApi')}</div>
              <div className="text-sm text-slate-400 mt-0.5">{t('settings.agentModeApiDesc')}</div>
            </div>
          </label>
        </div>

        {/* Anthropic API キー（claude_api 選択時のみ表示） */}
        {defaultAgentType === 'claude_api' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('settings.anthropicApiKey')}</label>
            {hasApiKey && !anthropicApiKey && (
              <p className="text-xs text-slate-400">{t('settings.anthropicApiKeySet')}</p>
            )}
            <input
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder={hasApiKey ? '••••••••••••' : t('settings.anthropicApiKeyPlaceholder')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            />
          </div>
        )}

        <button
          onClick={handleSaveAgentMode}
          disabled={saving === 'agentMode'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'agentMode' ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* 組織情報 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <h2 className="text-lg font-bold">{t('settings.orgInfo')}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.orgName')}</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.orgDescription')}</label>
            <textarea
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white resize-none"
            />
          </div>
        </div>
        <button
          onClick={handleSaveOrg}
          disabled={saving === 'org'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'org' ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* 言語設定 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-3">
        <h2 className="text-lg font-bold">{t('settings.language')}</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label={t('settings.language')}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
        >
          <option value="ja">{t('settings.languageJa')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
        <button
          onClick={handleSaveLanguage}
          disabled={saving === 'language'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'language' ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* バックアップ設定 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('settings.backup')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('settings.backupDesc')}</p>
        </div>

        {/* バックアップ有効化 */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={backupEnabled}
            onChange={(e) => setBackupEnabled(e.target.checked)}
            className="w-4 h-4 accent-sky-500"
          />
          <span className="font-medium">{t('settings.backupEnable')}</span>
        </label>

        {backupEnabled && (
          <div className="space-y-4 border-t border-slate-700 pt-4">
            {/* スケジュール */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupSchedule')}</label>
                <select
                  value={backupScheduleType}
                  onChange={(e) => setBackupScheduleType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="daily">{t('settings.backupScheduleDaily')}</option>
                  <option value="weekly">{t('settings.backupScheduleWeekly')}</option>
                  <option value="monthly">{t('settings.backupScheduleMonthly')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupTime')}</label>
                <input
                  type="time"
                  value={backupScheduleTime}
                  onChange={(e) => setBackupScheduleTime(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            {/* 保持期間 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.backupRetention')}</label>
              <select
                value={backupRetentionDays}
                onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                {[7, 14, 30, 60, 90, 180].map((d) => (
                  <option key={d} value={d}>{t('settings.backupRetentionDays', { days: d })}</option>
                ))}
                <option value={365}>{t('settings.backupRetentionYear')}</option>
              </select>
            </div>

            {/* バックアップ先 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.backupDestination')}</label>
              <select
                value={backupDestinationType}
                onChange={(e) => setBackupDestinationType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="local">{t('settings.backupDestinationLocal')}</option>
                <option value="s3">{t('settings.backupDestinationS3')}</option>
                <option value="gcs">{t('settings.backupDestinationGcs')}</option>
                <option value="gdrive">{t('settings.backupDestinationGdrive')}</option>
              </select>
            </div>

            {/* Google Drive 設定 */}
            {backupDestinationType === 'gdrive' && (
              <div className="space-y-3 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">{t('settings.backupGdriveDescription')}</p>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('settings.backupGdriveFolderUrl')}</label>
                  <input
                    type="url"
                    value={backupGdriveFolderUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      setBackupGdriveFolderUrl(url);
                      // URL からフォルダ ID を自動抽出
                      const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                      setBackupGdriveFolderId(match?.[1] ?? '');
                    }}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm"
                  />
                </div>
                {backupGdriveFolderId && (
                  <p className="text-xs text-slate-400">
                    {t('settings.backupGdriveFolderIdDetected')}
                    <span className="font-mono text-sky-400 ml-1">{backupGdriveFolderId}</span>
                  </p>
                )}
                {backupGdriveFolderUrl && !backupGdriveFolderId && (
                  <p className="text-xs text-red-400">{t('settings.backupGdriveFolderIdInvalid')}</p>
                )}
                <p className="text-xs text-slate-500">{t('settings.backupGdriveAuthNote')}</p>
              </div>
            )}

            {/* ローカルパス */}
            {backupDestinationType === 'local' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupLocalPath')}</label>
                <input
                  type="text"
                  value={backupLocalPath}
                  onChange={(e) => setBackupLocalPath(e.target.value)}
                  placeholder="/backup"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            )}

            {/* S3設定 */}
            {backupDestinationType === 's3' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('settings.backupS3Bucket')}</label>
                  <input
                    type="text"
                    value={backupS3Bucket}
                    onChange={(e) => setBackupS3Bucket(e.target.value)}
                    placeholder="my-backup-bucket"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('settings.backupS3Region')}</label>
                  <input
                    type="text"
                    value={backupS3Region}
                    onChange={(e) => setBackupS3Region(e.target.value)}
                    placeholder="ap-northeast-1"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            )}

            {/* GCS設定 */}
            {backupDestinationType === 'gcs' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupGcsBucket')}</label>
                <input
                  type="text"
                  value={backupGcsBucket}
                  onChange={(e) => setBackupGcsBucket(e.target.value)}
                  placeholder="my-gcs-bucket"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            )}

            {/* オプション */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupCompression')}</label>
                <select
                  value={backupCompression}
                  onChange={(e) => setBackupCompression(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="gzip">{t('settings.backupCompressionGzip')}</option>
                  <option value="none">{t('settings.backupCompressionNone')}</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupEncryption}
                    onChange={(e) => setBackupEncryption(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="text-sm font-medium">{t('settings.backupEncryption')}</span>
                </label>
              </div>
            </div>

            {/* 対象データ */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupIncludeActivityLog}
                  onChange={(e) => setBackupIncludeActivityLog(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
                <span className="text-sm font-medium">{t('settings.backupIncludeActivityLog')}</span>
                <span className="text-xs text-slate-400">{t('settings.backupIncludeActivityLogNote')}</span>
              </label>
            </div>

            {/* 通知設定 */}
            <div className="space-y-3 border-t border-slate-700 pt-4">
              <h3 className="text-sm font-semibold text-slate-300">{t('settings.backupNotifications')}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.backupNotifyEmail')}</label>
                <input
                  type="email"
                  value={backupNotifyEmail}
                  onChange={(e) => setBackupNotifyEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupNotifyOnFailure}
                    onChange={(e) => setBackupNotifyOnFailure(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="text-sm">{t('settings.backupNotifyOnFailure')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupNotifyOnSuccess}
                    onChange={(e) => setBackupNotifyOnSuccess(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="text-sm">{t('settings.backupNotifyOnSuccess')}</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSaveBackup}
          disabled={saving === 'backup'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'backup' ? t('common.loading') : t('common.save')}
        </button>
      </div>

      {/* プラグイン管理 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold">{t('settings.pluginsTitle')}</h2>
            <p className="text-sm text-slate-400 mt-1">{t('settings.pluginsDesc')}</p>
          </div>
          <button
            onClick={() => setShowPluginForm(true)}
            className="bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded text-sm font-medium shrink-0"
          >
            {t('settings.pluginsAdd')}
          </button>
        </div>

        {/* インストールフォーム */}
        {showPluginForm && (
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 space-y-3">
            <h3 className="text-sm font-bold">{t('settings.pluginsInstallTitle')}</h3>
            <input
              type="text"
              value={newPluginName}
              onChange={(e) => setNewPluginName(e.target.value)}
              placeholder={t('plugins.pluginNamePlaceholder')}
              className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
            />
            <input
              type="text"
              value={newPluginRepoUrl}
              onChange={(e) => setNewPluginRepoUrl(e.target.value)}
              placeholder={t('plugins.repositoryUrlPlaceholder')}
              className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePluginInstall}
                disabled={!newPluginName.trim()}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
              >
                {t('plugins.install')}
              </button>
              <button
                onClick={() => { setShowPluginForm(false); setNewPluginName(''); setNewPluginRepoUrl(''); }}
                className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* インストール済みプラグイン一覧 */}
        {(plugins ?? []).length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">{t('plugins.noPluginsInstalled')}</p>
        ) : (
          <div className="space-y-2">
            {(plugins ?? []).map((plugin) => (
              <div
                key={plugin.id}
                className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3 border border-slate-600"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{plugin.name}</p>
                  {plugin.repository_url && (
                    <p className="text-slate-400 text-xs truncate mt-0.5">{plugin.repository_url}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {/* 有効/無効トグル */}
                  <button
                    onClick={() => handlePluginToggle(plugin)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      plugin.enabled
                        ? 'bg-green-700 hover:bg-green-800 text-green-100'
                        : 'bg-slate-500 hover:bg-slate-400 text-slate-300'
                    }`}
                  >
                    {plugin.enabled ? t('plugins.enabled') : t('plugins.disabled')}
                  </button>
                  {/* アンインストール */}
                  <button
                    onClick={() => handlePluginUninstall(plugin)}
                    className="px-3 py-1 rounded text-xs font-medium bg-red-900 hover:bg-red-800 text-red-200 transition-colors"
                  >
                    {t('plugins.uninstall')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
