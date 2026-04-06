import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../lib/api.ts';

export default function AutoApproveSection() {
  const queryClient = useQueryClient();

  const { data } = useQuery<{ enabled: boolean }>(
    'auto-approve',
    () => api.get('/approvals/auto-approve').then((r) => r.data.data),
  );

  const toggle = useMutation(
    (enabled: boolean) => api.post('/approvals/auto-approve', { enabled }),
    {
      onSuccess: () => queryClient.invalidateQueries('auto-approve'),
    },
  );

  const enabled = data?.enabled ?? false;

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>自動承認</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>
            有効にすると承認リクエストを自動的に承認します。既存の待機中の承認も即座に承認されます。
          </p>
        </div>
        <button
          onClick={() => toggle.mutate(!enabled)}
          disabled={toggle.isLoading}
          style={{
            position: 'relative',
            width: 48,
            height: 28,
            borderRadius: 99,
            border: 'none',
            background: enabled ? 'var(--color-primary)' : 'var(--color-border)',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
          title={enabled ? '自動承認を無効化' : '自動承認を有効化'}
        >
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: enabled ? 24 : 4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
      {enabled && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: '#16a34a',
          }}
        >
          自動承認が有効です。全ての承認リクエストが自動的に承認されます。
        </div>
      )}
    </div>
  );
}
