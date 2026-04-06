import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { Eye, EyeOff, Bot, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../lib/api.ts';
import { authStore } from '../../stores/auth.ts';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* 背景グラデーション */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(83,58,253,0.12) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        {/* ロゴ */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'var(--color-primary)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={22} color="#fff" />
            </div>
            <span style={{
              fontSize: '24px', fontWeight: 700,
              color: 'var(--color-text)', letterSpacing: '-0.02em',
            }}>
              .maestro
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-3)' }}>
            {t('auth.platformTagline')}
          </p>
        </div>

        {/* カード */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <h1 style={{
            fontSize: '20px', fontWeight: 700,
            color: 'var(--color-text)', marginBottom: '6px',
          }}>
            {t('auth.login')}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-3)', marginBottom: '24px' }}>
            {t('auth.loginSubtitle')}
          </p>

          {error && (
            <div style={{
              background: 'var(--color-danger-dim)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '13px', color: 'var(--color-danger)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div>
              <label htmlFor="email" style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: 'var(--color-text-2)', marginBottom: '6px',
              }}>
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@example.com"
                required
                aria-label={t('auth.email')}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px', color: 'var(--color-text)',
                  outline: 'none', fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-primary-dim)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: 'var(--color-text-2)', marginBottom: '6px',
              }}>
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  aria-label={t('auth.password')}
                  style={{
                    width: '100%', padding: '10px 42px 10px 14px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px', color: 'var(--color-text)',
                    outline: 'none', fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-primary-dim)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-3)', padding: '2px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 20px',
                background: loading ? 'var(--color-text-3)' : 'var(--color-primary)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 150ms ease',
                fontFamily: 'var(--font-sans)',
                marginTop: '4px',
              }}
              onMouseOver={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = 'var(--color-primary-hover)'; }}
              onMouseOut={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = 'var(--color-primary)'; }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />{t('auth.loginLoading')}</>
                : <>{t('auth.login')}<ArrowRight size={16} /></>
              }
            </button>
          </form>

          <div style={{
            marginTop: '20px', paddingTop: '20px',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)',
          }}>
            {t('auth.noAccountCta')}
            {' '}
            <Link to="/register" style={{
              color: 'var(--color-primary)', fontWeight: 500,
              textDecoration: 'none',
            }}>
              {t('auth.register')}
            </Link>
          </div>
        </div>

        {/* フッター */}
        <p style={{
          textAlign: 'center', fontSize: '12px',
          color: 'var(--color-text-3)', marginTop: '24px',
        }}>
          © {new Date().getFullYear()} .maestro. All rights reserved.
        </p>
      </div>
    </div>
  );
}
