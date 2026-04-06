import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { type AgentType } from '@maestro/shared';
import { useTranslation } from '@maestro/i18n';
import type { AxiosError } from 'axios';
import { Bot, Cloud, FileText, MousePointer, Gem, Server, Code2, Cpu } from 'lucide-react';
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
  gemini_local: 'Gemini',
  openclaw_gateway: 'OpenClaw Gateway',
  opencode_local: 'OpenCode Local',
  pi_local: 'PI Local',
};

const agentTypeIcons: Record<AgentType, React.ReactNode> = {
  claude_local: <Bot className="h-6 w-6 text-th-accent" />,
  claude_api: <Cloud className="h-6 w-6 text-th-accent" />,
  codex_local: <FileText className="h-6 w-6 text-th-accent" />,
  cursor: <MousePointer className="h-6 w-6 text-th-accent" />,
  gemini_local: <Gem className="h-6 w-6 text-th-accent" />,
  openclaw_gateway: <Server className="h-6 w-6 text-th-accent" />,
  opencode_local: <Code2 className="h-6 w-6 text-th-accent" />,
  pi_local: <Cpu className="h-6 w-6 text-th-accent" />,
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

function getHeartbeatStatus(agent: Agent) {
  if (!agent.enabled) {
    return { label: '停止中', badge: 'default' as const, dot: 'bg-th-text-4' };
  }
  if (!agent.last_heartbeat_at) {
    return { label: '接続待ち', badge: 'warning' as const, dot: 'bg-th-warning' };
  }
  const ageMinutes = (Date.now() - new Date(agent.last_heartbeat_at).getTime()) / 60000;
  if (ageMinutes <= 10) {
    return { label: 'オンライン', badge: 'success' as const, dot: 'bg-th-success' };
  }
  return { label: '応答なし', badge: 'warning' as const, dot: 'bg-th-warning' };
}

function extractWorkDir(agent: Agent): string | null {
  if (agent.description) {
    const match = agent.description.match(/\/[\w/.+-]+/);
    if (match) return match[0];
  }
  return null;
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

  const enabledAgents = (agents ?? []).filter((a) => a.enabled).length;
  const onlineAgents = (agents ?? []).filter((a) => getHeartbeatStatus(a).label === 'オンライン').length;

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
      } = { name: newName.trim(), type: newType };
      if (newDescription.trim()) payload.description = newDescription.trim();
      if (newType === 'claude_api') payload.config = { apiKey: newApiKey.trim() };

      const response = await api.post<CreateAgentResponse>('/agents', payload);
      setIssuedAgentKey(response.data.agentApiKey);
      setNewName('');
      setNewType('claude_local');
      setNewDescription('');
      setNewApiKey('');
      setShowCreate(false);
      await queryClient.invalidateQueries('agents');
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setCreateError(axiosErr.response?.data?.message ?? t('agents.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner text={t('agents.loading')} /></div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-th-text">{t('agents.title')}</h1>
        <Alert variant="danger" message={t('agents.fetchError')} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold gradient-text">
            {t('agents.title')}
          </h1>
          <p className="text-th-text-3 max-w-xl">
            Claude Code、Codex、Cursor などの AI エージェントインスタンスを登録・監視します。
            各エージェントは heartbeat で接続状態を報告します。
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => { setCreateError(null); setShowCreate(true); }}
        >
          {t('agents.newAgent')}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-th border border-th-border bg-th-surface-1 p-4 text-center shadow-th">
          <p className="text-2xl font-bold text-th-text">{agents?.length ?? 0}</p>
          <p className="text-xs text-th-text-3 mt-1">登録済み</p>
        </div>
        <div className="rounded-th border border-th-border bg-th-surface-1 p-4 text-center shadow-th">
          <p className="text-2xl font-bold text-th-success">{enabledAgents}</p>
          <p className="text-xs text-th-text-3 mt-1">有効</p>
        </div>
        <div className="rounded-th border border-th-border bg-th-surface-1 p-4 text-center shadow-th">
          <p className="text-2xl font-bold text-th-accent">{onlineAgents}</p>
          <p className="text-xs text-th-text-3 mt-1">オンライン</p>
        </div>
      </div>

      {/* Alerts */}
      {issuedAgentKey && (
        <Alert
          variant="success"
          title={t('agents.createdTitle')}
          message={t('agents.issuedApiKey', { key: issuedAgentKey })}
          onClose={() => setIssuedAgentKey(null)}
        />
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-th-text">{t('agents.createTitle')}</h2>
                <p className="text-sm text-th-text-3">{t('agents.createDescription')}</p>
              </div>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError(null); }}>
                {t('common.close')}
              </Button>
            </div>

            {createError && <Alert variant="danger" message={createError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-sm text-th-text-2">{t('agents.agentName')}</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('agents.namePlaceholder')}
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text focus:border-th-accent focus:outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-th-text-2">{t('agents.agentType')}</span>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AgentType)}
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text focus:border-th-accent focus:outline-none"
                >
                  {agentTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {agentTypeLabels[type]}
                    </option>
                  ))}
                </select>
                {newType === 'gemini_local' && (
                  <p className="text-xs text-th-warning mt-1">{t('agents.geminiApiKeyNote')}</p>
                )}
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-sm text-th-text-2">{t('common.description')}</span>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('agents.descriptionPlaceholder')}
                rows={3}
                className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text focus:border-th-accent focus:outline-none"
              />
            </label>

            {newType === 'claude_api' && (
              <label className="space-y-2 block">
                <span className="text-sm text-th-text-2">{t('agents.anthropicApiKey')}</span>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2.5 text-sm text-th-text focus:border-th-accent focus:outline-none"
                />
                <p className="text-xs text-th-text-4">{t('agents.apiKeyRequired')}</p>
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
              <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateError(null); }}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Agent list */}
      {agents && agents.length > 0 ? (
        <div className="space-y-3">
          {agents.map((agent) => {
            const status = getHeartbeatStatus(agent);
            const workDir = extractWorkDir(agent);

            return (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="group block">
                <div className="rounded-th border border-th-border bg-th-surface-1 p-5 transition-all hover:border-th-accent/50 hover:bg-th-surface-2 shadow-th">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: icon + info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 rounded-th-md bg-th-surface-2 flex items-center justify-center">
                        {agentTypeIcons[agent.type] ?? <Bot className="h-6 w-6 text-th-accent" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-th-text group-hover:text-th-accent transition-colors truncate">
                            {agent.name}
                          </h3>
                          <Badge variant={agent.enabled ? 'info' : 'default'}>
                            {agent.enabled ? '有効' : '無効'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-th-text-3 flex-wrap">
                          <span>{agentTypeLabels[agent.type]}</span>
                          {(agent.config?.working_directory || workDir) && (
                            <>
                              <span className="text-th-text-4">|</span>
                              <span className="truncate font-mono text-xs">
                                {(agent.config?.working_directory as string) || workDir}
                              </span>
                            </>
                          )}
                          {!!agent.config?.model && (
                            <>
                              <span className="text-th-text-4">|</span>
                              <span className="text-xs text-th-accent">{String(agent.config.model)}</span>
                            </>
                          )}
                        </div>
                        {!!agent.config?.current_task && (
                          <div className="mt-1 text-xs text-th-text-4 truncate pl-0">
                            <span className="text-th-text-4">実行中: </span>
                            <span className="font-mono">{String(agent.config.current_task)}</span>
                          </div>
                        )}
                        {agent.config?.tool_count !== undefined && (
                          <div className="mt-1 flex items-center gap-3 text-xs text-th-text-4">
                            <span>ツール呼び出し: {Number(agent.config.tool_count)} 回</span>
                            {!!agent.config?.current_tool && (
                              <span>最終ツール: <span className="text-th-text-3">{String(agent.config.current_tool)}</span></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: status + date */}
                    <div className="flex-shrink-0 flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                          <span className="text-sm font-medium text-th-text-2">{status.label}</span>
                        </div>
                        <p className="text-xs text-th-text-4 mt-1">
                          {agent.last_heartbeat_at
                            ? `最終応答: ${formatDate(agent.last_heartbeat_at)}`
                            : `登録日: ${formatDate(agent.created_at)}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {agent.description && (
                    <p className="mt-3 text-sm text-th-text-3 line-clamp-1 pl-16">
                      {agent.description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="🤖"
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
