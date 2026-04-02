import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  LoadingSpinner,
  EmptyState,
  Alert,
} from '../../components/ui';

interface Approval {
  id: string;
  title: string;
  requestedBy: string;
  status: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [approving, setApproving] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const { data: approvals, isLoading, error, refetch } = useQuery<Approval[]>(
    'approvals',
    () => api.get('/approvals').then((r) => r.data),
  );

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await api.post(`/approvals/${id}/approve`);
      await refetch();
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejected((prev) => new Set(prev).add(id));
    try {
      await api.post(`/approvals/${id}/reject`);
      await refetch();
    } finally {
      setRejected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="承認リストを読み込み中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">承認待ち</h1>
        <Alert
          variant="danger"
          message="承認リストの読み込みに失敗しました。ページを更新して再度お試しください。"
        />
      </div>
    );
  }

  const pendingCount = approvals?.length || 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
          承認待ち
        </h1>
        <p className="text-slate-400">
          {pendingCount} 件の承認リクエストがあります
        </p>
      </div>

      {pendingCount > 0 && (
        <Alert
          variant="warning"
          title="アクション必須"
          message={`${pendingCount} 件の承認リクエストが待機中です。迅速な対応をお願いします。`}
        />
      )}

      <div className="space-y-4">
        {approvals && approvals.length > 0 ? (
          approvals.map((approval) => (
            <Card key={approval.id} hoverable>
              <CardHeader className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{approval.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="pending">保留中</Badge>
                    <span className="text-xs text-slate-500">
                      リクエスト者: {approval.requestedBy}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardBody>
                <p className="text-sm text-slate-400">{approval.createdAt}</p>
              </CardBody>

              <CardFooter className="flex gap-3">
                <Button
                  variant="success"
                  size="md"
                  loading={approving === approval.id}
                  onClick={() => handleApprove(approval.id)}
                  disabled={approving !== null || rejected.has(approval.id)}
                >
                  承認
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  loading={rejected.has(approval.id)}
                  onClick={() => handleReject(approval.id)}
                  disabled={approving !== null || rejected.has(approval.id)}
                >
                  却下
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <EmptyState
            icon="✓"
            title="承認待ちはありません"
            description="すべての承認リクエストが処理済みです"
          />
        )}
      </div>
    </div>
  );
}
