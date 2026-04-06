import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { CheckCircle, AlertCircle, Clock, HardDrive } from 'lucide-react';
import api from '../../lib/api.ts';
import { LoadingSpinner, Alert } from '../../components/ui';

interface BackupSettings {
  enabled: boolean;
  schedule_type: string;
  schedule_time: string;
  retention_days: number;
  destination_type: string;
  local_path: string;
  compression: string;
  encryption: boolean;
}

interface BackupHistory {
  id: string;
  created_at: string;
  size_bytes: number;
  destination: string;
  status: 'success' | 'failed';
  error?: string;
}

interface SettingsResponse {
  backup: BackupSettings;
  last_backup_at?: string;
  last_backup_size_bytes?: number;
  last_backup_destination?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export default function BackupPage() {
  const [activeTab, setActiveTab] = useState<'local' | 'gdrive'>('local');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local form state
  const [enabled, setEnabled] = useState(true);
  const [scheduleType, setScheduleType] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('03:00');
  const [retentionDays, setRetentionDays] = useState(30);
  const [localPath, setLocalPath] = useState('/var/backups/maestro');
  const [compression, setCompression] = useState('gzip');
  const [encryption, setEncryption] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsResponse>(
    'backup-settings',
    () => api.get('/settings').then((r) => r.data),
    {
      onSuccess: (data) => {
        if (!initialized && data.backup) {
          const b = data.backup;
          setEnabled(b.enabled ?? true);
          setScheduleType(b.schedule_type ?? 'daily');
          setScheduleTime(b.schedule_time ?? '03:00');
          setRetentionDays(b.retention_days ?? 30);
          setLocalPath(b.local_path ?? '/var/backups/maestro');
          setCompression(b.compression ?? 'gzip');
          setEncryption(b.encryption ?? true);
          if (b.destination_type === 'gdrive') setActiveTab('gdrive');
          setInitialized(true);
        }
      },
    },
  );

  const { data: history = [] } = useQuery<BackupHistory[]>(
    'backup-history',
    () => api.get('/backup/history').then((r) => r.data?.data ?? r.data ?? []),
    { retry: false },
  );

  const saveMutation = useMutation(
    () => api.put('/settings', {
      backup: {
        enabled,
        schedule_type: scheduleType,
        schedule_time: scheduleTime,
        retention_days: retentionDays,
        destination_type: activeTab,
        local_path: localPath,
        compression,
        encryption,
      },
    }),
    {
      onSuccess: () => {
        setMessage({ type: 'success', text: 'バックアップ設定を保存しました' });
        setTimeout(() => setMessage(null), 3000);
      },
      onError: () => setMessage({ type: 'error', text: '保存に失敗しました' }),
    },
  );

  const runNowMutation = useMutation(
    () => api.post('/backup/execute', {}),
    {
      onSuccess: () => {
        setMessage({ type: 'success', text: 'バックアップを開始しました' });
        setTimeout(() => setMessage(null), 4000);
      },
      onError: () => setMessage({ type: 'error', text: 'バックアップの実行に失敗しました' }),
    },
  );

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner text="読み込み中..." /></div>;
  }

  const lastBackup = settings?.last_backup_at;
  const lastBackupSize = settings?.last_backup_size_bytes;
  const lastBackupDest = settings?.last_backup_destination;

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">バックアップ設定</h1>

      {message && (
        <div className={`px-4 py-2 rounded-th-md border text-sm ${
          message.type === 'success'
            ? 'bg-th-success-dim border-th-border text-th-success'
            : 'bg-th-danger-dim border-th-border text-th-danger'
        }`}>
          {message.text}
        </div>
      )}

      {/* Last backup status */}
      {lastBackup && (
        <div className="flex items-center justify-between bg-th-success-dim border border-th-success/25 rounded-th-md px-5 py-4">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-th-success flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-th-success">最終バックアップが正常に完了しました</div>
              <div className="text-xs text-th-success/70 mt-0.5">
                {formatDate(lastBackup)}
                {lastBackupSize && ` · ${formatBytes(lastBackupSize)}`}
                {lastBackupDest && ` · ${lastBackupDest}`}
              </div>
            </div>
          </div>
          <button
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isLoading}
            className="bg-th-surface-0 hover:bg-th-surface-1 disabled:opacity-50 border border-th-border px-3 py-1.5 rounded-th-sm text-sm font-medium transition-colors flex-shrink-0"
          >
            {runNowMutation.isLoading ? '実行中...' : '今すぐバックアップ'}
          </button>
        </div>
      )}

      {!lastBackup && (
        <div className="flex items-center justify-between bg-th-surface-1 border border-th-border rounded-th-md px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-th-text-3" />
            <span className="text-sm text-th-text-3">バックアップ履歴がありません</span>
          </div>
          <button
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isLoading}
            className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 text-white px-3 py-1.5 rounded-th-sm text-sm font-medium transition-colors"
          >
            {runNowMutation.isLoading ? '実行中...' : '今すぐバックアップ'}
          </button>
        </div>
      )}

      {/* Schedule settings */}
      <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6 space-y-4">
        <h2 className="text-base font-semibold border-b border-th-border pb-3">スケジュール設定</h2>

        <label className="flex items-center justify-between p-3 bg-th-surface-1 rounded-th-sm border border-th-border cursor-pointer">
          <div>
            <div className="text-sm font-medium">自動バックアップを有効にする</div>
            <div className="text-xs text-th-text-4 mt-0.5">設定したスケジュールに従って自動的にバックアップを実行</div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-th-accent"
          />
        </label>

        {enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">バックアップ頻度</label>
              <select
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
              >
                <option value="hourly">毎時</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> 実行時刻
              </label>
              <input
                type="time"
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">保持する世代数（日）</label>
              <input
                type="number"
                min={1}
                max={365}
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6 space-y-4">
        <h2 className="text-base font-semibold border-b border-th-border pb-3">バックアップ先</h2>

        <div className="flex gap-2">
          {(['local', 'gdrive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-th-sm text-sm font-medium border transition-colors ${
                activeTab === tab
                  ? 'bg-th-accent text-white border-th-accent'
                  : 'bg-th-surface-1 text-th-text-2 border-th-border hover:bg-th-surface-2'
              }`}
            >
              {tab === 'local' ? 'ローカル' : 'Google Drive'}
            </button>
          ))}
        </div>

        {activeTab === 'local' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" /> 保存パス
              </label>
              <input
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm font-mono"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">圧縮形式</label>
              <select
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={compression}
                onChange={(e) => setCompression(e.target.value)}
              >
                <option value="gzip">gzip (.tar.gz)</option>
                <option value="bzip2">bzip2 (.tar.bz2)</option>
                <option value="none">なし</option>
              </select>
            </div>
            <label className="flex items-center justify-between p-3 bg-th-surface-1 rounded-th-sm border border-th-border cursor-pointer">
              <div>
                <div className="text-sm font-medium">暗号化（AES-256）</div>
                <div className="text-xs text-th-text-4 mt-0.5">バックアップファイルをAES-256で暗号化する</div>
              </div>
              <input
                type="checkbox"
                checked={encryption}
                onChange={(e) => setEncryption(e.target.checked)}
                className="w-4 h-4 accent-th-accent"
              />
            </label>
          </div>
        )}

        {activeTab === 'gdrive' && (
          <div className="py-6 text-center text-sm text-th-text-3">
            <p>Google Drive 連携は設定ページの「バックアップ先」で設定できます。</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isLoading}
          className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 text-white px-5 py-2 rounded-th-md font-medium transition-colors text-sm"
        >
          {saveMutation.isLoading ? '保存中...' : '変更を保存'}
        </button>
      </div>

      {/* Backup history */}
      {history.length > 0 && (
        <div className="bg-th-surface-0 rounded-th-md border border-th-border overflow-hidden">
          <div className="px-5 py-3 border-b border-th-border">
            <h2 className="text-sm font-semibold">バックアップ履歴（直近）</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-border bg-th-surface-1">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-th-text-3">日時</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-th-text-3">サイズ</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-th-text-3">保存先</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-th-text-3">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 5).map((item) => (
                <tr key={item.id} className="border-b border-th-border/50 last:border-0">
                  <td className="px-5 py-3 text-th-text-2 text-xs font-mono">{formatDate(item.created_at)}</td>
                  <td className="px-5 py-3 text-th-text-2 text-xs">{formatBytes(item.size_bytes)}</td>
                  <td className="px-5 py-3 text-th-text-3 text-xs truncate max-w-[160px]">{item.destination}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-th-sm font-medium ${
                      item.status === 'success'
                        ? 'bg-th-success-dim text-th-success'
                        : 'bg-th-danger-dim text-th-danger'
                    }`}>
                      {item.status === 'success' ? '成功' : '失敗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
