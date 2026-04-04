import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../lib/api.ts';
import { formatDate } from '../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner, Badge } from '../components/ui';

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

const ACTION_BADGE: Record<string, 'info' | 'warning' | 'danger' | 'default'> = {
  create: 'info',
  update: 'default',
  delete: 'danger',
};

const ENTITY_LABEL: Record<string, string> = {
  issue: '課題',
  goal: 'ゴール',
  project: 'プロジェクト',
  agent: 'エージェント',
  routine: 'ルーティン',
  plugin: 'プラグイン',
  approval: '承認',
  cost: 'コスト',
};

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
              className="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* アクションバッジ（縦書き防止のため最小幅固定） */}
                <span className={`flex-shrink-0 inline-block min-w-[3rem] text-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                  activity.action === 'create' ? 'bg-sky-900 text-sky-200' :
                  activity.action === 'delete' ? 'bg-red-900 text-red-200' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {ACTION_LABEL[activity.action] ?? activity.action}
                </span>

                {/* エンティティ種別 + 名前 + 変更フィールド */}
                <div className="min-w-0 flex flex-col">
                  <div>
                    <span className="text-xs text-slate-500 mr-1">
                      {ENTITY_LABEL[activity.entity_type] ?? activity.entity_type}
                    </span>
                    <span className="text-sm text-slate-100 truncate">
                      {activity.entity_name ?? activity.entity_id ?? '—'}
                    </span>
                  </div>
                  {activity.updated_fields && activity.updated_fields.length > 0 && (
                    <span className="text-xs text-slate-500 truncate">
                      {activity.updated_fields.join(', ')} を変更
                    </span>
                  )}
                </div>
              </div>

              {/* 日時 */}
              <p className="text-xs text-slate-500 flex-shrink-0">{formatDate(activity.created_at)}</p>
            </div>
          ))
        ) : (
          <EmptyState icon="📋" title={t('activity.noActivity')} />
        )}
      </div>
    </div>
  );
}
