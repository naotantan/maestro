import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { Activity, Bot, ClipboardList, Loader2, Send, Square, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '@maestro/i18n';
import api from '../lib/api.ts';
import { formatDate } from '../lib/date.ts';
import {
  Card,
  CardBody,
  CardHeader,
  LoadingSpinner,
  EmptyState,
  Alert,
} from '../components/ui';

interface SkillUsageStat {
  name: string;
  count: number;
}

function SkillUsageChart({ period }: { period: '24h' | '7d' }) {
  const label = period === '24h' ? '過去24時間' : '過去1週間';
  const refetchInterval = period === '24h' ? 10 * 60 * 1000 : 3 * 60 * 60 * 1000;

  const { data, isLoading } = useQuery<{ data: SkillUsageStat[] }>(
    ['skillUsageStats', period],
    () => api.get(`/plugins/usage-stats?period=${period}`).then(r => r.data),
    { refetchInterval, staleTime: refetchInterval / 2 },
  );

  const stats = data?.data ?? [];
  const maxCount = Math.max(...stats.map(s => s.count), 1);

  return (
    <Card>
      <CardBody className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-th-text">{label} スキル使用 Top10</h3>
          <span className="text-[10px] text-th-text-4">
            {period === '24h' ? '10分更新' : '3時間更新'}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 rounded bg-th-surface-2 flex-1 animate-pulse" style={{ width: `${60 + i * 8}%` }} />
              </div>
            ))}
          </div>
        ) : stats.length === 0 ? (
          <p className="text-xs text-th-text-4 py-4 text-center">この期間にスキル使用の記録がありません</p>
        ) : (
          <div className="space-y-1.5">
            {stats.map((stat, i) => {
              const pct = Math.round((stat.count / maxCount) * 100);
              return (
                <div key={stat.name} className="flex items-center gap-2 group">
                  <span className="text-[10px] text-th-text-4 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-th-text truncate max-w-[80%]" title={stat.name}>
                        {stat.name}
                      </span>
                      <span className="text-xs font-bold text-th-accent flex-shrink-0 ml-1">{stat.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-th-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-th-accent transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// GET /api/agents のレスポンス型
interface Agent {
  id: string;
  company_id: string;
  name: string;
  type: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_heartbeat_at?: string;
}

// GET /api/issues のレスポンス型
interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
}

// GET /api/activity のレスポンス型
interface ActivityLog {
  id: string;
  company_id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  updated_fields?: string[] | null;
  action: string;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = { create: '作成', update: '更新', delete: '削除' };
const ACTION_STYLE: Record<string, string> = {
  create: 'bg-th-success-dim text-th-success',
  update: 'bg-th-accent-dim text-th-accent',
  delete: 'bg-th-danger-dim text-th-danger',
};
const ENTITY_LABEL: Record<string, string> = {
  issue: '課題', goal: 'ゴール', project: 'プロジェクト',
  agent: 'エージェント', routine: 'ルーティン', plugin: 'スキル',
  memory: 'メモリ', approval: '承認',
};

function formatActivityMessage(activity: ActivityLog): string {
  const entity = ENTITY_LABEL[activity.entity_type] ?? activity.entity_type;
  const action = ACTION_LABEL[activity.action] ?? activity.action;
  const name = activity.entity_name;

  if (!name) {
    // entity_nameがない場合（sync操作など）
    if (activity.action === 'create' && activity.entity_type === 'plugin') {
      return `スキルの一括同期を実行`;
    }
    return `${entity}を${action}`;
  }

  if (activity.action === 'create') {
    return `${entity}「${name}」を${action}`;
  }
  if (activity.action === 'update' && activity.updated_fields?.length) {
    return `${entity}「${name}」の ${activity.updated_fields.join(', ')} を更新`;
  }
  if (activity.action === 'delete') {
    return `${entity}「${name}」を${action}`;
  }
  return `${entity}「${name}」を${action}`;
}

// AgentType → 表示名
const AGENT_TYPE_LABEL: Record<string, string> = {
  claude_local:      'Claude Code',
  claude_api:        'Claude API',
  codex_local:       'Codex',
  cursor:            'Cursor',
  gemini_local:      'Gemini',
  openclaw_gateway:  'OpenClaw',
  opencode_local:    'OpenCode',
  pi_local:          'Pi',
};

// APIベースかどうか
const IS_API_TYPE = new Set(['claude_api', 'openclaw_gateway']);

/** 稼働中スキルをtype別にグループ化して表示 */
function ActiveSkillsByType({ agents }: { agents: Agent[] }) {
  // type ごとに集計
  const groups: Record<string, { count: number; isApi: boolean }> = {};
  for (const a of agents) {
    const typeKey = a.type ?? 'unknown';
    if (!groups[typeKey]) {
      groups[typeKey] = { count: 0, isApi: IS_API_TYPE.has(typeKey) };
    }
    groups[typeKey].count++;
  }
  const entries = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-2">
      {entries.map(([typeKey, { count, isApi }]) => (
        <div key={typeKey} className="flex items-center gap-2">
          <span className="text-xs text-th-text flex-1 truncate">
            {AGENT_TYPE_LABEL[typeKey] ?? typeKey}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-th-sm flex-shrink-0 whitespace-nowrap ${
            isApi ? 'bg-th-accent-dim text-th-accent' : 'bg-th-surface-2 text-th-text-3'
          }`}>
            {isApi ? 'API' : 'サブスク'}
          </span>
          <span className="text-xs font-bold text-th-accent w-4 text-right flex-shrink-0">{count}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  detail,
  to,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  detail: string;
  color?: string;
  to?: string;
}) {
  const content = (
    <CardBody className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="mb-1 text-sm font-medium text-th-text-3">{label}</p>
        <p className="text-4xl font-bold gradient-text">
          {value}
        </p>
        <p className="mt-2 text-xs text-th-text-4">{detail}</p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-th border border-th-border bg-th-surface-1 text-th-text-4">
        {icon}
      </span>
    </CardBody>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        <Card hoverable>{content}</Card>
      </Link>
    );
  }

  return <Card hoverable>{content}</Card>;
}

interface Job {
  id: string;
  prompt: string;
  status: string;
  result: string | null;
  error_message: string | null;
  created_at: string;
}

function JobPanel() {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: recentJobs = [] } = useQuery<Job[]>(
    'jobs',
    () => api.get('/jobs?limit=5').then(r => r.data.data),
    { refetchInterval: 5000 },
  );

  const handleSend = async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    setJobError(null);
    try {
      await api.post('/jobs', { prompt: prompt.trim() });
      setPrompt('');
      queryClient.invalidateQueries('jobs');
    } catch {
      setJobError('指示の送信に失敗しました。再度お試しください。');
    } finally {
      setSending(false);
    }
  };

  const handleStop = async (jobId: string) => {
    try {
      await api.patch(`/jobs/${jobId}`, { status: 'cancelled' });
      queryClient.invalidateQueries('jobs');
    } catch {
      setJobError('ジョブの停止に失敗しました。');
    }
  };

  const activeJob = recentJobs.find(j => j.status === 'pending' || j.status === 'running');

  return (
    <Card>
      <CardBody className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-th-text">Claudeに指示</h2>

        {jobError && <Alert variant="danger" message={jobError} onClose={() => setJobError(null)} />}

        {/* 入力 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="指示を入力..."
            disabled={sending || !!activeJob}
            className="flex-1 bg-th-surface-1 border border-th-border rounded-th-md px-3 py-2 text-sm text-th-text placeholder-th-text-4 focus:outline-none focus:border-th-accent disabled:opacity-50"
          />
          {activeJob ? (
            <button
              onClick={() => handleStop(activeJob.id)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-th-md border border-th-danger/30 bg-th-danger-dim px-4 py-2 text-sm font-medium text-th-danger hover:opacity-80 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || sending}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-th-md border border-th-accent/30 bg-th-accent-dim px-4 py-2 text-sm font-medium text-th-accent hover:opacity-80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              送信
            </button>
          )}
        </div>

        {/* 直近のジョブ */}
        {recentJobs.length > 0 && (
          <div className="space-y-2">
            {recentJobs.slice(0, 3).map(job => (
              <div key={job.id} className="rounded-th-md border border-th-border bg-th-surface-1 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-th-text-2 truncate flex-1">{job.prompt}</p>
                  <span className={clsx(
                    'shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5',
                    job.status === 'done' && 'bg-th-success-dim text-th-success',
                    job.status === 'running' && 'bg-th-accent-dim text-th-accent',
                    job.status === 'pending' && 'bg-th-warning-dim text-th-warning',
                    job.status === 'error' && 'bg-th-danger-dim text-th-danger',
                    job.status === 'cancelled' && 'bg-th-surface-2 text-th-text-4',
                  )}>
                    {job.status === 'running' && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                    {job.status}
                  </span>
                </div>
                {job.result && (
                  <div className="mt-2 rounded-th-sm bg-th-surface-0 border border-th-border px-2.5 py-2">
                    <p className="text-xs text-th-text-3 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{job.result}</p>
                  </div>
                )}
                {job.error_message && (
                  <p className="mt-1 text-xs text-th-danger">{job.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();

  // D-1修正: 存在しないエンドポイントを廃止し、既存APIを個別に呼び出す
  // D-3修正: r.data → r.data.data

  // 稼働中エージェント数
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useQuery<Agent[]>(
    'agents',
    () => api.get('/agents').then((r) => r.data.data),
  );

  // 未完了Issue数
  const { data: issues, isLoading: issuesLoading, error: issuesError } = useQuery<Issue[]>(
    'issues',
    () => api.get('/issues').then((r) => r.data.data),
  );

  // 最近のアクティビティ（直近5件）
  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useQuery<ActivityLog[]>(
    'activity',
    () => api.get('/activity', { params: { limit: 5 } }).then((r) => r.data.data),
  );

  // D-5修正: enabled === true のエージェント数をカウント
  const agentCount = (agents ?? []).filter((a) => a.enabled).length;

  // D-6修正: status !== 'done' の未完了Issue数をカウント
  const openIssues = (issues ?? []).filter((i) => i.status !== 'done').length;

  const isLoading = agentsLoading || issuesLoading || activitiesLoading;
  const hasError = agentsError || issuesError || activitiesError;

  if (isLoading)
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold gradient-text">
            {t('dashboard.title')}
          </h1>
          <p className="max-w-2xl text-th-text-3">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardBody className="space-y-3 p-4">
                <div className="h-4 w-24 rounded-th-sm bg-th-surface-2" />
                <div className="h-10 w-16 rounded-th-sm bg-th-surface-1" />
                <div className="h-3 w-32 rounded-th-sm bg-th-surface-1" />
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody className="py-16">
            <LoadingSpinner text={t('dashboard.loading')} />
          </CardBody>
        </Card>
      </div>
    );

  if (hasError)
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold gradient-text">
            {t('dashboard.title')}
          </h1>
          <p className="max-w-2xl text-th-text-3">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4 p-6">
            <Alert
              variant="danger"
              title={t('dashboard.loadFailed')}
              message={t('dashboard.loadFailedMessage')}
            />
            <p className="text-sm text-th-text-4">
              {t('dashboard.loadFailedScope')}
            </p>
          </CardBody>
        </Card>
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold gradient-text">
          {t('dashboard.title')}
        </h1>
        <p className="max-w-2xl text-th-text-3">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 稼働中スキル: 部署別グループ表示 */}
        <div className="bg-th-surface-1 rounded-th p-4 border border-th-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-th-text-3">稼働中のスキル</span>
            <span className="bg-th-surface-2 rounded-full p-1.5 text-th-text-3"><Bot className="h-4 w-4" /></span>
          </div>
          {agentCount === 0 ? (
            <p className="text-xs text-th-text-4">稼働中のスキルなし</p>
          ) : (
            <ActiveSkillsByType agents={(agents ?? []).filter(a => a.enabled)} />
          )}
        </div>
        <StatCard
          label={t('dashboard.incompleteIssues')}
          value={openIssues}
          icon={<ClipboardList className="h-5 w-5" />}
          detail={t('dashboard.incompleteIssuesDetail')}
          color="orange"
          to="/issues"
        />
        <StatCard
          label={t('dashboard.systemStatus')}
          value={t('dashboard.systemStatusNormal')}
          icon={<Zap className="h-5 w-5" />}
          detail={t('dashboard.systemStatusDetail')}
          color="emerald"
        />
      </div>

      {/* Claudeに指示 */}
      <JobPanel />

      {/* スキル使用頻度 Top10 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkillUsageChart period="24h" />
        <SkillUsageChart period="7d" />
      </div>

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-th-text">{t('dashboard.recentActivity')}</h2>
        </CardHeader>
        <CardBody>
          {(activities ?? []).length > 0 ? (
            <div className="space-y-3">
              {(activities ?? []).slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 rounded-th-md p-3 transition-colors hover:bg-th-surface-1"
                >
                  <span className={`flex-shrink-0 inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-th-sm text-xs font-medium whitespace-nowrap ${ACTION_STYLE[activity.action] ?? 'bg-th-surface-2 text-th-text-2'}`}>
                    {ACTION_LABEL[activity.action] ?? activity.action}
                  </span>
                  <span className="text-sm text-th-text flex-1 min-w-0 truncate">
                    {formatActivityMessage(activity)}
                  </span>
                  <span className="text-xs text-th-text-4 flex-shrink-0">{formatDate(activity.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Activity className="h-10 w-10" />}
              title={t('dashboard.noActivityTitle')}
              description={t('dashboard.noActivityDescription')}
            />
          )}
        </CardBody>
      </Card>

    </div>
  );
}
