import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { authStore } from '../../stores/auth.ts';
import { Button, Alert } from '../../components/ui';
import { clsx } from 'clsx';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        companyName,
      });
      authStore.setAuth(res.data.apiKey, res.data.companyId, res.data.userId);
      navigate('/');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t('auth.registerError');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const inputClassName = clsx(
    'w-full px-4 py-2.5 bg-th-surface-1 border border-th-border rounded-th-md',
    'text-th-text placeholder-th-text-4',
    'focus:outline-none focus:ring-2 focus:ring-th-accent focus:ring-offset-2 focus:ring-offset-th-surface-0',
    'transition-colors'
  );

  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-2">
            <span className="gradient-text">
              .maestro
            </span>
          </div>
          <p className="text-th-text-3">{t('auth.platformTagline')}</p>
        </div>

        <div className="bg-th-surface-0 rounded-th border border-th-border shadow-th-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-th-text">{t('auth.register')}</h2>
            <p className="text-th-text-3 text-sm mt-1">
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              title={t('auth.registerErrorTitle')}
              message={error}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-th-text-2 mb-2"
              >
                {t('auth.name')}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                className={inputClassName}
                required
                aria-label={t('auth.name')}
                autoComplete="name"
              />
            </div>

            <div>
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-th-text-2 mb-2"
              >
                {t('auth.companyName')}
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className={inputClassName}
                required
                aria-label={t('auth.companyName')}
                autoComplete="organization"
              />
            </div>

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
                className={inputClassName}
                required
                aria-label={t('auth.email')}
                autoComplete="email"
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
                placeholder={t('auth.passwordPlaceholder')}
                className={inputClassName}
                required
                aria-label={t('auth.password')}
                autoComplete="new-password"
              />
              <p className="mt-2 text-xs text-th-text-4">
                {t('auth.registerHelp')}
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {loading ? t('auth.registerLoading') : t('auth.register')}
            </Button>
          </form>

          <div className="pt-4 border-t border-th-border">
            <p className="text-center text-th-text-3 text-sm">
              {t('auth.hasAccountCta')}
              <Link
                to="/login"
                className="text-th-accent hover:opacity-80 font-medium ml-1 transition-colors"
              >
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-th-text-4 text-xs mt-6">
          © {new Date().getFullYear()} .maestro. All rights reserved.
        </p>
      </div>
    </div>
  );
}
