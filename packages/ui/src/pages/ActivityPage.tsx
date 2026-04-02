import { useQuery } from 'react-query';
import api from '../lib/api.ts';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
}

export default function ActivityPage() {
  const { data: activities, isLoading, error } = useQuery<Activity[]>(
    'activity',
    () => api.get('/activity').then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">アクティビティログ</h1>

      <div className="space-y-3">
        {activities && activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{activity.title}</h3>
                  <p className="text-slate-400 text-sm">{activity.description}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    実行者: {activity.actor}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 rounded text-xs bg-slate-700">
                    {activity.type}
                  </span>
                  <p className="text-xs text-slate-400 mt-2">{activity.timestamp}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400">アクティビティはありません</p>
        )}
      </div>
    </div>
  );
}
