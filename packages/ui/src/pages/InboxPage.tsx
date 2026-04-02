import { useQuery } from 'react-query';
import { useState } from 'react';
import api from '../lib/api.ts';
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from '../components/ui';

interface InboxItem {
  id: string;
  title: string;
  description: string;
  type: 'mention' | 'assignment' | 'comment' | 'approval';
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
}

export default function InboxPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const { data: items, isLoading } = useQuery<InboxItem[]>(
    ['inbox', filter],
    () =>
      api
        .get('/inbox', {
          params: { unread: filter === 'unread' },
        })
        .then((r) => r.data),
  );

  const typeLabels = {
    mention: 'メンション',
    assignment: 'アサイン',
    comment: 'コメント',
    approval: '承認依頼',
  };

  const typeEmojis = {
    mention: '@',
    assignment: '📌',
    comment: '💬',
    approval: '✓',
  };

  if (isLoading) return <LoadingSpinner text="受信箱を読み込み中..." />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">受信箱</h1>
        <span className="text-sm text-slate-400">
          {items?.filter((i) => !i.read).length || 0} 件未読
        </span>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={
            filter === 'all'
              ? 'px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white'
              : 'px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600'
          }
        >
          すべて
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={
            filter === 'unread'
              ? 'px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white'
              : 'px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600'
          }
        >
          未読のみ
        </button>
      </div>

      {/* 受信箱リスト */}
      <div className="space-y-3">
        {items && items.length > 0 ? (
          items.map((item) => (
            <Card key={item.id} hoverable>
              <CardBody className="flex items-start gap-4">
                <div className="flex-shrink-0 text-2xl">
                  {typeEmojis[item.type as keyof typeof typeEmojis]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-100">{item.title}</h3>
                    {!item.read && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-sky-500" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge
                      variant={
                        item.priority === 'high'
                          ? 'danger'
                          : item.priority === 'medium'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                    </Badge>
                    <Badge>{typeLabels[item.type as keyof typeof typeLabels]}</Badge>
                    <span className="text-xs text-slate-500">{item.createdAt}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        ) : (
          <EmptyState
            icon="📭"
            title={filter === 'unread' ? '未読はありません' : 'メッセージはありません'}
          />
        )}
      </div>
    </div>
  );
}
