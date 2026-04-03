import { useQuery } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';
import { formatDateOnly } from '../../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Goal {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function GoalsPage() {
  const { t } = useTranslation();
  const { data: goals, isLoading, error } = useQuery<Goal[]>(
    'goals',
    () => api.get('/goals').then((r) => r.data.data),
  );

  if (isLoading) return <LoadingSpinner text={t('goals.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('goals.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('goals.title')}</h1>
        <button className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium">
          {t('goals.newGoal')}
        </button>
      </div>

      {goals && goals.length > 0 ? (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{goal.name}</h3>
                <span className="text-xs text-slate-400">{formatDateOnly(goal.deadline)}</span>
              </div>
              {goal.description && (
                <p className="text-sm text-slate-400">{goal.description}</p>
              )}
              <span
                className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                  goal.status === 'active'
                    ? 'bg-green-900 text-green-200'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {goal.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🎯" title={t('goals.noGoals')} />
      )}
    </div>
  );
}
