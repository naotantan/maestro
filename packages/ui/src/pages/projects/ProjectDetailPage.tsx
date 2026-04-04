import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate, formatDateOnly } from '../../lib/date.ts';
import { Alert, LoadingSpinner, Badge } from '../../components/ui';

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

function IssueRow({ issue, done }: { issue: Issue; done?: boolean }) {
  return (
    <Link to={`/issues/${issue.id}`}>
      <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors ${
        done
          ? 'bg-slate-900 border border-slate-800 opacity-60 hover:opacity-80'
          : 'bg-slate-800/60 border border-slate-700/60 hover:border-sky-600'
      }`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs text-slate-500 flex-shrink-0">{issue.identifier}</span>
          <span className={`text-sm truncate ${done ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
            {issue.title}
          </span>
        </div>
        <Badge variant={done ? 'success' : (STATUS_BADGE[issue.status] ?? 'default')}>
          {done ? '完了' : issue.status}
        </Badge>
      </div>
    </Link>
  );
}

/** 折りたたみ可能なゴールカード */
function GoalCard({ goal, todoIssues, doneIssues }: {
  goal: Goal;
  todoIssues: Issue[];
  doneIssues: Issue[];
}) {
  // in_progress の課題があれば自動展開、なければ折りたたみ
  const [open, setOpen] = useState(() =>
    todoIssues.some(i => i.status === 'in_progress')
  );
  const total = todoIssues.length + doneIssues.length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* ゴールヘッダー（クリックで課題開閉） */}
      <button
        type="button"
        className="w-full text-left p-4 hover:bg-slate-700/40 transition-colors"
        onClick={() => total > 0 && setOpen(v => !v)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100">{goal.name}</h3>
              {total > 0 && (
                <span className="text-xs text-slate-500">
                  {doneIssues.length}/{total}件
                  <span className="ml-1">{open ? '▲' : '▼'}</span>
                </span>
              )}
              {total === 0 && (
                <span className="text-xs text-slate-600">課題なし</span>
              )}
            </div>
            {goal.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {goal.deadline && (
              <span className="text-xs text-slate-500">〆 {formatDateOnly(goal.deadline)}</span>
            )}
            <span className="text-xs text-slate-400">進捗 {goal.progress}%</span>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </button>

      {/* 課題リスト（折りたたみ） */}
      {open && total > 0 && (
        <div className="border-t border-slate-700 px-4 pb-3 pt-2 space-y-1">
          {todoIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
          {doneIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} done />
          ))}
        </div>
      )}
    </div>
  );
}

/** 課題追加モーダル */
function AddIssueModal({ projectId, onClose, onSuccess }: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('タイトルは必須です');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/issues', {
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId,
      });

      setTitle('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err) {
      setError('課題の作成に失敗しました');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">課題を追加</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* タイトル入力 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              タイトル <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="課題のタイトルを入力"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              disabled={isSubmitting}
            />
          </div>

          {/* 説明入力 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細な説明を入力（オプション）"
              rows={4}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium rounded transition-colors"
            >
              {isSubmitting ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isAddIssueOpen, setIsAddIssueOpen] = useState(false);

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

  // ゴールに紐付かない課題
  const unlinkedIssues = issues.filter(i => !linkedIssueIds.has(i.id));
  const unlinkedTodo = unlinkedIssues.filter(i => i.status !== 'done' && i.status !== 'cancelled');
  const unlinkedDone = unlinkedIssues.filter(i => i.status === 'done');

  return (
    <div className="p-6 space-y-8 max-w-4xl">

      {/* ── プロジェクト概要 ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{project?.name}</h1>
          <span className={`px-2 py-1 rounded text-xs ${
            project?.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-slate-700 text-slate-300'
          }`}>
            {project?.status === 'active' ? t('projects.active') : t('projects.archived')}
          </span>
        </div>
        {project?.description && (
          <p className="text-slate-300 text-sm">{project.description}</p>
        )}
        <p className="text-xs text-slate-500 mt-1">{formatDate(project?.created_at)}</p>
      </section>

      {/* ── ゴール（各ゴールに課題をぶら下げ、折りたたみ式） ── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-xl font-semibold text-sky-400">タスク</h2>
          <button
            onClick={() => setIsAddIssueOpen(true)}
            className="px-3 py-1 text-sm bg-sky-500 hover:bg-sky-600 text-white font-medium rounded transition-colors"
          >
            ＋ 課題を追加
          </button>
        </div>
        {goals.length === 0 ? (
          <p className="text-slate-500 text-sm">タスクはまだありません</p>
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
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── ゴール未紐付きの課題 ── */}
      {unlinkedIssues.length > 0 && (
        <UnlinkedIssuesSection todoIssues={unlinkedTodo} doneIssues={unlinkedDone} />
      )}

      {/* 課題追加モーダル */}
      {isAddIssueOpen && (
        <AddIssueModal
          projectId={id || ''}
          onClose={() => setIsAddIssueOpen(false)}
          onSuccess={() => {
            if (id) {
              queryClient.invalidateQueries(['project-issues', id]);
            }
          }}
        />
      )}
    </div>
  );
}

/** ゴール未紐付き課題（折りたたみ式） */
function UnlinkedIssuesSection({ todoIssues, doneIssues }: {
  todoIssues: Issue[];
  doneIssues: Issue[];
}) {
  const [open, setOpen] = useState(false);
  const total = todoIssues.length + doneIssues.length;
  return (
    <section>
      <button
        type="button"
        className="flex items-center gap-2 text-xl font-semibold text-amber-400 mb-3 hover:text-amber-300"
        onClick={() => setOpen(v => !v)}
      >
        その他の課題
        <span className="text-sm font-normal text-slate-400">
          ({todoIssues.length}件未完了) {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          {todoIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
          {doneIssues.map(issue => <IssueRow key={issue.id} issue={issue} done />)}
        </div>
      )}
    </section>
  );
}
