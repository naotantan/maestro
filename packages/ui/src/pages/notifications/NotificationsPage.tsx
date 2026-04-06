import { useQuery, useMutation, useQueryClient } from 'react-query';
import { CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, Bell } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationGroup {
  label: string;
  items: Notification[];
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  info:    <Info size={16} />,
  success: <CheckCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  error:   <XCircle size={16} />,
};

const TYPE_ICON_CLASS: Record<string, string> = {
  info:    'bg-th-info-dim text-th-info',
  success: 'bg-th-success-dim text-th-success',
  warning: 'bg-th-warning-dim text-th-warning',
  error:   'bg-th-danger-dim text-th-danger',
};

function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400 * 1000;

  const today: Notification[] = [];
  const pastWeek: Notification[] = [];
  const older: Notification[] = [];

  for (const n of notifications) {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart) today.push(n);
    else if (t >= weekStart) pastWeek.push(n);
    else older.push(n);
  }

  const groups: NotificationGroup[] = [];
  if (today.length > 0) groups.push({ label: '今日', items: today });
  if (pastWeek.length > 0) groups.push({ label: '過去7日', items: pastWeek });
  if (older.length > 0) groups.push({ label: 'それ以前', items: older });
  return groups;
}

function formatTime(dt: string): string {
  const d = new Date(dt);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 172800) return '昨日 ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, error } = useQuery<Notification[]>(
    'notifications',
    () => api.get('/notifications').then((r) => r.data.data ?? r.data),
  );

  const readAll = useMutation(
    () => api.post('/notifications/read-all'),
    { onSuccess: () => queryClient.invalidateQueries('notifications') },
  );

  const readOne = useMutation(
    (id: string) => api.post(`/notifications/${id}/read`),
    { onSuccess: () => queryClient.invalidateQueries('notifications') },
  );

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const groups = groupNotifications(notifications ?? []);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-th-text">通知</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-th-accent px-1 text-[11px] font-semibold text-white leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => readAll.mutate()}
            disabled={readAll.isLoading}
            className="inline-flex items-center gap-1.5 rounded-th-md border border-th-border bg-th-surface px-3.5 py-1.5 text-[13px] text-th-text hover:bg-th-surface-1 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            すべて既読
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner text="通知を読み込み中..." />
      ) : error ? (
        <Alert variant="danger" message="通知の読み込みに失敗しました" />
      ) : (notifications?.length ?? 0) === 0 ? (
        <EmptyState icon={<Bell size={32} />} title="通知はありません" />
      ) : (
        <div className="rounded-th-lg border border-th-border bg-th-surface shadow-th-sm overflow-hidden">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-5 py-2 bg-th-surface-1 border-y border-th-border text-[11px] font-semibold uppercase tracking-[0.05em] text-th-text-3">
                {group.label}
              </div>
              {group.items.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (!n.read) readOne.mutate(n.id); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !n.read) readOne.mutate(n.id); }}
                  className={`relative flex items-start gap-3.5 px-5 py-3.5 border-b border-th-border last:border-b-0 transition-colors ${
                    n.read ? 'cursor-default' : 'bg-th-accent-dim/20 hover:bg-th-accent-dim/30 cursor-pointer'
                  }`}
                >
                  {/* Icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TYPE_ICON_CLASS[n.type] ?? TYPE_ICON_CLASS.info}`}>
                    {TYPE_ICON[n.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] mb-0.5 ${n.read ? 'font-normal text-th-text' : 'font-medium text-th-text'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-th-text-2 leading-relaxed">{n.message}</p>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-[11px] text-th-text-3 whitespace-nowrap">
                    {formatTime(n.created_at)}
                  </span>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-th-accent" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
