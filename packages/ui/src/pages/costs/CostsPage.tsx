import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { Alert, LoadingSpinner } from '../../components/ui';

// GET /api/costs のレスポンス型
interface CostEvent {
  id: string;
  agent_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string; // DBはnumeric型 → 文字列で返る
  created_at: string;
}

// GET /api/costs/budget のレスポンス型
interface BudgetPolicy {
  id: string;
  company_id: string;
  limit_amount_usd: string; // numeric → 文字列
  period: string;
  alert_threshold: string | null;
  created_at: string;
  updated_at: string;
}

export default function CostsPage() {
  const { t } = useTranslation();
  // コストイベント一覧
  const { data: events, isLoading: eventsLoading, error: eventsError } = useQuery<CostEvent[]>(
    'costs',
    () => api.get('/costs').then((r) => r.data.data),
  );

  // 予算ポリシー一覧（/costs とは別 fetch）
  const { data: policies, isLoading: policiesLoading, error: policiesError } = useQuery<BudgetPolicy[]>(
    'costs/budget',
    () => api.get('/costs/budget').then((r) => r.data.data),
  );

  // 合計コストをクライアント側で計算
  const totalUsd = (events ?? []).reduce((sum, e) => sum + parseFloat(e.cost_usd || '0'), 0);

  if (eventsLoading) return <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>;
  if (eventsError) return <div className="p-6"><Alert variant="danger" message={t('costs.fetchError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('costs.managementTitle')}</h1>

      {/* 合計コスト */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-2">{t('costs.recentTotal')}</h2>
        <p className="text-4xl font-bold text-sky-400">
          ${totalUsd.toFixed(4)}
        </p>
        <p className="text-xs text-slate-500 mt-1">{t('costs.eventCount', { count: (events ?? []).length })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* コストイベントテーブル */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-bold mb-4">{t('costs.events')}</h2>
          {(events ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">{t('costs.model')}</th>
                    <th className="pb-2 pr-4 text-right">{t('costs.inputTokens')}</th>
                    <th className="pb-2 pr-4 text-right">{t('costs.outputTokens')}</th>
                    <th className="pb-2 text-right">{t('costs.costUsd')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(events ?? []).map((event) => (
                    <tr key={event.id} className="text-slate-300">
                      <td className="py-2 pr-4 font-mono text-xs">{event.model}</td>
                      <td className="py-2 pr-4 text-right text-xs">{event.input_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right text-xs">{event.output_tokens.toLocaleString()}</td>
                      <td className="py-2 text-right font-bold text-red-400">
                        ${parseFloat(event.cost_usd).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400">{t('costs.noEvents')}</p>
          )}
        </div>

        {/* 予算ポリシーパネル */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-bold mb-4">{t('costs.budgetPolicy')}</h2>
          {policiesLoading ? (
            <p className="text-slate-400 text-sm">{t('common.loading')}</p>
          ) : policiesError ? (
            <Alert variant="danger" message={t('costs.budgetFetchError')} />
          ) : (policies ?? []).length > 0 ? (
            <div className="space-y-3">
              {(policies ?? []).map((policy) => (
                <div key={policy.id} className="bg-slate-900 rounded p-4 border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-400">{t('costs.budgetLimit')}</span>
                    <span className="font-bold text-amber-400">
                      ${parseFloat(policy.limit_amount_usd).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-400">{t('costs.budgetPeriod')}</span>
                    <span className="text-sm">{policy.period}</span>
                  </div>
                  {policy.alert_threshold && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">{t('costs.alertThreshold')}</span>
                      <span className="text-sm text-yellow-400">
                        ${parseFloat(policy.alert_threshold).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">{t('costs.noBudgetPolicies')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
