import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api.ts';
import {
  Card,
  CardBody,
  CardHeader,
  LoadingSpinner,
  EmptyState,
  Alert,
} from '../components/ui';

interface DashboardStats {
  agentCount: number;
  openIssues: number;
  pendingApprovals: number;
  recentActivity: { id: string; title: string; timestamp: string }[];
}

function StatCard({
  label,
  value,
  icon,
  trend,
  color,
}: {
  label: string;
  value: number | string;
  icon: string;
  trend?: { value: number; positive: boolean };
  color: 'sky' | 'orange' | 'red' | 'emerald';
}) {
  const colorMap = {
    sky: 'from-sky-600 to-sky-700 text-sky-100',
    orange: 'from-orange-600 to-orange-700 text-orange-100',
    red: 'from-red-600 to-red-700 text-red-100',
    emerald: 'from-emerald-600 to-emerald-700 text-emerald-100',
  };

  return (
    <Card hoverable>
      <CardBody className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
          <p className={`text-4xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
            {value}
          </p>
          {trend && (
            <p className={`text-xs mt-2 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% 前月比
            </p>
          )}
        </div>
        <span className="text-3xl opacity-30">{icon}</span>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardStats>('dashboard', () =>
    api.get('/dashboard/stats').then((r) => r.data),
  );

  if (isLoading)
    return (
      <div className="p-6">
        <LoadingSpinner text="ダッシュボードを読み込み中..." />
      </div>
    );

  if (error)
    return (
      <div className="p-6">
        <Alert
          variant="danger"
          title="エラーが発生しました"
          message="ダッシュボードの読み込みに失敗しました。ページを更新して再度お試しください。"
        />
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
          ダッシュボード
        </h1>
        <p className="text-slate-400">
          組織全体の状況をリアルタイムで把握できます
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="稼働中のエージェント"
          value={data?.agentCount || 0}
          icon="🤖"
          trend={{ value: 12, positive: true }}
          color="sky"
        />
        <StatCard
          label="オープン Issue"
          value={data?.openIssues || 0}
          icon="📋"
          trend={{ value: 5, positive: false }}
          color="orange"
        />
        <StatCard
          label="承認待ち"
          value={data?.pendingApprovals || 0}
          icon="✓"
          trend={{ value: 3, positive: false }}
          color="red"
        />
        <StatCard
          label="システムステータス"
          value="正常"
          icon="⚡"
          color="emerald"
        />
      </div>

      {/* アラート */}
      {(data?.pendingApprovals || 0) > 0 && (
        <Alert
          variant="warning"
          title="承認待ちがあります"
          message={`${data?.pendingApprovals} 件の承認リクエストがあります。`}
        />
      )}

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">最近のアクティビティ</h2>
        </CardHeader>
        <CardBody>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-700/30 transition-colors"
                >
                  <p className="text-slate-300 text-sm">{activity.title}</p>
                  <span className="text-xs text-slate-500">{activity.timestamp}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📊"
              title="アクティビティはまだありません"
              description="アクティビティが記録されると、ここに表示されます"
            />
          )}
        </CardBody>
      </Card>

      {/* クイックアクション */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">クイックアクション</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Link
            to="/agents"
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
          >
            エージェント管理へ
          </Link>
          <Link
            to="/issues"
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
          >
            Issue一覧へ
          </Link>
          <Link
            to="/approvals"
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
          >
            承認リストへ
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
