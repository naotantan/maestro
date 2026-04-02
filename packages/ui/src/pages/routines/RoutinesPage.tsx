import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface Routine {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  status: string;
}

export default function RoutinesPage() {
  const { data: routines, isLoading, error } = useQuery<Routine[]>(
    'routines',
    () => api.get('/routines').then((r) => r.data),
  );

  const handleRun = async (id: string) => {
    await api.post(`/routines/${id}/run`);
  };

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">ルーティン</h1>

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
                  スケジュール: {routine.schedule}
                </p>
                <p className="text-xs text-slate-400">最終実行: {routine.lastRun}</p>
              </div>
              <button
                onClick={() => handleRun(routine.id)}
                className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
              >
                実行
              </button>
            </div>
          ))
        ) : (
          <p className="text-slate-400">ルーティンはありません</p>
        )}
      </div>
    </div>
  );
}
