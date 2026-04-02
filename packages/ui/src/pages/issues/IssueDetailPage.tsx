import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface IssueDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  comments: { id: string; author: string; text: string; timestamp: string }[];
}

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const { data, isLoading, error } = useQuery<IssueDetail>(
    ['issue', id],
    () => api.get(`/issues/${id}`).then((r) => r.data),
  );

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await api.post(`/issues/${id}/comments`, { text: newComment });
    setNewComment('');
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    await api.patch(`/issues/${id}`, { status: newStatus });
  };

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">Issueが見つかりません</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h1 className="text-3xl font-bold mb-2">{data?.title}</h1>
        <p className="text-slate-400 text-sm mb-4">{data?.createdAt}</p>
        <p className="text-slate-300 mb-6">{data?.description}</p>

        <div className="flex gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">ステータス</label>
            <select
              value={newStatus || data?.status || ''}
              onChange={(e) => setNewStatus(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm"
            >
              <option value="">選択...</option>
              <option value="open">オープン</option>
              <option value="in-progress">進行中</option>
              <option value="closed">完了</option>
            </select>
            <button
              onClick={handleStatusChange}
              className="mt-2 bg-sky-600 hover:bg-sky-700 px-3 py-1 rounded text-sm"
            >
              更新
            </button>
          </div>
        </div>
      </div>

      {/* コメント */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold mb-4">コメント</h2>
        <div className="space-y-3 mb-4">
          {data?.comments && data.comments.length > 0 ? (
            data.comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-slate-900 rounded p-3 border border-slate-700"
              >
                <p className="font-bold text-sm">{comment.author}</p>
                <p className="text-slate-300 text-sm mt-1">{comment.text}</p>
                <p className="text-xs text-slate-500 mt-2">{comment.timestamp}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">コメントはありません</p>
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="コメントを入力..."
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
            rows={3}
          />
          <button
            onClick={handleAddComment}
            className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
          >
            コメントを追加
          </button>
        </div>
      </div>
    </div>
  );
}
