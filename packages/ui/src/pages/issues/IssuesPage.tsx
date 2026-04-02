import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { Button, Badge, Card, CardBody, LoadingSpinner, EmptyState, Alert } from '../../components/ui';
import { clsx } from 'clsx';

interface Issue {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

const statusLabels = {
  open: 'オープン',
  'in-progress': '進行中',
  closed: '完了',
};

const statusBadges: Record<Issue['status'], 'info' | 'warning' | 'success'> = {
  open: 'info',
  'in-progress': 'warning',
  closed: 'success',
};

const priorityLabels = {
  high: '高',
  medium: '中',
  low: '低',
};

const priorityBadges: Record<Issue['priority'], 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
};

export default function IssuesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: issues, isLoading, error } = useQuery<Issue[]>(
    ['issues', statusFilter],
    () =>
      api
        .get('/issues', {
          params: { status: statusFilter === 'all' ? undefined : statusFilter },
        })
        .then((r) => r.data),
  );

  const openCount = issues?.filter((i) => i.status === 'open').length || 0;
  const inProgressCount = issues?.filter((i) => i.status === 'in-progress').length || 0;

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Issue一覧を読み込み中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">Issue</h1>
        <Alert
          variant="danger"
          message="Issue一覧の読み込みに失敗しました。ページを更新して再度お試しください。"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            Issue
          </h1>
          <p className="text-slate-400">
            オープン: <span className="font-semibold text-sky-400">{openCount}</span>件 | 進行中:
            <span className="font-semibold text-amber-400 ml-1">{inProgressCount}</span>件
          </p>
        </div>
        <Button variant="primary">
          新規作成
        </Button>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        {['all', 'open', 'in-progress', 'closed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900',
              statusFilter === status
                ? 'bg-sky-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
            aria-pressed={statusFilter === status}
          >
            {status === 'all' ? 'すべて' : statusLabels[status as keyof typeof statusLabels]}
          </button>
        ))}
      </div>

      {/* Alert */}
      {inProgressCount > 5 && (
        <Alert
          variant="warning"
          title="進行中のIssueが多いです"
          message={`現在 ${inProgressCount} 件のIssueが進行中です。優先度を確認してください。`}
        />
      )}

      {/* Issue一覧 */}
      {issues && issues.length > 0 ? (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              className="group"
            >
              <Card hoverable>
                <CardBody className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-100 group-hover:text-sky-400 transition-colors truncate">
                      {issue.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{issue.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={priorityBadges[issue.priority]}>
                      優先度: {priorityLabels[issue.priority]}
                    </Badge>
                    <Badge variant={statusBadges[issue.status]}>
                      {statusLabels[issue.status]}
                    </Badge>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title={
            statusFilter === 'all'
              ? 'Issueがありません'
              : `${statusLabels[statusFilter as keyof typeof statusLabels]}のIssueはありません`
          }
          description="新しいIssueを作成して、プロジェクトを進めましょう"
          action={<Button variant="primary">Issue作成</Button>}
        />
      )}
    </div>
  );
}
