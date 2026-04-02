import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api.ts';

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
  dueDate: string;
}

export default function GoalsPage() {
  const { data: goals, isLoading, error } = useQuery<Goal[]>(
    'goals',
    () => api.get('/goals').then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ゴール</h1>
        <button className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium">
          新規作成
        </button>
      </div>

      <div className="space-y-3">
        {goals && goals.length > 0 ? (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{goal.title}</h3>
                <span className="text-xs text-slate-400">{goal.dueDate}</span>
              </div>
              <div className="w-full bg-slate-700 rounded h-2">
                <div
                  className="bg-sky-600 h-2 rounded transition-all"
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                進捗: {goal.progress}%
              </p>
            </div>
          ))
        ) : (
          <p className="text-slate-400">ゴールはありません</p>
        )}
      </div>
    </div>
  );
}
