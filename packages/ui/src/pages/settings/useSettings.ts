import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@maestro/i18n';
import i18n from '@maestro/i18n';
import api from '../../lib/api.ts';
import type { BackupState } from './BackupSection.tsx';

const INITIAL_BACKUP: BackupState = {
  enabled: false,
  scheduleType: 'daily',
  scheduleTime: '02:00',
  retentionDays: 30,
  destinationType: 'local',
  localPath: '',
  s3Bucket: '',
  s3Region: '',
  gcsBucket: '',
  gdriveFolderUrl: '',
  gdriveFolderId: '',
  compression: 'gzip',
  encryption: true,
  includeActivityLog: false,
  notifyEmail: '',
  notifyOnFailure: true,
  notifyOnSuccess: false,
};

export default function useSettings() {
  const { t } = useTranslation();
  const [defaultAgentType, setDefaultAgentType] = useState<'claude_local' | 'claude_api'>('claude_local');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [language, setLanguage] = useState(i18n.language || 'ja');
  const [backup, setBackup] = useState<BackupState>(INITIAL_BACKUP);
  const [saving, setSaving] = useState('');
  const [running, setRunning] = useState(false);
  const [gdriveRefreshKey, setGdriveRefreshKey] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data.data;
      if (s.defaultAgentType) setDefaultAgentType(s.defaultAgentType);
      if (s.language) {
        setLanguage(s.language);
        i18n.changeLanguage(s.language);
        localStorage.setItem('language', s.language);
      }
      setHasApiKey(!!s.hasAnthropicApiKey);
      if (s.backup) {
        const b = s.backup as Record<string, unknown>;
        setBackup(prev => ({
          ...prev,
          ...(typeof b.enabled === 'boolean' && { enabled: b.enabled }),
          ...(typeof b.scheduleType === 'string' && { scheduleType: b.scheduleType }),
          ...(typeof b.scheduleTime === 'string' && { scheduleTime: b.scheduleTime }),
          ...(typeof b.retentionDays === 'number' && { retentionDays: b.retentionDays }),
          ...(typeof b.destinationType === 'string' && { destinationType: b.destinationType }),
          ...(typeof b.localPath === 'string' && { localPath: b.localPath }),
          ...(typeof b.s3Bucket === 'string' && { s3Bucket: b.s3Bucket }),
          ...(typeof b.s3Region === 'string' && { s3Region: b.s3Region }),
          ...(typeof b.gcsBucket === 'string' && { gcsBucket: b.gcsBucket }),
          ...(typeof b.gdriveFolderId === 'string' && {
            gdriveFolderId: b.gdriveFolderId,
            gdriveFolderUrl: `https://drive.google.com/drive/folders/${b.gdriveFolderId}`,
          }),
          ...(typeof b.compression === 'string' && { compression: b.compression }),
          ...(typeof b.encryption === 'boolean' && { encryption: b.encryption }),
          ...(typeof b.includeActivityLog === 'boolean' && { includeActivityLog: b.includeActivityLog }),
          ...(typeof b.notifyEmail === 'string' && { notifyEmail: b.notifyEmail }),
          ...(typeof b.notifyOnFailure === 'boolean' && { notifyOnFailure: b.notifyOnFailure }),
          ...(typeof b.notifyOnSuccess === 'boolean' && { notifyOnSuccess: b.notifyOnSuccess }),
        }));
      }
    }).catch(() => {});

    api.get('/org').then(r => {
      const o = r.data.data;
      setOrgName(o.name || '');
      setOrgDescription(o.description || '');
    }).catch(() => {});
  }, []);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleSaveAgentMode = async () => {
    setSaving('agentMode');
    try {
      const body: Record<string, string> = { defaultAgentType };
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
      await api.patch('/settings', { language });
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
      const payload: Record<string, unknown> = { enabled: backup.enabled };
      if (backup.enabled) {
        Object.assign(payload, {
          scheduleType: backup.scheduleType,
          scheduleTime: backup.scheduleTime,
          retentionDays: backup.retentionDays,
          destinationType: backup.destinationType,
          compression: backup.compression,
          encryption: backup.encryption,
          includeActivityLog: backup.includeActivityLog,
          notifyOnFailure: backup.notifyOnFailure,
          notifyOnSuccess: backup.notifyOnSuccess,
        });
        if (backup.notifyEmail) payload.notifyEmail = backup.notifyEmail;
        if (backup.destinationType === 'local') payload.localPath = backup.localPath;
        if (backup.destinationType === 's3') {
          payload.s3Bucket = backup.s3Bucket;
          payload.s3Region = backup.s3Region;
        }
        if (backup.destinationType === 'gcs') payload.gcsBucket = backup.gcsBucket;
        if (backup.destinationType === 'gdrive') payload.gdriveFolderId = backup.gdriveFolderId;
      }
      await api.patch('/settings', { backup: payload });
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleRunBackup = async () => {
    setRunning(true);
    try {
      const r = await api.post('/settings/backup/run');
      const result = r.data.data as { message: string };
      showMessage('success', result.message || t('settings.backupRunSuccess'));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showMessage('error', msg || t('settings.backupRunFailed'));
      // 認証エラーの可能性があるため Google Drive ステータスを再チェック
      setGdriveRefreshKey((k) => k + 1);
    } finally {
      setRunning(false);
    }
  };

  const handleBackupChange = useCallback((patch: Partial<BackupState>) => {
    setBackup(prev => ({ ...prev, ...patch }));
  }, []);

  const handleResetSkillUsage = async () => {
    if (!window.confirm(t('plugins.resetUsageStatsConfirm'))) return;
    setSaving('resetSkillUsage');
    try {
      await api.post('/plugins/reset-usage');
      showMessage('success', t('plugins.resetUsageStatsSuccess'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  return {
    defaultAgentType,
    setDefaultAgentType,
    anthropicApiKey,
    setAnthropicApiKey,
    hasApiKey,
    orgName,
    setOrgName,
    orgDescription,
    setOrgDescription,
    language,
    setLanguage,
    backup,
    handleBackupChange,
    saving,
    running,
    gdriveRefreshKey,
    message,
    handleSaveAgentMode,
    handleSaveOrg,
    handleSaveLanguage,
    handleSaveBackup,
    handleRunBackup,
    handleResetSkillUsage,
  };
}
