import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../lib/api.ts';
import { formatDate } from '../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner } from '../components/ui';

interface ActivityLog {
  id: string;
  company_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  updated_fields?: string[] | null;
  action: string;
  changes: unknown;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  create: '作成',
  update: '更新',
  delete: '削除',
};

const ACTION_STYLE: Record<string, string> = {
  create: 'bg-th-success-dim text-th-success',
  update: 'bg-th-accent-dim text-th-accent',
  delete: 'bg-th-danger-dim text-th-danger',
};

const ENTITY_LABEL: Record<string, string> = {
  issue: '課題',
  goal: 'ゴール',
  project: 'プロジェクト',
  agent: 'エージェント',
  routine: 'ルーティン',
  plugin: 'スキル',
  approval: '承認',
  cost: 'コスト',
  memory: 'メモリ',
};

function formatActivityMessage(activity: ActivityLog): string {
  const entity = ENTITY_LABEL[activity.entity_type] ?? activity.entity_type;
  const action = ACTION_LABEL[activity.action] ?? activity.action;
  const name = activity.entity_name;

  if (!name) {
    if (activity.action === 'create' && activity.entity_type === 'plugin') {
      return 'スキルの一括同期を実行';
    }
    return `${entity}を${action}`;
  }

  if (activity.action === 'update' && activity.updated_fields?.length) {
    return `${entity}「${name}」の ${activity.updated_fields.join(', ')} を更新`;
  }
  return `${entity}「${name}」を${action}`;
}

export default function ActivityPage() {
  const { t } = useTranslation();
  const { data: activities, isLoading, error } = useQuery<ActivityLog[]>(
    'activity',
    () => api.get('/activity').then((r) => r.data.data),
  );

  if (isLoading) return <LoadingSpinner text={t('activity.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('activity.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">{t('activity.logTitle')}</h1>

      <div className="space-y-2">
        {activities && activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 rounded-th-md p-3 transition-colors hover:bg-th-surface-1"
            >
              <span className={`flex-shrink-0 inline-block min-w-[3rem] text-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ACTION_STYLE[activity.action] ?? 'bg-th-surface-1 text-th-text-2'}`}>
                {ACTION_LABEL[activity.action] ?? activity.action}
              </span>
              <span className="text-sm text-th-text-2 flex-1 min-w-0 truncate">
                {formatActivityMessage(activity)}
              </span>
              <span className="text-xs text-th-text-4 flex-shrink-0">{formatDate(activity.created_at)}</span>
            </div>
          ))
        ) : (
          <EmptyState icon="📋" title={t('activity.noActivity')} />
        )}
      </div>
    </div>
  );
}
