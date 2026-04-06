import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  XCircle,
  Clock,
  Loader2,
  MessageSquareText,
  Play,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Routine {
  id: string;
  number: number;
  name: string;
  description: string | null;
  prompt: string | null;
  cron_expression: string;
  enabled: boolean;
  created_at: string;
}

interface RoutineRun {
  id: string;
  routine_id: string;
  executed_at: string;
  status: string;
  result: string | null;
  error_message: string | null;
}

/** cron式を人間が読める日本語に変換 */
function cronToHuman(cron: string, lang: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;
  const isJa = lang === 'ja';

  const dayNames = isJa
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let schedule = '';

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    schedule = isJa ? '毎日' : 'Every day';
  } else if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = dayOfWeek.split(',').map(d => dayNames[Number(d)] ?? d).join(isJa ? '・' : ', ');
    schedule = isJa ? `毎週 ${days}曜日` : `Every ${days}`;
  } else if (month === '*' && dayOfWeek === '*' && dayOfMonth !== '*') {
    schedule = isJa ? `毎月 ${dayOfMonth}日` : `${dayOfMonth}th of every month`;
  } else {
    return cron;
  }

  if (hour !== '*' && min !== '*') {
    schedule += ` ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }

  return schedule;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


function RoutineCard({ routine, t }: { routine: Routine; t: (k: string, o?: Record<string, unknown>) => string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const lang = t('common.loading') === 'Loading...' ? 'en' : 'ja';

  const { data: runs, isLoading: runsLoading } = useQuery<RoutineRun[]>(
    ['routine-runs', routine.id],
    () => api.get(`/routines/${routine.id}/runs?limit=10`).then(r => r.data.data),
    { enabled: expanded },
  );

  const handleRun = async () => {
    try {
      setRunError(null);
      setIsRunning(true);
      await api.post(`/routines/${routine.id}/run`);
      queryClient.invalidateQueries(['routine-runs', routine.id]);
      setExpanded(true);
    } catch {
      setRunError(t('routines.runFailed'));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-th border border-th-border bg-th-surface-0 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded bg-th-surface-1 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-th-text-3">R-{String(routine.number).padStart(3, '0')}</span>
              <h3 className="text-base font-semibold text-th-text truncate">{routine.name}</h3>
              <span className={clsx(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                routine.enabled
                  ? 'bg-th-success-dim text-th-success border border-th-success/20'
                  : 'bg-th-surface-1 text-th-text-4 border border-th-border'
              )}>
                {routine.enabled ? t('routines.enabled') : t('routines.disabled')}
              </span>
            </div>

            {/* スケジュール */}
            <div className="mt-2 flex items-center gap-1.5 text-sm text-th-text-3">
              <Calendar className="h-3.5 w-3.5 text-th-accent" />
              <span>{cronToHuman(routine.cron_expression, lang)}</span>
              <span className="text-th-text-4 ml-1">({routine.cron_expression})</span>
            </div>

            {/* プロンプト */}
            {routine.prompt && (
              <div className="mt-3 flex items-start gap-2 rounded-th-md bg-th-surface-0 border border-th-border px-3 py-2.5">
                <MessageSquareText className="h-4 w-4 text-th-accent mt-0.5 shrink-0" />
                <p className="text-sm text-th-text-2 leading-relaxed">{routine.prompt}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className={clsx(
              'shrink-0 inline-flex items-center gap-1.5 rounded-th-md border px-3 py-2 text-sm font-medium transition-colors',
              isRunning
                ? 'border-th-border-strong bg-th-surface-0 text-th-text-4 cursor-not-allowed'
                : 'border-th-accent/30 bg-th-accent-dim text-th-accent hover:bg-th-accent/20 hover:border-th-accent/50'
            )}
          >
            {isRunning
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Play className="h-3.5 w-3.5" />}
            {isRunning ? t('routines.runStatus.running') : t('routines.runNow')}
          </button>
        </div>

        {runError && (
          <div className="mt-3">
            <Alert variant="danger" message={runError} onClose={() => setRunError(null)} />
          </div>
        )}
      </div>

      {/* 履歴トグル */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-center gap-1.5 border-t border-th-border bg-th-surface-0 px-4 py-2 text-xs font-medium text-th-text-4 transition-colors hover:bg-th-surface-1 hover:text-th-text-2"
      >
        <Clock className="h-3 w-3" />
        {expanded ? t('routines.hideRuns') : t('routines.showRuns')}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* 実行履歴 */}
      {expanded && (
        <div className="border-t border-th-border bg-th-surface-1">
          {runsLoading ? (
            <div className="px-5 py-4 text-center text-sm text-th-text-4">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-1" />
              {t('common.loading')}
            </div>
          ) : !runs || runs.filter(r => r.result || r.error_message).length === 0 ? (
            <div className="px-5 py-4 text-center text-sm text-th-text-4">
              {t('routines.noRuns')}
            </div>
          ) : (
            <div className="divide-y divide-th-border">
              {runs.filter(run => run.result || run.error_message).map(run => (
                <div key={run.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 text-xs text-th-text-3">
                    <span>{formatDate(run.executed_at)}</span>
                  </div>
                  {run.status === 'error' && run.error_message && (
                    <div className="mt-2 flex items-start gap-2 rounded-th-md bg-th-danger-dim border border-th-danger/20 px-3 py-2.5">
                      <XCircle className="h-4 w-4 text-th-danger mt-0.5 shrink-0" />
                      <p className="text-sm text-th-danger">{run.error_message}</p>
                    </div>
                  )}
                  {run.result && (
                    <div className="mt-2 rounded-th-md bg-th-surface-0 border border-th-border px-3 py-2.5">
                      <p className="text-sm text-th-text-2 whitespace-pre-wrap leading-relaxed">{run.result}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutinesPage() {
  const { t } = useTranslation();
  const { data: routines, isLoading, error } = useQuery<Routine[]>(
    'routines',
    () => api.get('/routines').then(r => r.data.data),
  );

  if (isLoading) return <LoadingSpinner text={t('routines.loading')} />;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('routines.loadError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('routines.title')}</h1>

      {routines && routines.length > 0 ? (
        <div className="space-y-4">
          {routines.map(routine => (
            <RoutineCard key={routine.id} routine={routine} t={t} />
          ))}
        </div>
      ) : (
        <EmptyState icon="🔁" title={t('routines.noRoutines')} description={t('routines.noRoutinesDescription')} />
      )}
    </div>
  );
}
