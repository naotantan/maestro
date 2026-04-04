import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Alert, EmptyState, LoadingSpinner, Button, Card, CardBody } from '../../components/ui';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: projects, isLoading, error } = useQuery<Project[]>(
    'projects',
    () => api.get('/projects').then((r) => r.data.data),
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setSubmitting(true);
    setCreateError(null);

    try {
      const payload: {
        name: string;
        description?: string;
      } = {
        name: newName.trim(),
      };

      if (newDescription.trim()) {
        payload.description = newDescription.trim();
      }

      await api.post('/projects', payload);
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
      await queryClient.invalidateQueries('projects');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? t('projects.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner text={t('projects.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('projects.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('projects.title')}</h1>
        <Button
          variant="primary"
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
        >
          {t('projects.newProject')}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('projects.createTitle')}</h2>
                <p className="text-sm text-slate-400">{t('projects.createDescription')}</p>
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
                <span className="text-sm text-slate-300">{t('projects.projectName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('projects.namePlaceholder')}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm text-slate-300">{t('common.description')}</span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('projects.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
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

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-sky-500 transition"
            >
              <h3 className="text-lg font-bold mb-1">{project.name}</h3>
              <p className="text-slate-400 text-sm mb-3">{project.description}</p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{formatDate(project.created_at)}</span>
                <span
                  className={`px-2 py-1 rounded ${
                    project.status === 'active'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {project.status === 'active' ? t('projects.active') : t('projects.archived')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon="📁" title={t('projects.noProjects')} />
      )}
    </div>
  );
}
