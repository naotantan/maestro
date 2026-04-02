import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { Button, Card, CardBody, Badge, LoadingSpinner, EmptyState } from '../../components/ui';
import { clsx } from 'clsx';

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'idle';
  role: string;
}

export default function AgentsPage() {
  const { data: agents, isLoading, error } = useQuery<Agent[]>(
    'agents',
    () => api.get('/agents').then((r) => r.data),
  );

  const statusConfig = {
    online: { badge: 'success', label: 'オンライン', icon: '🟢' },
    idle: { badge: 'warning' as const, label: 'アイドル', icon: '🟡' },
    offline: { badge: 'default' as const, label: 'オフライン', icon: '⚫' },
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="エージェント一覧を読み込み中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">エージェント</h1>
        <div className="text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-700/30">
          エージェント一覧の読み込みに失敗しました
        </div>
      </div>
    );
  }

  const config = statusConfig['online' as keyof typeof statusConfig];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            エージェント
          </h1>
          <p className="text-slate-400">
            稼働中のエージェント: <span className="font-semibold text-slate-300">{agents?.length || 0}</span>
          </p>
        </div>
        <Button variant="primary">
          新規作成
        </Button>
      </div>

      {agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const status = statusConfig[agent.status];
            return (
              <Link
                key={agent.id}
                to={`/agents/${agent.id}`}
                className="group"
              >
                <Card hoverable className="h-full">
                  <CardBody className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold group-hover:text-sky-400 transition-colors">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">{agent.role}</p>
                      </div>
                      <div className="text-2xl">{status.icon}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                      <Badge
                        variant={
                          agent.status === 'online'
                            ? 'success'
                            : agent.status === 'idle'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {status.label}
                      </Badge>
                      <span className="text-xs text-slate-500">詳細を表示</span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="🤖"
          title="エージェントがありません"
          description="新しいエージェントを作成して、組織を成長させましょう"
          action={<Button variant="primary">エージェント作成</Button>}
        />
      )}
    </div>
  );
}
