import { useTranslation } from '@maestro/i18n';
import BackupDestinationFields from './BackupDestinationFields.tsx';

export interface BackupState {
  enabled: boolean;
  scheduleType: string;
  scheduleTime: string;
  retentionDays: number;
  destinationType: string;
  localPath: string;
  s3Bucket: string;
  s3Region: string;
  gcsBucket: string;
  gdriveFolderUrl: string;
  gdriveFolderId: string;
  compression: string;
  encryption: boolean;
  includeActivityLog: boolean;
  notifyEmail: string;
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
}

interface BackupSectionProps {
  backup: BackupState;
  onBackupChange: (patch: Partial<BackupState>) => void;
  saving: boolean;
  onSave: () => void;
  running: boolean;
  onRunNow: () => void;
  gdriveRefreshKey: number;
}

export default function BackupSection({
  backup,
  onBackupChange,
  saving,
  onSave,
  running,
  onRunNow,
  gdriveRefreshKey,
}: BackupSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t('settings.backup')}</h2>
        <p className="text-sm text-th-text-3 mt-1">{t('settings.backupDesc')}</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={backup.enabled}
          onChange={(e) => onBackupChange({ enabled: e.target.checked })}
          className="w-4 h-4 accent-th-accent"
        />
        <span className="font-medium">{t('settings.backupEnable')}</span>
      </label>

      {/* Destination selector — enabled に関わらず常に表示 */}
      <div className="space-y-4 border-t border-th-border pt-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.backupDestination')}</label>
          <select
            value={backup.destinationType}
            onChange={(e) => onBackupChange({ destinationType: e.target.value })}
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
          >
            <option value="local">{t('settings.backupDestinationLocal')}</option>
            <option value="s3">{t('settings.backupDestinationS3')}</option>
            <option value="gcs">{t('settings.backupDestinationGcs')}</option>
            <option value="gdrive">{t('settings.backupDestinationGdrive')}</option>
          </select>
        </div>

        {/* Destination-specific fields（認証 UI を含む） */}
        <BackupDestinationFields backup={backup} onBackupChange={onBackupChange} refreshKey={gdriveRefreshKey} />

        {/* Run Now */}
        <div>
          <button
            onClick={onRunNow}
            disabled={running || saving}
            aria-label={t('settings.backupRunNow')}
            className="bg-th-surface-1 border border-th-border hover:bg-th-surface-2 disabled:opacity-50 px-4 py-2 rounded-th-md font-medium transition-colors text-sm"
          >
            {running ? t('settings.backupRunning') : t('settings.backupRunNow')}
          </button>
        </div>
      </div>

      {backup.enabled && (
        <div className="space-y-4 border-t border-th-border pt-4">
          {/* Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.backupSchedule')}</label>
              <select
                value={backup.scheduleType}
                onChange={(e) => onBackupChange({ scheduleType: e.target.value })}
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
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
                value={backup.scheduleTime}
                onChange={(e) => onBackupChange({ scheduleTime: e.target.value })}
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
              />
            </div>
          </div>

          {/* Retention */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.backupRetention')}</label>
            <select
              value={backup.retentionDays}
              onChange={(e) => onBackupChange({ retentionDays: Number(e.target.value) })}
              className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
            >
              {[7, 14, 30, 60, 90, 180].map((d) => (
                <option key={d} value={d}>{t('settings.backupRetentionDays', { days: d })}</option>
              ))}
              <option value={365}>{t('settings.backupRetentionYear')}</option>
            </select>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.backupCompression')}</label>
              <select
                value={backup.compression}
                onChange={(e) => onBackupChange({ compression: e.target.value })}
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
              >
                <option value="gzip">{t('settings.backupCompressionGzip')}</option>
                <option value="none">{t('settings.backupCompressionNone')}</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backup.encryption}
                  onChange={(e) => onBackupChange({ encryption: e.target.checked })}
                  className="w-4 h-4 accent-th-accent"
                />
                <span className="text-sm font-medium">{t('settings.backupEncryption')}</span>
              </label>
            </div>
          </div>

          {/* Data targets */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={backup.includeActivityLog}
                onChange={(e) => onBackupChange({ includeActivityLog: e.target.checked })}
                className="w-4 h-4 accent-th-accent"
              />
              <span className="text-sm font-medium">{t('settings.backupIncludeActivityLog')}</span>
              <span className="text-xs text-th-text-3">{t('settings.backupIncludeActivityLogNote')}</span>
            </label>
          </div>

          {/* Notifications */}
          <div className="space-y-3 border-t border-th-border pt-4">
            <h3 className="text-sm font-semibold text-th-text-2">{t('settings.backupNotifications')}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.backupNotifyEmail')}</label>
              <input
                type="email"
                value={backup.notifyEmail}
                onChange={(e) => onBackupChange({ notifyEmail: e.target.value })}
                placeholder="admin@example.com"
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
              />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backup.notifyOnFailure}
                  onChange={(e) => onBackupChange({ notifyOnFailure: e.target.checked })}
                  className="w-4 h-4 accent-th-accent"
                />
                <span className="text-sm">{t('settings.backupNotifyOnFailure')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backup.notifyOnSuccess}
                  onChange={(e) => onBackupChange({ notifyOnSuccess: e.target.checked })}
                  className="w-4 h-4 accent-th-accent"
                />
                <span className="text-sm">{t('settings.backupNotifyOnSuccess')}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        aria-label={t('settings.backup') + ' - ' + t('common.save')}
        className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 px-4 py-2 rounded-th-md font-medium transition-colors"
      >
        {saving ? t('common.loading') : t('common.save')}
      </button>
    </div>
  );
}
