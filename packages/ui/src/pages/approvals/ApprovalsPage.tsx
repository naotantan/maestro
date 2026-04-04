import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { ArrowRight, CheckCircle2, Clock3, UserRound } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  LoadingSpinner,
} from '../../components/ui';

interface Approval {
  id: string;
  issue_id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
  decided_at?: string | null;
}

interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  assigned_to?: string | null;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
}

const statusBadgeVariants: Record<string, 'pending' | 'success' | 'danger'> = {
  pending: 'pending',
  approved: 'success',
  rejected: 'danger',
};

const issueStatusBadgeVariants: Record<string, 'default' | 'warning' | 'success'> = {
  backlog: 'default',
  in_progress: 'warning',
  done: 'success',
};

function priorityLabel(priority: number, t: (key: string, options?: Record<string, unknown>) => string) {
  if (priority >= 3) return t('issues.priorities.high');
  if (priority === 2) return t('issues.priorities.medium');
  return t('issues.priorities.low');
}

function priorityBadgeVariant(priority: number): 'danger' | 'warning' | 'default' {
  if (priority >= 3) return 'danger';
  if (priority === 2) return 'warning';
  return 'default';
}

export default function ApprovalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    pending: t('approvals.pending'),
    approved: t('approvals.approved'),
    rejected: t('approvals.rejected'),
  };

  const issueStatusLabels: Record<string, string> = {
    backlog: t('issues.status.backlog'),
    in_progress: t('issues.status.inProgress'),
    done: t('issues.status.done'),
  };

  const { data: approvals, isLoading, error } = useQuery<Approval[]>(
    ['approvals', statusFilter],
    () =>
      api
        .get('/approvals', {
          params: { status: statusFilter === 'all' ? undefined : statusFilter },
        })
        .then((r) => r.data.data),
  );

  const { data: issues, error: issuesError } = useQuery<IssueSummary[]>(
    ['issues'],
    () => api.get('/issues').then((r) => r.data.data),
  );

  const { data: members, error: membersError } = useQuery<Member[]>(
    ['org/members'],
    () => api.get('/org/members').then((r) => r.data.data),
  );

  const issueMap = new Map((issues ?? []).map((issue) => [issue.id, issue]));
  const memberMap = new Map((members ?? []).map((member) => [member.user_id, member]));

  const handleApprove = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await api.post(`/approvals/${id}/approve`);
      await queryClient.invalidateQueries('approvals');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('approvals.approveFailed'));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await api.post(`/approvals/${id}/reject`);
      await queryClient.invalidateQueries('approvals');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('approvals.rejectFailed'));
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text={t('approvals.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl space-y-4 p-6">
        <h1 className="text-3xl font-bold">{t('approvals.title')}</h1>
        <Alert variant="danger" message={t('approvals.fetchError')} />
      </div>
    );
  }

  const items = approvals ?? [];
  const pendingCount = items.filter((approval) => approval.status === 'pending').length;
  const approvedCount = items.filter((approval) => approval.status === 'approved').length;
  const rejectedCount = items.filter((approval) => approval.status === 'rejected').length;
  const hasContextWarning = Boolean(issuesError || membersError);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-4xl font-bold text-transparent">
          {t('approvals.title')}
        </h1>
        <p className="text-slate-400">
          {t('approvals.summary', {
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
          })}
        </p>
      </div>

      {actionError && <Alert variant="danger" message={actionError} onClose={() => setActionError(null)} />}

      {pendingCount > 0 && statusFilter !== 'approved' && (
        <Alert
          variant="warning"
          title={t('approvals.actionRequiredTitle')}
          message={t('approvals.actionRequiredMessage', { count: pendingCount })}
        />
      )}

      {hasContextWarning && (
        <Alert
          variant="warning"
          title={t('approvals.contextUnavailableTitle')}
          message={t('approvals.contextUnavailableMessage')}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {t('approvals.pending')}
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-100">{pendingCount}</p>
            <p className="mt-2 text-sm text-slate-400">{t('approvals.pendingCardDescription')}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {t('approvals.approved')}
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-300">{approvedCount}</p>
            <p className="mt-2 text-sm text-slate-400">{t('approvals.approvedCardDescription')}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {t('approvals.rejected')}
            </p>
            <p className="mt-3 text-3xl font-bold text-rose-300">{rejectedCount}</p>
            <p className="mt-2 text-sm text-slate-400">{t('approvals.rejectedCardDescription')}</p>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900',
              statusFilter === status ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            )}
          >
            {status === 'all' ? t('common.all') : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((approval) => {
            const issue = issueMap.get(approval.issue_id);
            const approver = memberMap.get(approval.approver_id);
            const isPending = approval.status === 'pending';

            return (
              <Card key={approval.id} hoverable>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariants[approval.status] ?? 'default'}>
                        {statusLabels[approval.status] ?? approval.status}
                      </Badge>
                      {issue?.status && (
                        <Badge variant={issueStatusBadgeVariants[issue.status] ?? 'default'}>
                          {issueStatusLabels[issue.status] ?? issue.status}
                        </Badge>
                      )}
                      {typeof issue?.priority === 'number' && (
                        <Badge variant={priorityBadgeVariant(issue.priority)}>
                          {t('issues.priorityValue', { priority: priorityLabel(issue.priority, t) })}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {t('approvals.approvalId', { id: approval.id })}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-100">
                        {issue?.title ?? t('approvals.issueUnavailable')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {issue?.identifier ?? approval.issue_id}
                      </p>
                    </div>
                  </div>

                  {issue ? (
                    <Link
                      to={`/issues/${issue.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-sky-500/40 hover:text-sky-300"
                    >
                      <span>{t('approvals.viewIssue')}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-500">
                      {t('approvals.issueUnavailable')}
                    </div>
                  )}
                </CardHeader>

                <CardBody className="space-y-4 text-sm">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('approvals.issueContext')}</p>
                      <div className="mt-3 space-y-2 text-slate-300">
                        <p>{t('approvals.issueIdentifierValue', { value: issue?.identifier ?? approval.issue_id })}</p>
                        <p>
                          {t('approvals.issueAssigneeValue', {
                            value: issue?.assigned_to ?? t('issues.unassigned'),
                          })}
                        </p>
                        <p>
                          {t('approvals.issueCreatedAtValue', {
                            value: issue?.created_at ? formatDate(issue.created_at) : t('approvals.notAvailable'),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('approvals.routing')}</p>
                      <div className="mt-3 space-y-3 text-slate-300">
                        <div className="flex items-start gap-3">
                          <UserRound className="mt-0.5 h-4 w-4 text-slate-500" />
                          <div>
                            <p>{t('approvals.approverValue', { id: approver?.user_id ?? approval.approver_id })}</p>
                            <p className="text-xs text-slate-500">
                              {approver
                                ? t('approvals.approverRoleValue', { role: approver.role })
                                : t('approvals.approverFallback')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock3 className="mt-0.5 h-4 w-4 text-slate-500" />
                          <div>
                            <p>{t('approvals.createdAtValue', { value: formatDate(approval.created_at) })}</p>
                            <p className="text-xs text-slate-500">
                              {approval.decided_at
                                ? t('approvals.decidedAtValue', { value: formatDate(approval.decided_at) })
                                : t('approvals.undecided')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <p>{t('approvals.contextNote')}</p>
                    </div>
                  </div>
                </CardBody>

                {isPending && (
                  <CardFooter className="flex flex-wrap gap-3">
                    <Button
                      variant="success"
                      size="md"
                      loading={actingId === approval.id}
                      onClick={() => handleApprove(approval.id)}
                      disabled={actingId !== null}
                    >
                      {t('approvals.approve')}
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      loading={actingId === approval.id}
                      onClick={() => handleReject(approval.id)}
                      disabled={actingId !== null}
                    >
                      {t('approvals.reject')}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon={<Clock3 className="h-10 w-10" />}
            title={statusFilter === 'pending' ? t('approvals.noApprovals') : t('approvals.noMatchingApprovals')}
            description={t('approvals.emptyDescription')}
          />
        )}
      </div>
    </div>
  );
}
