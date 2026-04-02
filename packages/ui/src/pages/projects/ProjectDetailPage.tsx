import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: string;
  goals: { id: string; title: string }[];
  workspaces: { id: string; name: string }[];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<ProjectDetail>(
    ['project', id],
    () => api.get(`/projects/${id}`).then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error)
    return <div className="p-6 text-red-400">プロジェクトが見つかりません</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">{data?.name}</h1>
      <p className="text-slate-300">{data?.description}</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-3">関連ゴール</h2>
          <ul className="space-y-2">
            {data?.goals && data.goals.length > 0 ? (
              data.goals.map((goal) => (
                <li key={goal.id} className="text-slate-300 text-sm">
                  • {goal.title}
                </li>
              ))
            ) : (
              <p className="text-slate-400 text-sm">ゴールはありません</p>
            )}
          </ul>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-3">ワークスペース</h2>
          <ul className="space-y-2">
            {data?.workspaces && data.workspaces.length > 0 ? (
              data.workspaces.map((workspace) => (
                <li key={workspace.id} className="text-slate-300 text-sm">
                  • {workspace.name}
                </li>
              ))
            ) : (
              <p className="text-slate-400 text-sm">ワークスペースはありません</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
