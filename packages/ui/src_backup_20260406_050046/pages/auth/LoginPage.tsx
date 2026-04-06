import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { authStore } from '../../stores/auth.ts';
import { Button, Alert } from '../../components/ui';
import { clsx } from 'clsx';

export default function LoginPage() {
  const { t } = useTranslation();
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
      setError((err as any)?.response?.data?.message ?? t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ & タイトル */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-2">
            <span className="gradient-text">
              .maestro
            </span>
          </div>
          <p className="text-th-text-3">{t('auth.platformTagline')}</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-th-surface-0 rounded-th border border-th-border shadow-th-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-th-text">{t('auth.login')}</h2>
            <p className="text-th-text-3 text-sm mt-1">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              title={t('auth.loginErrorTitle')}
              message={error}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-th-text-2 mb-2"
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@example.com"
                className={clsx(
                  'w-full px-4 py-2.5 bg-th-surface-1 border border-th-border rounded-th-md',
                  'text-th-text placeholder-th-text-4',
                  'focus:outline-none focus:ring-2 focus:ring-th-accent focus:ring-offset-2 focus:ring-offset-th-surface-0',
                  'transition-colors'
                )}
                required
                aria-label={t('auth.email')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-th-text-2 mb-2"
              >
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={clsx(
                  'w-full px-4 py-2.5 bg-th-surface-1 border border-th-border rounded-th-md',
                  'text-th-text placeholder-th-text-4',
                  'focus:outline-none focus:ring-2 focus:ring-th-accent focus:ring-offset-2 focus:ring-offset-th-surface-0',
                  'transition-colors'
                )}
                required
                aria-label={t('auth.password')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {loading ? t('auth.loginLoading') : t('auth.login')}
            </Button>
          </form>

          <div className="pt-4 border-t border-th-border">
            <p className="text-center text-th-text-3 text-sm">
              {t('auth.noAccountCta')}
              <Link
                to="/register"
                className="text-th-accent hover:opacity-80 font-medium ml-1 transition-colors"
              >
                {t('auth.register')}
              </Link>
            </p>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-th-text-4 text-xs mt-6">
          © {new Date().getFullYear()} .maestro. All rights reserved.
        </p>
      </div>
    </div>
  );
}
