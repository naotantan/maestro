import { useState, useEffect } from 'react';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import type { BackupState } from './BackupSection.tsx';

interface BackupDestinationFieldsProps {
  backup: BackupState;
  onBackupChange: (patch: Partial<BackupState>) => void;
  refreshKey?: number;
}

function GdriveFields({ backup, onBackupChange, refreshKey }: BackupDestinationFieldsProps) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    setConnected(null);
    api
      .get('/settings/backup/gdrive/status')
      .then((r) => setConnected(r.data.data.connected as boolean))
      .catch(() => setConnected(false));
  }, [refreshKey]);

  return (
    <div className="space-y-3 p-4 bg-th-surface-1 rounded-th-md border border-th-border">
      <p className="text-sm text-th-text-3">{t('settings.backupGdriveDescription')}</p>

      {/* 認証状態 */}
      <div className="flex items-center gap-2 text-sm">
        {connected === null ? (
          <span className="text-th-text-3">{t('common.loading')}</span>
        ) : connected ? (
          <span className="text-th-success">{t('settings.backupGdriveConnected')}</span>
        ) : (
          <div className="space-y-2 w-full">
            <span className="text-th-danger">{t('settings.backupGdriveNotReady')}</span>
            <div className="bg-th-surface-2 rounded-th-md px-3 py-2 font-mono text-xs text-th-text-2 select-all">
              gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.file
            </div>
            <p className="text-xs text-th-text-3">{t('settings.backupGdriveAdcNote')}</p>
          </div>
        )}
      </div>

      {/* フォルダ URL */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('settings.backupGdriveFolderUrl')}</label>
        <input
          type="url"
          value={backup.gdriveFolderUrl}
          onChange={(e) => {
            const url = e.target.value;
            const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            onBackupChange({
              gdriveFolderUrl: url,
              gdriveFolderId: match?.[1] ?? '',
            });
          }}
          placeholder="https://drive.google.com/drive/folders/..."
          className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text font-mono text-sm"
        />
      </div>
      {backup.gdriveFolderId && (
        <p className="text-xs text-th-text-3">
          {t('settings.backupGdriveFolderIdDetected')}
          <span className="font-mono text-th-accent ml-1">{backup.gdriveFolderId}</span>
        </p>
      )}
      {backup.gdriveFolderUrl && !backup.gdriveFolderId && (
        <p className="text-xs text-th-danger">{t('settings.backupGdriveFolderIdInvalid')}</p>
      )}
    </div>
  );
}

export default function BackupDestinationFields({
  backup,
  onBackupChange,
  refreshKey,
}: BackupDestinationFieldsProps) {
  const { t } = useTranslation();

  switch (backup.destinationType) {
    case 'gdrive':
      return <GdriveFields backup={backup} onBackupChange={onBackupChange} refreshKey={refreshKey} />;

    case 'local':
      return (
        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.backupLocalPath')}</label>
          <input
            type="text"
            value={backup.localPath}
            onChange={(e) => onBackupChange({ localPath: e.target.value })}
            placeholder="/backup"
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
          />
        </div>
      );

    case 's3':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.backupS3Bucket')}</label>
            <input
              type="text"
              value={backup.s3Bucket}
              onChange={(e) => onBackupChange({ s3Bucket: e.target.value })}
              placeholder="my-backup-bucket"
              className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.backupS3Region')}</label>
            <input
              type="text"
              value={backup.s3Region}
              onChange={(e) => onBackupChange({ s3Region: e.target.value })}
              placeholder="ap-northeast-1"
              className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
            />
          </div>
        </div>
      );

    case 'gcs':
      return (
        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.backupGcsBucket')}</label>
          <input
            type="text"
            value={backup.gcsBucket}
            onChange={(e) => onBackupChange({ gcsBucket: e.target.value })}
            placeholder="my-gcs-bucket"
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
          />
        </div>
      );

    default:
      return null;
  }
}
