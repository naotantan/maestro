import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { type AgentType } from '@company/shared';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Button, Card, CardBody, Badge, LoadingSpinner, EmptyState, Alert } from '../../components/ui';

interface Agent {
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

interface CreateAgentResponse {
  data: Agent;
  agentApiKey: string;
}

const agentTypeLabels: Record<AgentType, string> = {
  claude_local: 'Claude Local',
  claude_api: 'Claude API',
  codex_local: 'Codex Local',
  cursor: 'Cursor',
  gemini_local: 'Gemini Local',
  openclaw_gateway: 'OpenClaw Gateway',
  opencode_local: 'OpenCode Local',
  pi_local: 'PI Local',
};

const agentTypeOptions: AgentType[] = [
  'claude_local',
  'claude_api',
  'codex_local',
  'cursor',
  'gemini_local',
  'openclaw_gateway',
  'opencode_local',
  'pi_local',
];

function getHeartbeatStatus(agent: Agent, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!agent.enabled) {
    return { label: t('agents.stopped'), badge: 'default' as const, tone: 'text-slate-500' };
  }

  if (!agent.last_heartbeat_at) {
    return { label: t('agents.notReceived'), badge: 'warning' as const, tone: 'text-amber-400' };
  }

  const lastHeartbeat = new Date(agent.last_heartbeat_at).getTime();
  const ageMinutes = (Date.now() - lastHeartbeat) / 60000;

  if (ageMinutes <= 10) {
    return { label: t('agents.online'), badge: 'success' as const, tone: 'text-emerald-400' };
  }

  return { label: t('agents.stalled'), badge: 'warning' as const, tone: 'text-amber-400' };
}

export default function AgentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AgentType>('claude_local');
  const [newDescription, setNewDescription] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [issuedAgentKey, setIssuedAgentKey] = useState<string | null>(null);

  const { data: agents, isLoading, error } = useQuery<Agent[]>(
    'agents',
    () => api.get('/agents').then((r) => r.data.data),
  );

  const enabledAgents = (agents ?? []).filter((agent) => agent.enabled).length;
  const onlineAgents = (agents ?? []).filter((agent) => getHeartbeatStatus(agent, t).label === t('agents.online')).length;

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setSubmitting(true);
    setCreateError(null);

    try {
      const payload: {
        name: string;
        type: AgentType;
        description?: string;
        config?: Record<string, unknown>;
      } = {
        name: newName.trim(),
        type: newType,
      };

      if (newDescription.trim()) {
        payload.description = newDescription.trim();
      }

      if (newType === 'claude_api') {
        payload.config = { apiKey: newApiKey.trim() };
      }

      const response = await api.post<CreateAgentResponse>('/agents', payload);
      setIssuedAgentKey(response.data.agentApiKey);
      setNewName('');
      setNewType('claude_local');
      setNewDescription('');
      setNewApiKey('');
      setShowCreate(false);
      await queryClient.invalidateQueries('agents');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? t('agents.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text={t('agents.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">{t('agents.title')}</h1>
        <Alert
          variant="danger"
          message={t('agents.fetchError')}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            {t('agents.title')}
          </h1>
          <p className="text-slate-400">
            {t('agents.summary', { enabled: enabledAgents, online: onlineAgents })}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
        >
          {t('agents.newAgent')}
        </Button>
      </div>

      {issuedAgentKey && (
        <Alert
          variant="success"
          title={t('agents.createdTitle')}
          message={t('agents.issuedApiKey', { key: issuedAgentKey })}
          onClose={() => setIssuedAgentKey(null)}
        />
      )}

      {showCreate && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('agents.createTitle')}</h2>
                <p className="text-sm text-slate-400">{t('agents.createDescription')}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                {t('common.close')}
              </Button>
            </div>

            {createError && <Alert variant="danger" message={createError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">{t('agents.agentName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('agents.namePlaceholder')}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">{t('agents.agentType')}</span>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AgentType)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                >
                  {agentTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {agentTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-sm text-slate-300">{t('common.description')}</span>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('agents.descriptionPlaceholder')}
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
              />
            </label>

            {newType === 'claude_api' && (
              <label className="space-y-2 block">
                <span className="text-sm text-slate-300">{t('agents.anthropicApiKey')}</span>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
                <p className="text-xs text-slate-500">{t('agents.apiKeyRequired')}</p>
              </label>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                loading={submitting}
                onClick={handleCreate}
                disabled={!newName.trim() || (newType === 'claude_api' && !newApiKey.trim())}
              >
                {t('common.create')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const heartbeat = getHeartbeatStatus(agent, t);
            const hasConfig = agent.config && Object.keys(agent.config).length > 0;

            return (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="group">
                <Card hoverable className="h-full">
                  <CardBody className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                          {agent.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">{agentTypeLabels[agent.type] ?? agent.type}</p>
                      </div>
                      <Badge variant={agent.enabled ? 'info' : 'default'}>
                        {agent.enabled ? t('agents.enabled') : t('agents.disabled')}
                      </Badge>
                    </div>

                    {agent.description && (
                      <p className="line-clamp-2 text-sm text-slate-300">{agent.description}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('agents.heartbeat')}</p>
                        <p className={`mt-2 font-medium ${heartbeat.tone}`}>{heartbeat.label}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('agents.config')}</p>
                        <p className="mt-2 font-medium text-slate-200">
                          {hasConfig
                            ? t('agents.configKeys', { count: Object.keys(agent.config ?? {}).length })
                            : t('common.none')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-slate-700 pt-3 text-xs text-slate-500">
                      <span>
                        {agent.last_heartbeat_at
                          ? t('agents.lastHeartbeatValue', { value: formatDate(agent.last_heartbeat_at) })
                          : t('agents.heartbeatMissing')}
                      </span>
                      <Badge variant={heartbeat.badge}>{heartbeat.label}</Badge>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="□"
          title={t('agents.emptyTitle')}
          description={t('agents.emptyDescription')}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {t('agents.createAction')}
            </Button>
          }
        />
      )}
    </div>
  );
}
