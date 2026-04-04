import { useState } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { LoadingSpinner, Alert, EmptyState } from '../../components/ui';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface SessionSummary {
  id: string;
  company_id: string;
  session_id: string | null;
  agent_id: string | null;
  summary: string;
  changed_files: string[] | null;
  related_issue_ids: string[] | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  created_at: string;
}

interface SessionResponse {
  data: SessionSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: response, isLoading, error } = useQuery<SessionResponse>(
    ['session-summaries', page],
    () => api.get('/api/session-summaries', { params: { page, limit } }).then((r) => r.data),
  );

  const sessions = response?.data ?? [];
  const meta = response?.meta ?? { total: 0, page: 1, limit };
  const totalPages = Math.ceil(meta.total / limit);

  if (isLoading) {
    return <LoadingSpinner text={t('sessions.loading') || 'セッション記録を読み込み中...'} />;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">セッション記録</h1>
        <Alert variant="danger" message={t('sessions.loadError') || 'セッション記録の読み込みに失敗しました'} />
      </div>
    );
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">セッション記録</h1>
        <p className="text-slate-400 mt-2">{t('sessions.description') || 'エージェント実行のセッション履歴'}</p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="セッション記録がまだありません"
          description="エージェントの実行ログがここに表示されます"
        />
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
              >
                {/* Session Header */}
                <button
                  onClick={() => handleToggleExpand(session.id)}
                  className="w-full px-4 py-4 flex items-start justify-between gap-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex-1 text-left min-w-0">
                    {/* Date and Time */}
                    <div className="flex items-center gap-2 mb-2">
                      <time className="text-sm font-medium text-sky-200">
                        {formatDate(session.session_ended_at || session.created_at)}
                      </time>
                      {session.agent_id && (
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                          {session.agent_id}
                        </span>
                      )}
                    </div>

                    {/* Summary (truncated) */}
                    <p
                      className={clsx(
                        'text-sm text-slate-300 line-clamp-3',
                        expandedId === session.id && 'line-clamp-none'
                      )}
                    >
                      {session.summary}
                    </p>

                    {/* Metadata badges */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {session.changed_files && session.changed_files.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-900/30 text-emerald-200 border border-emerald-800/50">
                          <FileText className="h-3 w-3" />
                          {session.changed_files.length} {session.changed_files.length === 1 ? 'file changed' : 'files changed'}
                        </span>
                      )}

                      {session.related_issue_ids && session.related_issue_ids.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-900/30 text-amber-200 border border-amber-800/50">
                          {session.related_issue_ids.length} {session.related_issue_ids.length === 1 ? 'issue' : 'issues'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <div className="flex-shrink-0 pt-1">
                    {expandedId === session.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === session.id && (
                  <div className="border-t border-slate-700 px-4 py-4 bg-slate-900/50 space-y-4">
                    {/* Full Summary */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">サマリー</h4>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{session.summary}</p>
                    </div>

                    {/* Changed Files Details */}
                    {session.changed_files && session.changed_files.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">変更ファイル</h4>
                        <ul className="space-y-1">
                          {session.changed_files.map((file, idx) => (
                            <li key={idx} className="text-sm text-slate-400 font-mono break-all">
                              • {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Related Issues */}
                    {session.related_issue_ids && session.related_issue_ids.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">関連課題</h4>
                        <div className="flex flex-wrap gap-2">
                          {session.related_issue_ids.map((issueId, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300 border border-slate-600"
                            >
                              {issueId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Session Metadata */}
                    <div className="pt-2 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                        {session.session_started_at && (
                          <div>
                            <span className="font-semibold">開始:</span>
                            <div>{formatDate(session.session_started_at)}</div>
                          </div>
                        )}
                        {session.session_ended_at && (
                          <div>
                            <span className="font-semibold">終了:</span>
                            <div>{formatDate(session.session_ended_at)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  page === 1
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
              >
                前へ
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={clsx(
                      'min-w-[2.5rem] px-2 py-1 rounded-lg text-sm font-medium transition-colors',
                      p === page
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  page === totalPages
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
