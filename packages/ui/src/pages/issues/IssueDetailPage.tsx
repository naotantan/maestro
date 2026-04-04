import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Alert } from '../../components/ui';

// GET /api/issues/:id のレスポンス型（commentsは含まない）
interface IssueDetail {
  id: string;
  company_id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// GET /api/issues/:id/comments のレスポンス型
interface Comment {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export default function IssueDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const queryClient = useQueryClient();

  // Issue本体
  const { data, isLoading, error } = useQuery<IssueDetail>(
    ['issue', id],
    () => api.get(`/issues/${id}`).then((r) => r.data.data),
  );

  // コメント（/issues/:id とは別 fetch）
  const { data: commentsData, isLoading: commentsLoading, error: commentsError } = useQuery<Comment[]>(
    ['issue-comments', id],
    () => api.get(`/issues/${id}/comments`).then((r) => r.data.data),
    { enabled: !!id },
  );

  // コメント投稿（body フィールドを使用）
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await api.post(`/issues/${id}/comments`, { body: newComment });
    setNewComment('');
    // 投稿後にコメント一覧を再取得
    queryClient.invalidateQueries(['issue-comments', id]);
  };

  // ステータス更新
  const handleStatusChange = async () => {
    if (!newStatus) return;
    await api.patch(`/issues/${id}`, { status: newStatus });
    // 更新後にIssue本体を再取得
    queryClient.invalidateQueries(['issue', id]);
  };

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('issues.notFound')} /></div>;

  const comments = commentsData ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <p className="text-xs text-slate-500 mb-1">{data?.identifier}</p>
        <h1 className="text-3xl font-bold mb-2">{data?.title}</h1>
        <p className="text-slate-400 text-sm mb-4">{formatDate(data?.created_at)}</p>
        <p className="text-slate-300 mb-6">{data?.description ?? t('issues.noDescription')}</p>

        <div className="flex gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">{t('common.status')}</label>
            <select
              value={newStatus || data?.status || ''}
              onChange={(e) => setNewStatus(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm"
            >
              <option value="">{t('issues.selectStatus')}</option>
              <option value="backlog">{t('issues.status.backlog')}</option>
              <option value="in_progress">{t('issues.status.inProgress')}</option>
              <option value="done">{t('issues.status.done')}</option>
            </select>
            <button
              onClick={handleStatusChange}
              className="mt-2 bg-sky-600 hover:bg-sky-700 px-3 py-1 rounded text-sm"
            >
              {t('common.update')}
            </button>
          </div>
        </div>
      </div>

      {/* コメント */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold mb-4">{t('issues.comments')}</h2>
        <div className="space-y-3 mb-4">
          {commentsLoading ? (
            <p className="text-slate-400 text-sm">{t('common.loading')}</p>
          ) : commentsError ? (
            <Alert variant="danger" message={t('issues.commentsFetchError')} />
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-slate-900 rounded p-3 border border-slate-700"
              >
                <p className="font-mono text-xs text-slate-400">{comment.author_id}</p>
                <p className="text-slate-300 text-sm mt-1">{comment.body}</p>
                <p className="text-xs text-slate-500 mt-2">{formatDate(comment.created_at)}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">{t('issues.noComments')}</p>
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('issues.commentPlaceholder')}
            aria-label={t('issues.commentPlaceholder')}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
            rows={3}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium text-sm"
          >
            {t('issues.addComment')}
          </button>
        </div>
      </div>
    </div>
  );
}
