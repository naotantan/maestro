import { useState } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { LoadingSpinner, Alert, EmptyState } from '../../components/ui';
import { ChevronDown, ChevronUp, FileText, Clock, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface SessionSummary {
  id: string;
  company_id: string;
  session_id: string | null;
  agent_id: string | null;
  summary: string;
  headline: string | null;
  tasks: string[] | null;
  decisions: string[] | null;
  changed_files: string[] | null;
  related_issue_ids: string[] | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  created_at: string;
}

interface SessionResponse {
  data: SessionSummary[];
  meta: { total?: number; limit: number; offset: number };
}

/** Markdownの先頭から「概要」や最初の箇条書きを抽出して短い要約にする */
function extractHeadline(summary: string): string {
  const lines = summary.split('\n').filter((l) => l.trim());

  // "主な作業" や "概要" を探す
  for (const line of lines) {
    const match = line.match(/\*\*主な作業\*\*:\s*(.+)/);
    if (match) return match[1].trim();
  }

  // 最初の見出し以外の実質的な行を返す
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('---')) continue;
    if (trimmed === '') continue;
    // ゴミっぽいパターンを除外
    if (/^Date:\s*\d{4}-\d{2}-\d{2}/.test(trimmed)) continue;
    if (trimmed.startsWith('<') || trimmed.startsWith('&lt;')) continue;
    if (/^\*\*(Date|Started|Last Updated|Project|Branch|Worktree)\*\*/.test(trimmed)) continue;
    // マークダウン記法を除去
    const cleaned = trimmed
      .replace(/^[-*]\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 120);
    if (cleaned.length > 3) return cleaned;
  }

  return 'セッション記録';
}

/** Markdownから作業テーブルの行を抽出 */
function extractTasks(summary: string): string[] {
  const tasks: string[] = [];
  const lines = summary.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.includes('作業内容') || line.includes('作業 |')) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (line.trim().startsWith('|') && !line.includes('---')) {
        const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cols.length >= 2 && cols[0] !== '作業') {
          const task = cols[0].replace(/\*\*/g, '');
          // XMLや意味のないゴミは除外
          if (!task.startsWith('<') && !task.startsWith('&lt;') && task.length > 2) {
            tasks.push(task);
          }
        }
      } else if (!line.trim().startsWith('|') && line.trim() !== '') {
        inTable = false;
      }
    }
    if (tasks.length >= 5) break;
  }

  return tasks;
}

/** タスクがない場合のサマリープレビューを抽出 */
function extractSummaryPreview(summary: string): string[] {
  const lines = summary.split('\n');
  const preview: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
    if (/^Date:\s*\d{4}/.test(trimmed)) continue;
    if (trimmed.startsWith('<') || trimmed.startsWith('&lt;')) continue;
    if (/^\*\*(Date|Started|Last Updated|Project|Branch|Worktree)\*\*/.test(trimmed)) continue;
    const cleaned = trimmed
      .replace(/^[-*]\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 80);
    if (cleaned.length > 3) {
      preview.push(cleaned);
    }
    if (preview.length >= 3) break;
  }

  return preview;
}

/** Markdownから決定事項を抽出 */
function extractDecisions(summary: string): string[] {
  const decisions: string[] = [];
  const lines = summary.split('\n');
  let inDecisions = false;

  for (const line of lines) {
    if (line.match(/^#{1,3}\s*決定事項/)) {
      inDecisions = true;
      continue;
    }
    if (inDecisions) {
      if (line.match(/^#{1,3}\s/) && !line.includes('決定事項')) {
        inDecisions = false;
        continue;
      }
      const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
      if (match) {
        decisions.push(match[1]);
      }
    }
    if (decisions.length >= 5) break;
  }

  return decisions;
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: response, isLoading, error } = useQuery<SessionResponse>(
    ['session-summaries', page],
    () => api.get('/session-summaries', { params: { page, limit } }).then((r) => r.data),
  );

  const sessions = response?.data ?? [];
  const total = response?.meta?.total ?? sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner text={t('sessions.loading')} /></div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">{t('sessions.title')}</h1>
        <Alert variant="danger" message={t('sessions.loadError')} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold gradient-text">
          {t('sessions.title')}
        </h1>
        <p className="text-th-text-3">
          {t('sessions.description')}
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="rounded-th border border-th-border bg-th-surface-1 px-4 py-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-th-text-3" />
          <span className="text-sm text-th-text-2">{t('sessions.recordCount', { count: total })}</span>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="📝"
          title={t('sessions.emptyTitle')}
          description={t('sessions.emptyDescription')}
        />
      ) : (
        <>
          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-th-border" />

            <div className="space-y-4">
              {sessions.map((session) => {
                const isExpanded = expandedId === session.id;
                // 構造化データがあればそちらを優先、なければMarkdownから抽出
                const headline = session.headline ?? extractHeadline(session.summary);
                const tasks = session.tasks ?? extractTasks(session.summary);
                const decisions = session.decisions ?? extractDecisions(session.summary);
                const summaryPreview = tasks.length === 0 ? extractSummaryPreview(session.summary) : [];
                const fileCount = session.changed_files?.length ?? 0;
                const dateStr = session.session_ended_at ?? session.created_at;

                return (
                  <div key={session.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className="absolute left-[14px] top-5 w-[11px] h-[11px] rounded-full bg-th-accent border-2 border-th-bg z-10" />

                    <div className="rounded-th border border-th-border bg-th-surface-1 overflow-hidden transition-all hover:border-th-border-strong">
                      {/* Card header */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : session.id)}
                        className="w-full px-5 py-4 text-left hover:bg-th-surface-2 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Date */}
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-3.5 w-3.5 text-th-accent" />
                              <time className="text-sm font-medium text-th-accent">
                                {formatSessionDate(dateStr)}
                              </time>
                            </div>

                            {/* Headline */}
                            <p className="text-sm font-medium text-th-text leading-relaxed">
                              {headline}
                            </p>

                            {/* Tasks preview (collapsed) */}
                            {!isExpanded && tasks.length > 0 && (
                              <ul className="mt-2 space-y-0.5">
                                {tasks.slice(0, 3).map((task, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-th-text-3">
                                    <span className="text-th-accent mt-0.5 flex-shrink-0">•</span>
                                    <span className="truncate">{task}</span>
                                  </li>
                                ))}
                                {tasks.length > 3 && (
                                  <li className="text-xs text-th-text-4 pl-4">他 {tasks.length - 3} 件...</li>
                                )}
                              </ul>
                            )}

                            {/* Summary preview fallback when no tasks */}
                            {!isExpanded && summaryPreview.length > 0 && (
                              <ul className="mt-2 space-y-0.5">
                                {summaryPreview.map((line, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-th-text-4">
                                    <span className="text-th-text-4 mt-0.5 flex-shrink-0">•</span>
                                    <span className="truncate">{line}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Badges */}
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {fileCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-th-sm bg-th-success-dim text-th-success border border-th-success/20">
                                  <FileText className="h-3 w-3" />
                                  {fileCount} ファイル変更
                                </span>
                              )}
                              {tasks.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-th-sm bg-th-accent-dim text-th-accent border border-th-accent/20">
                                  {tasks.length} 件の作業
                                </span>
                              )}
                              {decisions.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-th-sm bg-th-warning-dim text-th-warning border border-th-warning/20">
                                  {decisions.length} 件の決定
                                </span>
                              )}
                              {session.related_issue_ids && session.related_issue_ids.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-th-sm bg-th-info-dim text-th-info border border-th-info/20">
                                  {session.related_issue_ids.length} Issue
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0 pt-1">
                            {isExpanded
                              ? <ChevronUp className="h-5 w-5 text-th-text-3" />
                              : <ChevronDown className="h-5 w-5 text-th-text-3" />}
                          </div>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-th-border px-5 py-5 space-y-5 bg-th-surface-0">
                          {/* Tasks */}
                          {tasks.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">作業内容</h4>
                              <ul className="space-y-1.5">
                                {tasks.map((task, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-th-text-2">
                                    <span className="text-th-success mt-0.5">●</span>
                                    {task}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Decisions */}
                          {decisions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">決定事項</h4>
                              <ul className="space-y-1.5">
                                {decisions.map((d, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-th-text-2">
                                    <span className="text-th-warning mt-0.5">▸</span>
                                    {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Changed files */}
                          {session.changed_files && session.changed_files.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">
                                変更ファイル ({session.changed_files.length})
                              </h4>
                              <div className="max-h-48 overflow-y-auto rounded-th-sm bg-th-surface-0 p-3">
                                {session.changed_files.map((file, i) => (
                                  <div key={i} className="text-xs text-th-text-3 font-mono py-0.5 truncate">
                                    {file}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Full summary (collapsible raw) */}
                          <details className="group">
                            <summary className="text-xs font-semibold text-th-text-4 uppercase tracking-wider cursor-pointer hover:text-th-text-2 transition-colors">
                              全文を表示
                            </summary>
                            <div className="mt-3 rounded-th-sm bg-th-surface-0 p-4 max-h-96 overflow-y-auto">
                              <pre className="text-xs text-th-text-3 whitespace-pre-wrap break-words font-sans leading-relaxed">
                                {session.summary}
                              </pre>
                            </div>
                          </details>

                          {/* Metadata */}
                          <div className="pt-3 border-t border-th-border/50 flex gap-6 text-xs text-th-text-4">
                            {session.session_started_at && (
                              <span>開始: {formatDate(session.session_started_at)}</span>
                            )}
                            {session.session_ended_at && (
                              <span>終了: {formatDate(session.session_ended_at)}</span>
                            )}
                            <span>ID: {session.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={clsx(
                  'px-3 py-2 rounded-th-sm text-sm font-medium transition-colors',
                  page === 1 ? 'bg-th-surface-1 text-th-text-4 cursor-not-allowed' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
                )}
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'min-w-[2.5rem] px-2 py-1 rounded-th-sm text-sm font-medium transition-colors',
                    p === page ? 'bg-th-accent text-white' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={clsx(
                  'px-3 py-2 rounded-th-sm text-sm font-medium transition-colors',
                  page === totalPages ? 'bg-th-surface-1 text-th-text-4 cursor-not-allowed' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
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
