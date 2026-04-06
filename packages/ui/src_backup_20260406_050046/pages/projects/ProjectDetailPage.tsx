import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate, formatDateOnly } from '../../lib/date.ts';
import { Alert, LoadingSpinner, Badge } from '../../components/ui';
import { Pencil, X } from 'lucide-react';

interface ProjectDetail {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Goal {
  id: string;
  name: string;
  description: string | null;
  deadline: string | null;
  status: string;
  progress: number;
}

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
}

interface IssueGoalLink {
  goal_id: string;
  issue_id: string;
}

const STATUS_BADGE: Record<string, 'warning' | 'success' | 'default' | 'info'> = {
  backlog: 'default',
  todo: 'info',
  in_progress: 'warning',
  done: 'success',
};

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'backlog' },
  { value: 'todo', label: 'todo' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'done', label: '完了' },
  { value: 'cancelled', label: 'cancelled' },
];

function IssueRow({ issue, done, onStatusChange, onDelete, onEdit }: {
  issue: Issue;
  done?: boolean;
  onStatusChange?: (issueId: string, status: string) => void;
  onDelete?: (issueId: string) => void;
  onEdit?: (issueId: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(issue.title);

  const handleSave = () => {
    if (editTitle.trim() && editTitle !== issue.title) {
      onEdit?.(issue.id, editTitle.trim());
    }
    setEditing(false);
  };

  return (
    <div className={`flex items-center justify-between gap-2 rounded-th-md px-4 py-2.5 transition-colors ${
      done
        ? 'bg-th-surface-1 border border-th-border opacity-60'
        : 'bg-th-surface-0 border border-th-border'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xs text-th-text-4 flex-shrink-0">{issue.identifier}</span>
        {editing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 bg-th-surface-1 border border-th-border-accent rounded-th-md px-2 py-0.5 text-sm text-th-text focus:outline-none"
            autoFocus
          />
        ) : (
          <span
            className={`text-sm truncate cursor-pointer hover:opacity-80 ${done ? 'text-th-text-3 line-through' : 'text-th-text'}`}
            onClick={() => setEditing(true)}
            title="クリックで編集"
          >
            {issue.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <select
          value={issue.status}
          onChange={(e) => onStatusChange?.(issue.id, e.target.value)}
          className={`text-xs font-medium rounded-th-md px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-th-accent ${
            issue.status === 'done'
              ? 'bg-th-success-dim border-th-border text-th-success'
              : issue.status === 'in_progress'
              ? 'bg-th-warning-dim border-th-border text-th-warning'
              : issue.status === 'todo'
              ? 'bg-th-accent-dim border-th-border text-th-accent'
              : 'bg-th-surface-1 border-th-border-strong text-th-text-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDelete?.(issue.id)}
          className="p-1 rounded-th-md text-th-text-4 hover:text-th-danger hover:bg-th-danger-dim transition-colors"
          title="削除"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** 折りたたみ可能なゴールカード */
function GoalCard({ goal, todoIssues, doneIssues, onStatusChange, onDelete, onEdit }: {
  goal: Goal;
  todoIssues: Issue[];
  doneIssues: Issue[];
  onStatusChange?: (issueId: string, status: string) => void;
  onDelete?: (issueId: string) => void;
  onEdit?: (issueId: string, title: string) => void;
}) {
  // in_progress の課題があれば自動展開、なければ折りたたみ
  const [open, setOpen] = useState(() =>
    todoIssues.some(i => i.status === 'in_progress')
  );
  const total = todoIssues.length + doneIssues.length;

  return (
    <div className="bg-th-surface-0 border border-th-border rounded-th-md overflow-hidden">
      {/* ゴールヘッダー（クリックで課題開閉） */}
      <button
        type="button"
        className="w-full text-left p-4 hover:bg-th-surface-1 transition-colors"
        onClick={() => total > 0 && setOpen(v => !v)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-th-text">{goal.name}</h3>
              {total > 0 && (
                <span className="text-xs text-th-text-4">
                  {doneIssues.length}/{total}件
                  <span className="ml-1">{open ? '▲' : '▼'}</span>
                </span>
              )}
              {total === 0 && (
                <span className="text-xs text-th-text-4">課題なし</span>
              )}
            </div>
            {goal.description && (
              <p className="text-xs text-th-text-3 mt-1 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {goal.deadline && (
              <span className="text-xs text-th-text-4">〆 {formatDateOnly(goal.deadline)}</span>
            )}
            <span className="text-xs text-th-text-3">進捗 {goal.progress}%</span>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="h-1.5 bg-th-surface-1 rounded-full overflow-hidden">
          <div
            className="h-full bg-th-accent rounded-full transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </button>

      {/* 課題リスト（折りたたみ） */}
      {open && total > 0 && (
        <div className="border-t border-th-border px-4 pb-3 pt-2 space-y-1">
          {todoIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} onStatusChange={onStatusChange} onDelete={onDelete} onEdit={onEdit} />
          ))}
          {doneIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} done onStatusChange={onStatusChange} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    try {
      await api.patch(`/issues/${issueId}`, { status: newStatus });
      queryClient.invalidateQueries(['project-issues', id]);
      queryClient.invalidateQueries(['project-goals', id]);
    } catch {
      setMutationError(t('common.updateFailed'));
    }
  };

  const handleDelete = async (issueId: string) => {
    try {
      await api.delete(`/issues/${issueId}`);
      queryClient.invalidateQueries(['project-issues', id]);
      queryClient.invalidateQueries(['project-goals', id]);
    } catch {
      setMutationError(t('common.deleteFailed'));
    }
  };

  const handleEdit = async (issueId: string, newTitle: string) => {
    try {
      await api.patch(`/issues/${issueId}`, { title: newTitle });
      queryClient.invalidateQueries(['project-issues', id]);
    } catch {
      setMutationError(t('common.updateFailed'));
    }
  };

  const { data: project, isLoading, error } = useQuery<ProjectDetail>(
    ['project', id],
    () => api.get(`/projects/${id}`).then((r) => r.data.data),
  );

  // refetchOnWindowFocus + 30秒ポーリングで常に最新状態を維持
  const REFETCH_OPTS = { enabled: !!id, refetchOnWindowFocus: true, refetchInterval: 10000, keepPreviousData: true };

  const { data: goals = [] } = useQuery<Goal[]>(
    ['project-goals', id],
    () => api.get(`/projects/${id}/goals`).then((r) => r.data.data),
    REFETCH_OPTS,
  );

  const { data: issues = [] } = useQuery<Issue[]>(
    ['project-issues', id],
    () => api.get(`/projects/${id}/issues`).then((r) => r.data.data),
    REFETCH_OPTS,
  );

  const { data: links = [] } = useQuery<IssueGoalLink[]>(
    ['project-issue-goal-links', id],
    () => api.get(`/projects/${id}/issue-goal-links`).then((r) => r.data.data),
    REFETCH_OPTS,
  );

  if (isLoading) return <LoadingSpinner text={t('projects.loading')} />;
  if (error)
    return <div className="p-6"><Alert variant="danger" message={t('projects.notFound')} /></div>;

  // ゴールIDをキーにIssue IDのセットを作るマップ
  const goalIssueMap: Record<string, string[]> = {};
  for (const link of links) {
    if (!goalIssueMap[link.goal_id]) goalIssueMap[link.goal_id] = [];
    goalIssueMap[link.goal_id].push(link.issue_id);
  }

  // いずれかのゴールに紐付いているIssue IDのセット
  const linkedIssueIds = new Set(links.map(l => l.issue_id));


  return (
    <div className="p-6 space-y-8 max-w-4xl">

      {mutationError && (
        <Alert variant="danger" message={mutationError} onClose={() => setMutationError(null)} />
      )}

      {/* ── プロジェクト概要 ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{project?.name}</h1>
          <span className={`px-2 py-1 rounded-th-md text-xs ${
            project?.status === 'active' ? 'bg-th-success-dim text-th-success' : 'bg-th-surface-1 text-th-text-2'
          }`}>
            {project?.status === 'active' ? t('projects.active') : t('projects.archived')}
          </span>
        </div>
        {project?.description && (
          <p className="text-th-text-2 text-sm">{project.description}</p>
        )}
        <p className="text-xs text-th-text-4 mt-1">{formatDate(project?.created_at)}</p>
      </section>

      {/* ── ゴール（各ゴールに課題をぶら下げ、折りたたみ式） ── */}
      <section>
        <h2 className="text-xl font-semibold text-th-accent mb-3">ToDo</h2>
        {goals.length === 0 ? (
          <p className="text-th-text-4 text-sm">ToDoはまだありません</p>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const goalIssueIds = goalIssueMap[goal.id] ?? [];
              const goalIssues = issues.filter(i => goalIssueIds.includes(i.id));
              const todoIssues = goalIssues.filter(i => i.status !== 'done' && i.status !== 'cancelled');
              const doneIssues = goalIssues.filter(i => i.status === 'done');
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  todoIssues={todoIssues}
                  doneIssues={doneIssues}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── ゴール未紐付けのIssue ── */}
      {(() => {
        const unlinkedIssues = issues.filter(i => !linkedIssueIds.has(i.id));
        if (unlinkedIssues.length === 0) return null;
        const todoUnlinked = unlinkedIssues.filter(i => i.status !== 'done' && i.status !== 'cancelled');
        const doneUnlinked = unlinkedIssues.filter(i => i.status === 'done');
        return (
          <section>
            <h2 className="text-xl font-semibold text-th-text-3 mb-3">{t('projects.unlinkedIssues')}</h2>
            <div className="space-y-1">
              {todoUnlinked.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  done={false}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
              {doneUnlinked.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  done
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </section>
        );
      })()}

    </div>
  );
}
