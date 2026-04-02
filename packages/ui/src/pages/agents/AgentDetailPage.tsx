import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface AgentDetail {
  id: string;
  name: string;
  role: string;
  status: string;
  config: Record<string, unknown>;
  lastHeartbeat: string;
  recentRuns: { id: string; timestamp: string; status: string }[];
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<AgentDetail>(
    ['agent', id],
    () => api.get(`/agents/${id}`).then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エージェントが見つかりません</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{data?.name}</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-4">基本情報</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-slate-400">ID:</span> {data?.id}
            </p>
            <p>
              <span className="text-slate-400">ロール:</span> {data?.role}
            </p>
            <p>
              <span className="text-slate-400">ステータス:</span> {data?.status}
            </p>
            <p>
              <span className="text-slate-400">最終ハートビート:</span>{' '}
              {data?.lastHeartbeat}
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-4">設定</h2>
          <pre className="bg-slate-900 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(data?.config, null, 2)}
          </pre>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-4">最近の実行</h2>
        <div className="space-y-2">
          {data?.recentRuns && data.recentRuns.length > 0 ? (
            data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex justify-between items-center py-2 border-b border-slate-700 last:border-b-0 text-sm"
              >
                <p>{run.id}</p>
                <span className="text-slate-400">{run.timestamp}</span>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    run.status === 'success'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-400">実行履歴はありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
