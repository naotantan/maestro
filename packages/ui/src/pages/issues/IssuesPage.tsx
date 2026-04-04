import { useDeferredValue, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Button, Badge, Card, CardBody, LoadingSpinner, EmptyState, Alert } from '../../components/ui';
import { clsx } from 'clsx';

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  assigned_to?: string | null;
  created_at: string;
}

const statusBadgeVariants: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
  backlog: 'default',
  in_progress: 'warning',
  done: 'success',
};

function priorityLabel(
  p: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (p >= 3) return t('issues.priorities.high');
  if (p === 2) return t('issues.priorities.medium');
  return t('issues.priorities.low');
}

function priorityBadgeVariant(p: number): 'danger' | 'warning' | 'default' {
  if (p >= 3) return 'danger';
  if (p === 2) return 'warning';
  return 'default';
}

export default function IssuesPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | '3' | '2' | '1'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const queryClient = useQueryClient();
  const deferredSearchText = useDeferredValue(searchText);

  const statusLabels: Record<string, string> = {
    backlog: t('issues.status.backlog'),
    in_progress: t('issues.status.inProgress'),
    done: t('issues.status.done'),
  };

  const { data: issues, isLoading, error } = useQuery<Issue[]>(
    ['issues'],
    () => api.get('/issues').then((r) => r.data.data),
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await api.post('/issues', { title: newTitle.trim() });
    setNewTitle('');
    setShowCreate(false);
    queryClient.invalidateQueries(['issues']);
  };

  const allIssues = issues ?? [];
  const backlogCount = allIssues.filter((i) => i.status === 'backlog').length;
  const inProgressCount = allIssues.filter((i) => i.status === 'in_progress').length;
  const uniqueAssignees = Array.from(new Set(allIssues.map((issue) => issue.assigned_to).filter(Boolean))) as string[];

  const filteredIssues = allIssues.filter((issue) => {
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || String(issue.priority) === priorityFilter;
    const matchesAssignee = assigneeFilter === 'all' || issue.assigned_to === assigneeFilter;
    const search = deferredSearchText.trim().toLowerCase();
    const matchesSearch =
      search.length === 0 ||
      issue.title.toLowerCase().includes(search) ||
      issue.identifier.toLowerCase().includes(search) ||
      (issue.assigned_to ?? '').toLowerCase().includes(search);

    return matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text={t('issues.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">{t('issues.title')}</h1>
        <Alert
          variant="danger"
          message={t('issues.fetchError')}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            {t('issues.title')}
          </h1>
          <p className="text-slate-400">
            {t('issues.summary', { backlog: backlogCount, inProgress: inProgressCount })}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t('issues.newIssue')}
        </Button>
      </div>

      {showCreate && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <h2 className="text-sm font-bold">{t('issues.createTitle')}</h2>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('issues.titlePlaceholder')}
            aria-label={t('issues.titlePlaceholder')}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
            >
              {t('common.create')}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewTitle('');
              }}
              className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded text-sm font-medium"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))] gap-3">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t('issues.searchPlaceholder')}
          aria-label={t('issues.searchPlaceholder')}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('common.status')}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          <option value="all">{t('issues.allStatuses')}</option>
          <option value="backlog">{t('issues.status.backlog')}</option>
          <option value="in_progress">{t('issues.status.inProgress')}</option>
          <option value="done">{t('issues.status.done')}</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'all' | '3' | '2' | '1')}
          aria-label={t('issues.priority')}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          <option value="all">{t('issues.allPriorities')}</option>
          <option value="3">{t('issues.priorities.high')}</option>
          <option value="2">{t('issues.priorities.medium')}</option>
          <option value="1">{t('issues.priorities.low')}</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label={t('issues.assignee')}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          <option value="all">{t('issues.allAssignees')}</option>
          {uniqueAssignees.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
      </div>

      {inProgressCount > 5 && (
        <Alert
          variant="warning"
          title={t('issues.warningTitle')}
          message={t('issues.warningMessage', { count: inProgressCount })}
        />
      )}

      {filteredIssues.length > 0 ? (
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <Link key={issue.id} to={`/issues/${issue.id}`} className="group">
              <Card hoverable>
                <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">{issue.identifier}</p>
                    <h3 className="font-semibold text-slate-100 group-hover:text-sky-400 transition-colors truncate">
                      {issue.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDate(issue.created_at)}</span>
                      <span>•</span>
                      <span>
                        {issue.assigned_to
                          ? t('issues.assignedToValue', { assignee: issue.assigned_to })
                          : t('issues.unassigned')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={priorityBadgeVariant(issue.priority)}>
                      {t('issues.priorityValue', { priority: priorityLabel(issue.priority, t) })}
                    </Badge>
                    <Badge variant={statusBadgeVariants[issue.status] ?? 'default'}>
                      {statusLabels[issue.status] ?? issue.status}
                    </Badge>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="□"
          title={t('issues.noMatchingIssues')}
          description={t('issues.noMatchingIssuesDescription')}
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>{t('issues.newIssue')}</Button>}
        />
      )}
    </div>
  );
}
