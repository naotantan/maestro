import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';
import { Alert, LoadingSpinner } from '../../components/ui';

interface ProjectDetail {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<ProjectDetail>(
    ['project', id],
    () => api.get(`/projects/${id}`).then((r) => r.data.data),
  );

  if (isLoading) return <LoadingSpinner text={t('projects.loading')} />;
  if (error)
    return <div className="p-6"><Alert variant="danger" message={t('projects.notFound')} /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">{data?.name}</h1>
      <p className="text-slate-300">{data?.description}</p>
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span
          className={`px-2 py-1 rounded text-xs ${
            data?.status === 'active'
              ? 'bg-green-900 text-green-200'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {data?.status === 'active' ? t('projects.active') : t('projects.archived')}
        </span>
        <span>{data?.created_at}</span>
      </div>
    </div>
  );
}
