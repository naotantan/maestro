import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { User, Mail, Globe, Key, Monitor, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api.ts';
import { LoadingSpinner, Alert } from '../../components/ui';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  email: string;
  language: string;
  role: string;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  is_active: boolean;
}

interface LoginSession {
  id: string;
  device: string;
  os: string;
  ip: string;
  browser: string;
  is_current: boolean;
  last_seen_at: string;
}

export default function UserProfilePage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // API key modal state
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('ja');
  const [profileInitialized, setProfileInitialized] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<UserProfile>(
    'user-profile',
    () => api.get('/user/profile').then((r) => r.data),
    {
      onSuccess: (data) => {
        if (!profileInitialized) {
          setDisplayName(data.display_name ?? '');
          setEmail(data.email ?? '');
          setLanguage(data.language ?? 'ja');
          setProfileInitialized(true);
        }
      },
    },
  );

  const { data: apiKeys = [] } = useQuery<ApiKey[]>(
    'user-api-keys',
    () => api.get('/user/api-keys').then((r) => r.data?.data ?? r.data ?? []),
    { retry: false },
  );

  const { data: loginSessions = [] } = useQuery<LoginSession[]>(
    'user-login-sessions',
    () => api.get('/user/sessions').then((r) => r.data?.data ?? r.data ?? []),
    { retry: false },
  );

  const saveProfileMutation = useMutation(
    () => api.put('/user/profile', { display_name: displayName, email, language }),
    {
      onSuccess: () => {
        setMessage({ type: 'success', text: 'プロフィールを保存しました' });
        queryClient.invalidateQueries('user-profile');
        setTimeout(() => setMessage(null), 3000);
      },
      onError: () => setMessage({ type: 'error', text: '保存に失敗しました' }),
    },
  );

  const changePasswordMutation = useMutation(
    () => api.put('/user/password', { current_password: currentPassword, new_password: newPassword }),
    {
      onSuccess: () => {
        setMessage({ type: 'success', text: 'パスワードを変更しました' });
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setMessage(null), 3000);
      },
      onError: () => setMessage({ type: 'error', text: 'パスワード変更に失敗しました' }),
    },
  );

  const revokeApiKeyMutation = useMutation(
    (keyId: string) => api.delete(`/user/api-keys/${keyId}`),
    { onSuccess: () => queryClient.invalidateQueries('user-api-keys') },
  );

  const revokeSessionMutation = useMutation(
    (sessionId: string) => api.delete(`/user/sessions/${sessionId}`),
    { onSuccess: () => queryClient.invalidateQueries('user-login-sessions') },
  );

  const createApiKeyMutation = useMutation(
    (name: string) => api.post('/user/api-keys', { name }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-api-keys');
        setShowApiKeyModal(false);
        setApiKeyName('');
      },
    },
  );

  if (profileLoading) {
    return <div className="p-6"><LoadingSpinner text="読み込み中..." /></div>;
  }

  if (profileError) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-3xl font-bold mb-4">プロフィール</h1>
        <Alert variant="danger" message="プロフィールの取得に失敗しました" />
      </div>
    );
  }

  const avatarLetter = (profile?.display_name ?? profile?.username ?? 'U').charAt(0).toUpperCase();

  function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '未使用';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    return `${Math.floor(hours / 24)}日前`;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">プロフィール</h1>

      {message && (
        <div className={`px-4 py-2 rounded-th-md border text-sm ${
          message.type === 'success'
            ? 'bg-th-success-dim border-th-border text-th-success'
            : 'bg-th-danger-dim border-th-border text-th-danger'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile header */}
      <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6">
        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-light flex-shrink-0"
            style={{ background: 'var(--color-accent, #7c3aed)' }}
          >
            {avatarLetter}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{profile?.display_name ?? profile?.username}</h2>
            <p className="text-sm text-th-text-3 mt-1">{profile?.email} · {profile?.role ?? '管理者'}</p>
            {profile?.created_at && (
              <p className="text-xs text-th-text-4 mt-1">
                参加日: {new Date(profile.created_at).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile form */}
        <div className="bg-th-surface-0 rounded-th-md border border-th-border p-6 space-y-4">
          <h2 className="text-base font-semibold border-b border-th-border pb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-th-text-3" />
            プロフィール情報
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">ユーザー名</label>
              <input
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={profile?.username ?? ''}
                readOnly
                style={{ opacity: 0.7 }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> メールアドレス
              </label>
              <input
                type="email"
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">表示名</label>
              <input
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> 言語
              </label>
              <select
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => saveProfileMutation.mutate()}
            disabled={saveProfileMutation.isLoading}
            className="w-full bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 text-white px-4 py-2 rounded-th-md font-medium transition-colors text-sm"
          >
            {saveProfileMutation.isLoading ? '保存中...' : '保存'}
          </button>

          {/* Password change */}
          <div className="border-t border-th-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-th-text-2">パスワード変更</h3>
            <div>
              <label className="block text-sm font-medium mb-1">現在のパスワード</label>
              <input
                type="password"
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">新しいパスワード</label>
              <input
                type="password"
                className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button
              onClick={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isLoading || !currentPassword || !newPassword}
              className="w-full bg-th-surface-1 hover:bg-th-surface-2 disabled:opacity-50 border border-th-border px-4 py-2 rounded-th-md font-medium transition-colors text-sm"
            >
              {changePasswordMutation.isLoading ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* API Keys */}
          <div className="bg-th-surface-0 rounded-th-md border border-th-border p-5">
            <div className="flex items-center justify-between border-b border-th-border pb-3 mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-th-text-3" /> APIキー
              </h2>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="flex items-center gap-1 text-xs bg-th-surface-1 hover:bg-th-surface-2 border border-th-border px-2.5 py-1.5 rounded-th-sm font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> 新規発行
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <p className="text-sm text-th-text-4 text-center py-4">APIキーはありません</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="border border-th-border rounded-th-sm p-3"
                    style={{ opacity: key.is_active ? 1 : 0.5 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{key.name}</span>
                      {key.is_active ? (
                        <button
                          onClick={() => revokeApiKeyMutation.mutate(key.id)}
                          className="flex items-center gap-1 text-xs text-th-danger hover:bg-th-danger-dim px-2 py-1 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> 無効化
                        </button>
                      ) : (
                        <span className="text-xs text-th-text-4 bg-th-surface-1 px-2 py-0.5 rounded">無効</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-th-text-3 font-mono">{key.prefix}••••••••</code>
                      <span className="text-xs text-th-text-4">最終使用: {formatRelativeTime(key.last_used_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Login sessions */}
          <div className="bg-th-surface-0 rounded-th-md border border-th-border p-5">
            <h2 className="text-base font-semibold border-b border-th-border pb-3 mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-th-text-3" /> 最近のログイン
            </h2>

            {loginSessions.length === 0 ? (
              <p className="text-sm text-th-text-4 text-center py-4">セッション情報がありません</p>
            ) : (
              <div className="space-y-3">
                {loginSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-th-text">
                        {session.device} — {session.os}
                      </div>
                      <div className="text-xs text-th-text-4 mt-0.5">
                        {session.ip} · {session.browser}
                      </div>
                    </div>
                    <div className="text-right">
                      {session.is_current ? (
                        <div className="text-xs text-th-success font-medium">現在のセッション</div>
                      ) : (
                        <>
                          <div className="text-xs text-th-text-4">{formatRelativeTime(session.last_seen_at)}</div>
                          <button
                            onClick={() => revokeSessionMutation.mutate(session.id)}
                            className="text-xs text-th-danger hover:underline mt-1"
                          >
                            ログアウト
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowApiKeyModal(false); setApiKeyName(''); } }}
        >
          <div className="bg-th-surface-0 border border-th-border rounded-th-lg p-6 w-full max-w-sm shadow-th-lg">
            <h3 className="text-base font-semibold mb-4">APIキーを新規発行</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="api-key-name" className="block text-sm font-medium mb-1.5">キー名</label>
                <input
                  id="api-key-name"
                  type="text"
                  autoFocus
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && apiKeyName.trim()) createApiKeyMutation.mutate(apiKeyName.trim()); }}
                  placeholder="例: 開発用キー"
                  className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text text-sm"
                />
              </div>
              {createApiKeyMutation.isError && (
                <Alert variant="danger" message="APIキーの作成に失敗しました" />
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowApiKeyModal(false); setApiKeyName(''); }}
                  className="px-3 py-1.5 text-sm border border-th-border rounded-th-sm bg-th-surface-1 hover:bg-th-surface-2 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => { if (apiKeyName.trim()) createApiKeyMutation.mutate(apiKeyName.trim()); }}
                  disabled={!apiKeyName.trim() || createApiKeyMutation.isLoading}
                  className="px-3 py-1.5 text-sm bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 text-white rounded-th-sm font-medium transition-colors"
                >
                  {createApiKeyMutation.isLoading ? '発行中...' : '発行'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
