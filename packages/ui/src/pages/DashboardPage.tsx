import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Bot, ClipboardList, ShieldCheck, Zap } from 'lucide-react';
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

// GET /api/approvals のレスポンス型
interface Approval {
  id: string;
  issue_id: string;
  approver_id: string;
  status: string;
  created_at: string;
  decided_at?: string;
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
const ENTITY_LABEL: Record<string, string> = {
  issue: '課題', goal: 'ゴール', project: 'プロジェクト',
  agent: 'エージェント', routine: 'ルーティン', plugin: 'プラグイン',
};

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
          <span className="text-xs text-slate-200 flex-1 truncate">
            {AGENT_TYPE_LABEL[typeKey] ?? typeKey}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
            isApi ? 'bg-violet-900 text-violet-300' : 'bg-sky-950 text-sky-400'
          }`}>
            {isApi ? 'API' : 'サブスク'}
          </span>
          <span className="text-xs font-bold text-sky-400 w-4 text-right flex-shrink-0">{count}</span>
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
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  detail: string;
  color: 'sky' | 'orange' | 'red' | 'emerald';
}) {
  const colorMap = {
    sky: 'from-sky-600 to-sky-700 text-sky-100',
    orange: 'from-orange-600 to-orange-700 text-orange-100',
    red: 'from-red-600 to-red-700 text-red-100',
    emerald: 'from-emerald-600 to-emerald-700 text-emerald-100',
  };

  return (
    <Card hoverable>
      <CardBody className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-slate-400">{label}</p>
          <p className={`text-4xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
          {icon}
        </span>
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

  // 承認待ち一覧
  const { data: approvals, isLoading: approvalsLoading, error: approvalsError } = useQuery<Approval[]>(
    'approvals-pending',
    () => api.get('/approvals', { params: { status: 'pending' } }).then((r) => r.data.data),
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

  // 承認待ち件数
  const pendingApprovals = (approvals ?? []).length;

  const isLoading = agentsLoading || issuesLoading || approvalsLoading || activitiesLoading;
  const hasError = agentsError || issuesError || approvalsError || activitiesError;

  if (isLoading)
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            {t('dashboard.title')}
          </h1>
          <p className="max-w-2xl text-slate-400">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardBody className="space-y-3 p-4">
                <div className="h-4 w-24 rounded bg-slate-700/80" />
                <div className="h-10 w-16 rounded bg-slate-800" />
                <div className="h-3 w-32 rounded bg-slate-800" />
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
            {t('dashboard.title')}
          </h1>
          <p className="max-w-2xl text-slate-400">
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
            <p className="text-sm text-slate-500">
              {t('dashboard.loadFailedScope')}
            </p>
          </CardBody>
        </Card>
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
          {t('dashboard.title')}
        </h1>
        <p className="max-w-2xl text-slate-400">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 稼働中スキル: 部署別グループ表示 */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">稼働中のスキル</span>
            <span className="bg-slate-700 rounded-full p-1.5 text-slate-400"><Bot className="h-4 w-4" /></span>
          </div>
          {agentCount === 0 ? (
            <p className="text-xs text-slate-500">稼働中のスキルなし</p>
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
        />
        <StatCard
          label={t('dashboard.pendingApprovals')}
          value={pendingApprovals}
          icon={<ShieldCheck className="h-5 w-5" />}
          detail={t('dashboard.pendingApprovalsDetail')}
          color="red"
        />
        <StatCard
          label={t('dashboard.systemStatus')}
          value={t('dashboard.systemStatusNormal')}
          icon={<Zap className="h-5 w-5" />}
          detail={t('dashboard.systemStatusDetail')}
          color="emerald"
        />
      </div>

      {/* 承認待ちアラート */}
      {pendingApprovals > 0 && (
        <Alert
          variant="warning"
          title={t('dashboard.pendingAlertTitle')}
          message={t('dashboard.pendingAlertMessage', { count: pendingApprovals })}
        />
      )}

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">{t('dashboard.recentActivity')}</h2>
        </CardHeader>
        <CardBody>
          {(activities ?? []).length > 0 ? (
            <div className="space-y-3">
              {(activities ?? []).slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex flex-col gap-2 rounded-lg p-3 transition-colors hover:bg-slate-700/30 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="flex-shrink-0 inline-block min-w-[3rem] text-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-slate-700 text-slate-300">
                      {ACTION_LABEL[activity.action] ?? activity.action}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {ENTITY_LABEL[activity.entity_type] ?? activity.entity_type}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-slate-200 truncate">
                        {activity.entity_name ?? activity.entity_id ?? '—'}
                      </span>
                      {activity.updated_fields && activity.updated_fields.length > 0 && (
                        <span className="text-xs text-slate-500 truncate">
                          {activity.updated_fields.join(', ')} を変更
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(activity.created_at)}</span>
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

      {/* クイックアクション */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">{t('dashboard.quickActions')}</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
          >
            <span>{t('dashboard.manageAgents')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/issues"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600"
          >
            <span>{t('dashboard.viewIssues')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/approvals"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600"
          >
            <span>{t('dashboard.viewApprovals')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
