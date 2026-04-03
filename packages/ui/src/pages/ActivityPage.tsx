import { useQuery } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../lib/api.ts';
import { formatDate } from '../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner } from '../components/ui';

interface ActivityLog {
  id: string;
  company_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  changes: unknown;
  created_at: string;
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
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('activity.logTitle')}</h1>

      <div className="space-y-3">
        {activities && activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">
                    {activity.entity_type} — {activity.action}
                  </h3>
                  {activity.actor_id && (
                    <p className="text-xs text-slate-500 mt-1">
                      {t('activity.actorValue', { actor: activity.actor_id })}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDate(activity.created_at)}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon="📋" title={t('activity.noActivity')} />
        )}
      </div>
    </div>
  );
}
