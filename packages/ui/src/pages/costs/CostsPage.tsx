import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface CostSummary {
  total: number;
  byCategory: Record<string, number>;
  events: { id: string; description: string; amount: number; date: string }[];
}

export default function CostsPage() {
  const { data, isLoading, error } = useQuery<CostSummary>(
    'costs',
    () => api.get('/costs/summary').then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">コスト管理</h1>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-2">合計コスト</h2>
        <p className="text-4xl font-bold text-sky-400">
          ${data?.total.toFixed(2) || '0.00'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-3">カテゴリ別</h2>
          <div className="space-y-2">
            {data?.byCategory &&
              Object.entries(data.byCategory).map(([category, amount]) => (
                <div
                  key={category}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-slate-300">{category}</span>
                  <span className="font-bold">${(amount as number).toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-lg font-bold mb-3">最近のイベント</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data?.events && data.events.length > 0 ? (
              data.events.map((event) => (
                <div key={event.id} className="text-sm border-b border-slate-700 pb-2 last:border-b-0">
                  <p className="text-slate-300">{event.description}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">{event.date}</span>
                    <span className="font-bold text-red-400">
                      -${event.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400">イベントはありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
