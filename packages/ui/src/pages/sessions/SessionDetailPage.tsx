import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ChevronLeft, Clock, FileText, CheckCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api.ts';
import { LoadingSpinner, Alert } from '../../components/ui';

interface SessionDetail {
  id: string;
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

function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function getFileStatus(file: string): { color: string; label: string } {
  if (file.startsWith('+') || file.includes('(added)')) return { color: 'var(--color-success, #10b981)', label: 'A' };
  if (file.startsWith('-') || file.includes('(deleted)')) return { color: 'var(--color-danger, #ef4444)', label: 'D' };
  return { color: 'var(--color-info, #3b82f6)', label: 'M' };
}

function extractHeadline(summary: string): string {
  const lines = summary.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const match = line.match(/\*\*主な作業\*\*:\s*(.+)/);
    if (match) return match[1].trim();
  }
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#') || t.startsWith('---') || t === '') continue;
    if (/^Date:\s*\d{4}/.test(t)) continue;
    if (t.startsWith('<')) continue;
    if (/^\*\*(Date|Started|Project|Branch)\*\*/.test(t)) continue;
    return t.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').slice(0, 120);
  }
  return 'セッション記録';
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filesExpanded, setFilesExpanded] = useState(false);

  const { data: session, isLoading, error } = useQuery<SessionDetail>(
    ['session-detail', id],
    () => api.get(`/session-summaries/${id}`).then((r) => r.data?.data ?? r.data),
    { enabled: !!id },
  );

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner text="読み込み中..." /></div>;
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-th-text-3 hover:text-th-text mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> 作業記録一覧
        </button>
        <Alert variant="danger" message="セッションの取得に失敗しました" />
      </div>
    );
  }

  const headline = session.headline ?? extractHeadline(session.summary);
  const tasks = session.tasks ?? [];
  const decisions = session.decisions ?? [];
  const changedFiles = session.changed_files ?? [];
  const duration = calcDuration(session.session_started_at, session.session_ended_at);
  const dateStr = session.session_ended_at ?? session.session_started_at ?? session.created_at;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back nav */}
      <button
        onClick={() => navigate('/sessions')}
        className="flex items-center gap-1.5 text-sm text-th-text-3 hover:text-th-text transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> 作業記録一覧
      </button>

      {/* Header */}
      <div className="space-y-3">
        <div className="text-xs text-th-text-4 font-mono">
          {session.session_id ?? session.id.slice(0, 8).toUpperCase()} · {formatDate(dateStr)}
        </div>
        <h1 className="text-2xl font-semibold leading-tight">{headline}</h1>

        <div className="flex flex-wrap gap-2">
          {duration && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-th-sm bg-th-surface-1 border border-th-border text-th-text-2">
              <Clock className="h-3.5 w-3.5 text-th-text-3" />
              {duration}
            </span>
          )}
          {tasks.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-th-sm bg-th-accent-dim border border-th-accent/20 text-th-accent">
              <CheckCircle className="h-3.5 w-3.5" />
              タスク {tasks.length} 件
            </span>
          )}
          {changedFiles.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-th-sm bg-th-success-dim border border-th-success/20 text-th-success">
              <FileText className="h-3.5 w-3.5" />
              変更ファイル {changedFiles.length} 件
            </span>
          )}
          {decisions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-th-sm bg-th-warning-dim border border-th-warning/20 text-th-warning">
              <Lightbulb className="h-3.5 w-3.5" />
              決定事項 {decisions.length} 件
            </span>
          )}
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6">
          <h2 className="text-sm font-semibold text-th-text-2 uppercase tracking-wider mb-4">
            タスク（{tasks.length} 件）
          </h2>
          <ul className="space-y-2.5">
            {tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-th-success flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span style={{ color: 'white', fontSize: 9 }}>✓</span>
                </div>
                <span className="text-sm text-th-text leading-relaxed">{task}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {decisions.length > 0 && (
        <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6">
          <h2 className="text-sm font-semibold text-th-text-2 uppercase tracking-wider mb-4">
            決定事項（{decisions.length} 件）
          </h2>
          <ol className="space-y-3 pl-4 list-decimal">
            {decisions.map((decision, i) => (
              <li key={i} className="text-sm text-th-text leading-relaxed pl-1">{decision}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Changed files */}
      {changedFiles.length > 0 && (
        <div className="bg-th-surface-0 rounded-th-md border border-th-border overflow-hidden">
          <button
            onClick={() => setFilesExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-th-surface-1 transition-colors"
          >
            <h2 className="text-sm font-semibold text-th-text-2 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" />
              変更ファイル（{changedFiles.length} 件）
            </h2>
            {filesExpanded
              ? <ChevronUp className="h-4 w-4 text-th-text-3" />
              : <ChevronDown className="h-4 w-4 text-th-text-3" />}
          </button>

          {filesExpanded && (
            <div className="border-t border-th-border bg-th-surface-1 p-4">
              <div className="space-y-1">
                {changedFiles.map((file, i) => {
                  const { color, label } = getFileStatus(file);
                  const cleanFile = file.replace(/^\+\s*|-\s*|\(added\)|\(deleted\)/g, '').trim();
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 py-1 px-2 rounded hover:bg-th-surface-2 transition-colors"
                    >
                      <span
                        className="text-xs font-bold font-mono w-3 flex-shrink-0"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <span className="text-xs font-mono text-th-text-2 truncate">{cleanFile}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary text */}
      <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6">
        <h2 className="text-sm font-semibold text-th-text-2 uppercase tracking-wider mb-4">サマリー</h2>
        <pre className="text-sm text-th-text-2 whitespace-pre-wrap break-words font-sans leading-relaxed max-h-96 overflow-y-auto">
          {session.summary}
        </pre>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-6 text-xs text-th-text-4 pt-2 border-t border-th-border">
        {session.session_started_at && (
          <span>開始: {formatDate(session.session_started_at)}</span>
        )}
        {session.session_ended_at && (
          <span>終了: {formatDate(session.session_ended_at)}</span>
        )}
        <span>ID: {session.id}</span>
        {session.agent_id && <span>エージェント: {session.agent_id.slice(0, 8)}</span>}
        {session.related_issue_ids && session.related_issue_ids.length > 0 && (
          <span>関連 Issue: {session.related_issue_ids.join(', ')}</span>
        )}
      </div>
    </div>
  );
}
