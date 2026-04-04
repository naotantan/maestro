import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDateOnly } from '../../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner, Button, Card, CardBody } from '../../components/ui';

interface Goal {
  id: string;
  company_id: string;
  project_id: string | null;
  project_name: string | null;
  name: string;
  description: string | null;
  deadline: string | null;
  status: string;
  priority: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export default function GoalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPriority, setEditingPriority] = useState(1);

  const { data: goals, isLoading, error } = useQuery<Goal[]>(
    'goals',
    () => api.get('/goals').then((r) => r.data.data),
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setSubmitting(true);
    setCreateError(null);

    try {
      const payload: {
        name: string;
        description?: string;
        priority: number;
      } = {
        name: newName.trim(),
        priority: newPriority,
      };

      if (newDescription.trim()) {
        payload.description = newDescription.trim();
      }

      await api.post('/goals', payload);
      setNewName('');
      setNewDescription('');
      setNewPriority(1);
      setShowCreate(false);
      await queryClient.invalidateQueries('goals');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? t('goals.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePriority = async (goalId: string, priority: number) => {
    try {
      await api.patch(`/goals/${goalId}`, { priority });
      await queryClient.invalidateQueries('goals');
      setEditingId(null);
    } catch (err: any) {
      console.error('Failed to update priority:', err);
    }
  };

  if (isLoading) return <LoadingSpinner text={t('goals.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('goals.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('goals.title')}</h1>
        <Button
          variant="primary"
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
        >
          {t('goals.newGoal')}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('goals.createTitle')}</h2>
                <p className="text-sm text-slate-400">{t('goals.createDescription')}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                {t('common.close')}
              </Button>
            </div>

            {createError && <Alert variant="danger" message={createError} />}

            <div className="space-y-4">
              <label className="space-y-2 block">
                <span className="text-sm text-slate-300">{t('goals.goalName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('goals.namePlaceholder')}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm text-slate-300">{t('common.description')}</span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('goals.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm text-slate-300">{t('common.priority')}</span>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                >
                  <option value={0}>No Priority</option>
                  <option value={1}>Low</option>
                  <option value={2}>Medium</option>
                  <option value={3}>High</option>
                  <option value={4}>Urgent</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                loading={submitting}
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                {t('common.create')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

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
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {/* プロジェクトバッジ */}
                <span className="px-2 py-0.5 rounded text-xs bg-sky-900 text-sky-200">
                  {goal.project_name ?? '全体'}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    goal.status === 'active'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {goal.status}
                </span>

                {/* Priority selector */}
                {editingId === goal.id ? (
                  <select
                    value={editingPriority}
                    onChange={(e) => setEditingPriority(parseInt(e.target.value, 10))}
                    onBlur={() => handleUpdatePriority(goal.id, editingPriority)}
                    autoFocus
                    className="px-2 py-1 rounded text-xs border border-slate-600 bg-slate-700 text-white"
                  >
                    <option value={0}>No Priority</option>
                    <option value={1}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={3}>High</option>
                    <option value={4}>Urgent</option>
                  </select>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(goal.id);
                      setEditingPriority(goal.priority);
                    }}
                    className={`px-2 py-1 rounded text-xs cursor-pointer ${
                      goal.priority === 0
                        ? 'bg-slate-700 text-slate-400'
                        : goal.priority === 1
                        ? 'bg-blue-900 text-blue-200'
                        : goal.priority === 2
                        ? 'bg-yellow-900 text-yellow-200'
                        : goal.priority === 3
                        ? 'bg-orange-900 text-orange-200'
                        : 'bg-red-900 text-red-200'
                    }`}
                  >
                    {goal.priority === 0
                      ? '-'
                      : goal.priority === 1
                      ? 'Low'
                      : goal.priority === 2
                      ? 'Medium'
                      : goal.priority === 3
                      ? 'High'
                      : 'Urgent'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🎯" title={t('goals.noGoals')} />
      )}
    </div>
  );
}
