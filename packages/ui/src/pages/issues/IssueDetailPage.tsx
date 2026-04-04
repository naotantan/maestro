import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Alert, Badge } from '../../components/ui';

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

// エージェント検索結果
interface AgentSuggestion {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

const STATUS_BADGE: Record<string, 'warning' | 'success' | 'default' | 'info'> = {
  backlog: 'default',
  todo: 'info',
  in_progress: 'warning',
  in_review: 'warning',
  done: 'success',
  cancelled: 'default',
};

/** @メンションをハイライト表示 */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[\w\u3040-\u9FFF\u30A0-\u30FF\-]+)/g);
  return (
    <p className="text-slate-300 text-sm mt-1">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-sky-400 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default function IssueDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  // @メンション サジェスト状態
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Issue本体
  const { data, isLoading, error } = useQuery<IssueDetail>(
    ['issue', id],
    () => api.get(`/issues/${id}`).then((r) => r.data.data),
  );

  // コメント（/issues/:id とは別 fetch）
  const { data: commentsData, isLoading: commentsLoading, error: commentsError } = useQuery<Comment[]>(
    ['issue-comments', id],
    () => api.get(`/issues/${id}/comments`).then((r) => r.data.data),
    { enabled: !!id, refetchInterval: 10000 },
  );

  // @メンション検索（300ms デバウンス）
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q && q !== '') return;
    const res = await api.get('/agents/search', { params: { q } });
    setSuggestions(res.data.data ?? []);
    setSuggestionVisible(true);
    setActiveSuggestion(0);
  }, []);

  // テキスト変更時: @メンション位置を検出
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);

    // カーソル位置より前のテキストで最後の @ を探す
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w\u3040-\u9FFF\u30A0-\u30FF\-]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      fetchSuggestions(match[1]);
    } else {
      setSuggestionVisible(false);
    }
  }, [fetchSuggestions]);

  // サジェスト選択
  const selectSuggestion = useCallback((agent: AgentSuggestion) => {
    const cursor = textareaRef.current?.selectionStart ?? newComment.length;
    const before = newComment.slice(0, cursor);
    const after = newComment.slice(cursor);
    // 現在の @xxx を @name に置換
    const replaced = before.replace(/@([\w\u3040-\u9FFF\u30A0-\u30FF\-]*)$/, `@${agent.name} `);
    setNewComment(replaced + after);
    setSuggestionVisible(false);
    // テキストエリアにフォーカスを戻す
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [newComment]);

  // キーボード操作（サジェスト表示中）
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestionVisible || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setSuggestionVisible(false);
    }
  }, [suggestionVisible, suggestions, activeSuggestion, selectSuggestion]);

  // 外クリックでサジェストを閉じる
  useEffect(() => {
    const handler = () => setSuggestionVisible(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // コメント投稿
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await api.post(`/issues/${id}/comments`, { body: newComment });
    setNewComment('');
    setSuggestionVisible(false);
    queryClient.invalidateQueries(['issue-comments', id]);
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

        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">{t('common.status')}</span>
          <Badge variant={STATUS_BADGE[data?.status ?? ''] ?? 'default'}>
            {data?.status}
          </Badge>
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
                <CommentBody body={comment.body} />
                <p className="text-xs text-slate-500 mt-2">{formatDate(comment.created_at)}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">{t('issues.noComments')}</p>
          )}
        </div>

        {/* コメント入力（@メンション サジェスト付き） */}
        <div className="space-y-2 relative">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={`${t('issues.commentPlaceholder')} （@エージェント名でメンション）`}
            aria-label={t('issues.commentPlaceholder')}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
            rows={3}
          />

          {/* @メンション サジェストドロップダウン */}
          {suggestionVisible && suggestions.length > 0 && (
            <div
              className="absolute z-50 bottom-full mb-1 left-0 w-64 bg-slate-900 border border-slate-600 rounded-lg shadow-xl overflow-hidden"
              onMouseDown={(e) => e.preventDefault()} // blur を防ぐ
            >
              <div className="px-2 py-1 text-xs text-slate-500 border-b border-slate-700">
                {mentionQuery ? `"${mentionQuery}" を検索中` : 'エージェント一覧'}
              </div>
              {suggestions.map((agent, i) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                    i === activeSuggestion
                      ? 'bg-sky-700 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  onClick={() => selectSuggestion(agent)}
                >
                  <span className="flex-1 truncate">@{agent.name}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{agent.type}</span>
                </button>
              ))}
            </div>
          )}

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
