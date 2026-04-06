import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import type { AxiosError } from 'axios';
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
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setCreateError(axiosErr.response?.data?.message ?? t('goals.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePriority = async (goalId: string, priority: number) => {
    try {
      await api.patch(`/goals/${goalId}`, { priority });
      await queryClient.invalidateQueries('goals');
      setEditingId(null);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setCreateError(axiosErr.response?.data?.message ?? t('goals.updateFailed'));
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
                <h2 className="text-lg font-semibold text-th-text">{t('goals.createTitle')}</h2>
                <p className="text-sm text-th-text-3">{t('goals.createDescription')}</p>
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
                <span className="text-sm text-th-text-2">{t('goals.goalName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('goals.namePlaceholder')}
                  className="w-full rounded-th border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm text-th-text-2">{t('common.description')}</span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('goals.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-th border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm text-th-text-2">{t('common.priority')}</span>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
                  className="w-full rounded-th border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text"
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
              className="bg-th-surface-0 rounded-th-md p-4 border border-th-border"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{goal.name}</h3>
                <span className="text-xs text-th-text-3">{formatDateOnly(goal.deadline)}</span>
              </div>
              {goal.description && (
                <p className="text-sm text-th-text-3">{goal.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {/* プロジェクトバッジ */}
                <span className="px-2 py-0.5 rounded text-xs bg-th-accent-dim text-th-accent">
                  {goal.project_name ?? '全体'}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    goal.status === 'active'
                      ? 'bg-th-success-dim text-th-success'
                      : 'bg-th-surface-1 text-th-text-2'
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
                    className="px-2 py-1 rounded text-xs border border-th-border-strong bg-th-surface-1 text-th-text"
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
                        ? 'bg-th-surface-1 text-th-text-3'
                        : goal.priority === 1
                        ? 'bg-th-accent-dim text-th-accent'
                        : goal.priority === 2
                        ? 'bg-th-warning-dim text-th-warning'
                        : goal.priority === 3
                        ? 'bg-th-warning-dim text-th-warning'
                        : 'bg-th-danger-dim text-th-danger'
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
