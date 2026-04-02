import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { authStore } from '../../stores/auth.ts';
import { Button, Alert } from '../../components/ui';
import { clsx } from 'clsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      authStore.setAuth(res.data.apiKey, res.data.companyId, res.data.userId);
      navigate('/');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'ログインに失敗しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ & タイトル */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
              .company
            </span>
          </div>
          <p className="text-slate-400">AIエージェント組織管理プラットフォーム</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">ログイン</h2>
            <p className="text-slate-400 text-sm mt-1">
              アカウントにサインインしてください
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              title="ログインエラー"
              message={error}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@example.com"
                className={clsx(
                  'w-full px-4 py-2.5 bg-slate-700 border rounded-lg',
                  'text-white placeholder-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800',
                  'transition-colors'
                )}
                required
                aria-label="メールアドレス"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={clsx(
                  'w-full px-4 py-2.5 bg-slate-700 border rounded-lg',
                  'text-white placeholder-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800',
                  'transition-colors'
                )}
                required
                aria-label="パスワード"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-700">
            <p className="text-center text-slate-400 text-sm">
              アカウントがない場合は
              <Link
                to="/register"
                className="text-sky-400 hover:text-sky-300 font-medium ml-1 transition-colors"
              >
                登録
              </Link>
            </p>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © 2024 .company. All rights reserved.
        </p>
      </div>
    </div>
  );
}
