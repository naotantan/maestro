import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { Alert, LoadingSpinner } from '../../components/ui';

// GET /api/org のレスポンス型
interface OrgInfo {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

// GET /api/org/members のレスポンス型
interface Member {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

// GET /api/org/join-requests のレスポンス型
interface JoinRequest {
  id: string;
  company_id: string;
  user_id: string;
  status: string;
  message?: string;
  created_at: string;
  reviewed_at?: string;
}

export default function OrgPage() {
  const { t } = useTranslation();
  // approve 操作中の ID を管理してボタン二重送信を防ぐ
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();

  // 組織情報
  const { data: org, isLoading: orgLoading, error: orgError } = useQuery<OrgInfo>(
    'org',
    () => api.get('/org').then((r) => r.data.data),
  );

  // メンバー一覧（/org とは別 fetch）
  const { data: members, isLoading: membersLoading, error: membersError } = useQuery<Member[]>(
    'org/members',
    () => api.get('/org/members').then((r) => r.data.data),
  );

  // 参加リクエスト一覧（pending のみ表示）
  const { data: requestsData, isLoading: requestsLoading, error: requestsError } = useQuery<JoinRequest[]>(
    'org/join-requests',
    () => api.get('/org/join-requests').then((r) => r.data.data),
  );

  // 参加リクエスト承認
  const handleApprove = async (id: string) => {
    setActioningId(id);
    setActionError('');
    try {
      await api.post(`/org/join-requests/${id}/approve`, { role: 'member' });
      // 承認後はメンバーリストと参加リクエストを再取得
      await queryClient.invalidateQueries('org/join-requests');
      await queryClient.invalidateQueries('org/members');
    } catch (err: unknown) {
      setActionError((err as any)?.response?.data?.message ?? t('common.error'));
    } finally {
      setActioningId(null);
    }
  };

  // 参加リクエスト拒否
  const handleDeny = async (id: string) => {
    setActioningId(id);
    setActionError('');
    try {
      await api.post(`/org/join-requests/${id}/deny`, {});
      // 拒否後は参加リクエストを再取得
      await queryClient.invalidateQueries('org/join-requests');
    } catch (err: unknown) {
      setActionError((err as any)?.response?.data?.message ?? t('common.error'));
    } finally {
      setActioningId(null);
    }
  };

  if (orgLoading) return <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>;
  if (orgError) return <div className="p-6"><Alert variant="danger" message={t('org.fetchError')} /></div>;

  const memberList = members ?? [];
  const requests = (requestsData ?? []).filter((r) => r.status === 'pending');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('org.title')}</h1>

      {actionError && <Alert variant="danger" message={actionError} />}

      {/* 組織情報 */}
      <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border">
        <h2 className="text-lg font-bold mb-2">{org?.name}</h2>
        {org?.description && (
          <p className="text-th-text-2 text-sm mb-2">{org.description}</p>
        )}
        <p className="text-th-text-3 text-sm">{t('org.createdAtValue', { value: formatDate(org?.created_at) })}</p>
      </div>

      {/* メンバー一覧 */}
      <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border">
        <h2 className="text-lg font-bold mb-4">{t('org.members')}</h2>
        {membersLoading ? (
          <p className="text-th-text-3 text-sm">{t('common.loading')}</p>
        ) : membersError ? (
          <Alert variant="danger" message={t('org.membersFetchError')} />
        ) : memberList.length > 0 ? (
          <div className="space-y-2">
            {memberList.map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center py-2 border-b border-th-border last:border-b-0"
              >
                <div>
                  <p className="font-mono text-sm text-th-text-2">{member.user_id}</p>
                  <p className="text-xs text-th-text-3">{t('org.joinedAtValue', { value: formatDate(member.created_at) })}</p>
                </div>
                <span className="px-2 py-1 rounded text-xs bg-th-surface-1">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-th-text-3">{t('org.noMembers')}</p>
        )}
      </div>

      {/* 参加リクエスト */}
      <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border">
        <h2 className="text-lg font-bold mb-4">{t('org.joinRequests')}</h2>
        {requestsLoading ? (
          <p className="text-th-text-3 text-sm">{t('common.loading')}</p>
        ) : requestsError ? (
          <Alert variant="danger" message={t('org.requestsFetchError')} />
        ) : requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex justify-between items-start py-3 border-b border-th-border last:border-b-0"
              >
                <div className="flex-1">
                  <p className="font-mono text-sm text-th-text-2">{req.user_id}</p>
                  {req.message && (
                    <p className="text-xs text-th-text-3 mt-1">{t('org.messageValue', { value: req.message })}</p>
                  )}
                  <p className="text-xs text-th-text-3">{t('org.requestedAtValue', { value: formatDate(req.created_at) })}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actioningId === req.id}
                    className="bg-th-accent hover:opacity-80 disabled:opacity-50 px-3 py-1 rounded text-xs font-medium"
                  >
                    {t('approvals.approve')}
                  </button>
                  <button
                    onClick={() => handleDeny(req.id)}
                    disabled={actioningId === req.id}
                    className="bg-th-danger hover:opacity-80 disabled:opacity-50 px-3 py-1 rounded text-xs font-medium"
                  >
                    {t('approvals.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-th-text-3">{t('org.noJoinRequests')}</p>
        )}
      </div>
    </div>
  );
}
