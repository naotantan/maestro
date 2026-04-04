import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Routine {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  cron_expression: string;
  created_at: string;
  updated_at: string;
}

export default function RoutinesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [runError, setRunError] = useState<string | null>(null);
  const { data: routines, isLoading, error } = useQuery<Routine[]>(
    'routines',
    () => api.get('/routines').then((r) => r.data.data),
  );

  const handleRun = async (id: string) => {
    try {
      setRunError(null);
      await api.post(`/routines/${id}/run`);
      queryClient.invalidateQueries('routines');
    } catch {
      setRunError(t('routines.runFailed'));
    }
  };

  if (isLoading) return <LoadingSpinner text={t('routines.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('routines.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('routines.title')}</h1>

      {runError && (
        <Alert variant="danger" message={runError} onClose={() => setRunError(null)} />
      )}

      <div className="space-y-3">
        {routines && routines.length > 0 ? (
          routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex justify-between items-center"
            >
              <div>
                <h3 className="font-bold">{routine.name}</h3>
                <p className="text-xs text-slate-400">
                  {t('routines.scheduleValue', { value: routine.cron_expression })}
                </p>
              </div>
              <button
                onClick={() => handleRun(routine.id)}
                className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
              >
                {t('routines.runNow')}
              </button>
            </div>
          ))
        ) : (
          <EmptyState icon="🔁" title={t('routines.noRoutines')} />
        )}
      </div>
    </div>
  );
}
