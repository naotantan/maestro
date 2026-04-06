import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import api from '../../lib/api.ts';

interface PlaneSettings {
  baseUrl: string;
  workspaceSlug: string;
  projectId: string;
  apiToken: string;
  hasApiToken: boolean;
}

export default function PlaneSection() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:8090');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [projectId, setProjectId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data } = useQuery<PlaneSettings>(
    'plane-settings',
    () => api.get('/settings/plane').then((r) => r.data.data),
  );

  useEffect(() => {
    if (!data) return;
    setBaseUrl(data.baseUrl || 'http://localhost:8090');
    setWorkspaceSlug(data.workspaceSlug || '');
    setProjectId(data.projectId || '');
    setApiToken(data.hasApiToken ? '***masked***' : '');
  }, [data]);

  const save = useMutation(
    () => api.patch('/settings/plane', { baseUrl, workspaceSlug, projectId, apiToken }),
    { onSuccess: () => setTestResult({ ok: true, message: '設定を保存しました' }) },
  );

  const test = useMutation(
    async () => {
      // まず保存してからテスト
      await api.patch('/settings/plane', { baseUrl, workspaceSlug, projectId, apiToken });
      return api.get('/jobs/plane/test').then((r) => r.data.data);
    },
    {
      onSuccess: (d) => {
        setTestResult({
          ok: d.connected,
          message: d.connected
            ? `接続成功！ ${d.states_count} 件のステータスを確認`
            : `接続失敗: ${d.message}`,
        });
      },
      onError: () => setTestResult({ ok: false, message: '接続テストに失敗しました' }),
    },
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: 'var(--color-text)',
  };

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Plane 連携</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>
          ジョブを作成すると自動的に Plane Issue として登録されます
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Plane URL</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:8090"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>ワークスペース slug</label>
          <input
            type="text"
            value={workspaceSlug}
            onChange={(e) => setWorkspaceSlug(e.target.value)}
            placeholder="my-workspace"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}>
            Plane の URL に含まれるワークスペース名（例: {baseUrl || 'http://localhost:8090'}/<strong>my-workspace</strong>/...）
          </p>
        </div>
        <div>
          <label style={labelStyle}>プロジェクト ID</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}>
            Plane プロジェクト設定 → 「一般」に表示される UUID
          </p>
        </div>
        <div>
          <label style={labelStyle}>API トークン</label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={data?.hasApiToken ? '（設定済み・変更する場合のみ入力）' : 'your-api-token'}
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}>
            Plane → プロフィール → API トークン で発行
          </p>
        </div>

        {testResult && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: testResult.ok ? '#16a34a' : '#dc2626',
              border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => test.mutate()}
            disabled={test.isLoading || !workspaceSlug || !projectId}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: 14,
              opacity: test.isLoading || !workspaceSlug || !projectId ? 0.5 : 1,
            }}
          >
            {test.isLoading ? 'テスト中...' : '接続テスト'}
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isLoading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: save.isLoading ? 0.6 : 1,
            }}
          >
            {save.isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
