import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { type AgentType } from '@maestro/shared';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, LoadingSpinner } from '../../components/ui';

interface AgentDetail {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  type: AgentType;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_heartbeat_at?: string | null;
}

interface HeartbeatRun {
  id: string;
  agent_id: string;
  started_at: string;
  ended_at?: string | null;
  status: string;
  result_summary?: unknown;
  token_usage?: unknown;
}

const agentTypeLabels: Record<AgentType, string> = {
  claude_local: 'Claude Local',
  claude_api: 'Claude API',
  codex_local: 'Codex Local',
  cursor: 'Cursor',
  gemini_local: 'Gemini (APIキー必須・有料)',
  openclaw_gateway: 'OpenClaw Gateway',
  opencode_local: 'OpenCode Local',
  pi_local: 'PI Local',
};

function heartbeatBadge(
  agent: AgentDetail | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!agent) return { label: t('agents.unknown'), variant: 'default' as const };
  if (!agent.enabled) return { label: t('agents.stopped'), variant: 'default' as const };
  if (!agent.last_heartbeat_at) return { label: t('agents.notReceived'), variant: 'warning' as const };

  const ageMinutes = (Date.now() - new Date(agent.last_heartbeat_at).getTime()) / 60000;
  return ageMinutes <= 10
    ? { label: t('agents.online'), variant: 'success' as const }
    : { label: t('agents.stalled'), variant: 'warning' as const };
}

export default function AgentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: agent, isLoading, error } = useQuery<AgentDetail>(
    ['agent', id],
    () => api.get(`/agents/${id}`).then((r) => r.data.data),
    { enabled: !!id },
  );

  const {
    data: runs,
    isLoading: runsLoading,
    error: runsError,
  } = useQuery<HeartbeatRun[]>(
    ['agent-runs', id],
    () => api.get(`/agents/${id}/runs`).then((r) => r.data.data),
    { enabled: !!id },
  );

  const toggleEnabled = useMutation(
    (enabled: boolean) => api.patch(`/agents/${id}`, { enabled }).then((r) => r.data.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['agent', id]);
        queryClient.invalidateQueries('agents');
      },
    },
  );

  const deleteAgent = useMutation(
    () => api.delete(`/agents/${id}`).then((r) => r.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('agents');
        navigate('/agents');
      },
    },
  );

  if (isLoading) return <div className="p-6"><LoadingSpinner text={t('agents.detailLoading')} /></div>;
  if (error || !agent) return <div className="p-6"><Alert variant="danger" message={t('agents.notFound')} /></div>;

  const heartbeat = heartbeatBadge(agent, t);
  const configEntries = Object.entries(agent.config ?? {});

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={heartbeat.variant}>{heartbeat.label}</Badge>
            <Badge variant={agent.enabled ? 'info' : 'default'}>
              {agent.enabled ? t('agents.enabled') : t('agents.disabled')}
            </Badge>
          </div>
          <div>
            <h1 className="text-4xl font-bold gradient-text">
              {agent.name}
            </h1>
            <p className="mt-2 text-th-text-3">{agentTypeLabels[agent.type] ?? agent.type}</p>
          </div>
          {agent.description && <p className="max-w-3xl text-th-text-2">{agent.description}</p>}
        </div>

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <button
            onClick={() => toggleEnabled.mutate(!agent.enabled)}
            disabled={toggleEnabled.isLoading}
            className={`px-4 py-2 rounded-th-md text-sm font-medium transition-colors disabled:opacity-50 ${
              agent.enabled
                ? 'bg-th-surface-1 hover:bg-th-surface-2 text-th-text-2'
                : 'bg-th-accent hover:bg-th-accent/80 text-th-text'
            }`}
          >
            {toggleEnabled.isLoading
              ? '...'
              : agent.enabled
              ? t('agents.disable')
              : t('agents.enable')}
          </button>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 rounded-th-md text-sm font-medium bg-th-surface-1 hover:bg-th-danger-dim text-th-text-2 hover:text-th-danger transition-colors"
            >
              {t('agents.delete')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => deleteAgent.mutate()}
                disabled={deleteAgent.isLoading}
                className="px-4 py-2 rounded-th-md text-sm font-medium bg-th-danger hover:bg-th-danger/80 text-th-text transition-colors disabled:opacity-50"
              >
                {deleteAgent.isLoading ? '...' : t('agents.confirmDelete')}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 rounded-th-md text-sm font-medium bg-th-surface-1 hover:bg-th-surface-2 text-th-text-2 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {(toggleEnabled.isError || deleteAgent.isError) && (
        <Alert variant="danger" message={t('common.error')} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <h2 className="text-xl font-bold">{t('agents.basicInfo')}</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-th border border-th-border bg-th-surface-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-th-text-4">{t('agents.agentId')}</p>
              <p className="mt-2 break-all text-th-text-2">{agent.id}</p>
            </div>
            <div className="rounded-th border border-th-border bg-th-surface-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-th-text-4">{t('agents.agentType')}</p>
              <p className="mt-2 text-th-text-2">{agentTypeLabels[agent.type] ?? agent.type}</p>
            </div>
            <div className="rounded-th border border-th-border bg-th-surface-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-th-text-4">{t('common.createdAt')}</p>
              <p className="mt-2 text-th-text-2">{formatDate(agent.created_at)}</p>
            </div>
            <div className="rounded-th border border-th-border bg-th-surface-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-th-text-4">{t('common.updatedAt')}</p>
              <p className="mt-2 text-th-text-2">{formatDate(agent.updated_at)}</p>
            </div>
            <div className="rounded-th border border-th-border bg-th-surface-1 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-th-text-4">{t('agents.lastHeartbeat')}</p>
              <p className="mt-2 text-th-text-2">{agent.last_heartbeat_at ? formatDate(agent.last_heartbeat_at) : t('agents.notReceived')}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">{t('agents.config')}</h2>
          </CardHeader>
          <CardBody>
            {configEntries.length > 0 ? (
              <pre className="overflow-auto rounded-th border border-th-border bg-th-surface-1 p-4 text-xs text-th-text-2">
                {JSON.stringify(agent.config, null, 2)}
              </pre>
            ) : (
              <EmptyState
                icon="{}"
                title={t('agents.noConfigTitle')}
                description={t('agents.noConfigDescription')}
                className="py-8"
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">{t('agents.recentRuns')}</h2>
        </CardHeader>
        <CardBody>
          {runsLoading ? (
            <LoadingSpinner text={t('agents.runsLoading')} />
          ) : runsError ? (
            <Alert variant="danger" message={t('agents.runsFetchError')} />
          ) : runs && runs.length > 0 ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col gap-3 rounded-th border border-th-border bg-th-surface-1 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-th-text">{run.id}</p>
                    <p className="mt-1 text-xs text-th-text-4">{t('agents.runStartedAt', { value: formatDate(run.started_at) })}</p>
                    <p className="mt-1 text-xs text-th-text-4">{t('agents.runEndedAt', { value: run.ended_at ? formatDate(run.ended_at) : t('agents.runInProgress') })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={run.status === 'completed' ? 'success' : run.status === 'running' ? 'info' : 'warning'}>
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="□"
              title={t('agents.noRunsTitle')}
              description={t('agents.noRunsDescription')}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
