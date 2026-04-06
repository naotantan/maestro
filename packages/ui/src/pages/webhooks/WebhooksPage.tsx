import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, X, Send, Trash2 } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  last_triggered_at?: string | null;
  last_status?: string | null;
}

const DEFAULT_EVENTS = ['job.complete', 'job.error', 'approval.request', 'agent.offline', 'issue.create'];

function formatLastTriggered(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: '' });
  const [formError, setFormError] = useState('');
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'error' | null>>({});

  const { data: webhooks, isLoading, error } = useQuery<Webhook[]>(
    'webhooks',
    () => api.get('/webhooks').then((r) => r.data.data ?? r.data),
  );

  const createWebhook = useMutation(
    (body: { name: string; url: string; events: string[] }) => api.post('/webhooks', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('webhooks');
        setShowModal(false);
        setForm({ name: '', url: '', events: '' });
      },
    },
  );

  const toggleWebhook = useMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) => api.put(`/webhooks/${id}`, { enabled }),
    { onSuccess: () => queryClient.invalidateQueries('webhooks') },
  );

  const deleteWebhook = useMutation(
    (id: string) => api.delete(`/webhooks/${id}`),
    { onSuccess: () => queryClient.invalidateQueries('webhooks') },
  );

  const testWebhook = useMutation(
    (id: string) => api.post(`/webhooks/${id}/test`),
    {
      onSuccess: (_, id) => {
        setTestResult((prev) => ({ ...prev, [id]: 'ok' }));
        setTimeout(() => setTestResult((prev) => ({ ...prev, [id]: null })), 3000);
      },
      onError: (_, id) => {
        setTestResult((prev) => ({ ...prev, [id]: 'error' }));
        setTimeout(() => setTestResult((prev) => ({ ...prev, [id]: null })), 3000);
      },
    },
  );

  const handleCreate = () => {
    try {
      const parsed = new URL(form.url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        setFormError('URLはhttpsまたはhttpで始まる必要があります');
        return;
      }
    } catch {
      setFormError('有効なURLを入力してください');
      return;
    }
    setFormError('');
    const events = form.events.split(',').map((e) => e.trim()).filter(Boolean);
    createWebhook.mutate({ name: form.name, url: form.url, events });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-3xl font-bold">Webhook</h1>
          <p style={{ marginTop: 4, color: 'var(--color-text-2)' }}>外部サービスへのイベント通知設定</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Plus size={16} />
          Webhook追加
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Webhookを読み込み中..." />
      ) : error ? (
        <Alert variant="danger" message="Webhookの読み込みに失敗しました" />
      ) : (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {webhooks && webhooks.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}>
                  {['エンドポイント', 'イベント', 'ステータス', '最終トリガー', '操作'].map((h) => (
                    <th
                      key={h}
                      style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 16px', maxWidth: 260 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 3 }}>{wh.name}</div>
                      <code style={{ fontSize: 11, color: 'var(--color-text-3)', wordBreak: 'break-all' }}>{wh.url}</code>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--color-surface-1)',
                              color: 'var(--color-text-2)',
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => toggleWebhook.mutate({ id: wh.id, enabled: !wh.enabled })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: wh.enabled ? 'var(--color-success-dim)' : 'var(--color-surface)',
                          color: wh.enabled ? 'var(--color-success)' : 'var(--color-text-3)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: wh.enabled ? 'var(--color-success)' : 'var(--color-text-3)',
                            display: 'inline-block',
                          }}
                        />
                        {wh.enabled ? '有効' : '無効'}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{formatLastTriggered(wh.last_triggered_at)}</div>
                      {wh.last_status && (
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 2,
                            color: wh.last_status.startsWith('2') ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {wh.last_status}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => testWebhook.mutate(wh.id)}
                          title="テスト送信"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            background: testResult[wh.id] === 'ok' ? 'rgba(34,197,94,0.1)' : testResult[wh.id] === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--color-surface)',
                            color: testResult[wh.id] === 'ok' ? '#16a34a' : testResult[wh.id] === 'error' ? '#dc2626' : 'var(--color-text)',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <Send size={12} />
                          テスト
                        </button>
                        <button
                          onClick={() => deleteWebhook.mutate(wh.id)}
                          title="削除"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon="🔔" title="Webhookが登録されていません" />
          )}
        </div>
      )}

      {/* Info panel */}
      <div
        style={{
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e40af', marginBottom: 6 }}>Webhookシークレット</div>
        <p style={{ fontSize: 12, color: '#3b82f6', lineHeight: 1.6, margin: 0 }}>
          maestro はすべての Webhook リクエストに <code>X-Maestro-Signature</code> ヘッダーを付与します。
          受信側でシークレットを使った HMAC-SHA256 署名検証を行うことを推奨します。
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Webhookを追加</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>名前</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: Slack通知"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>URL</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  イベント <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 400 }}>（カンマ区切り）</span>
                </label>
                <input
                  type="text"
                  value={form.events}
                  onChange={(e) => setForm({ ...form, events: e.target.value })}
                  placeholder={DEFAULT_EVENTS.slice(0, 2).join(', ')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }}
                />
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {DEFAULT_EVENTS.map((ev) => (
                    <button
                      key={ev}
                      onClick={() => {
                        const current = form.events ? form.events.split(',').map((e) => e.trim()) : [];
                        if (!current.includes(ev)) {
                          setForm({ ...form, events: [...current, ev].join(', ') });
                        }
                      }}
                      style={{ fontSize: 11, padding: '2px 7px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-2)' }}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              {(formError || createWebhook.isError) && (
                <Alert variant="danger" message={formError || 'Webhookの作成に失敗しました'} />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 14 }}>
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || !form.url.trim() || createWebhook.isLoading}
                  style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: !form.name.trim() || !form.url.trim() ? 0.6 : 1 }}
                >
                  {createWebhook.isLoading ? '追加中...' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
