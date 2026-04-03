import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { authStore } from '../../stores/auth.ts';

export default function RegisterPage() {
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
        err instanceof Error ? err.message : '登録に失敗しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-2xl font-bold text-sky-400 mb-6">.company</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">会社名</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              required
            />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded px-4 py-2 font-medium transition"
          >
            {loading ? '登録中...' : '登録'}
          </button>
        </form>
        <p className="text-center text-slate-400 text-sm mt-4">
          既にアカウントをお持ちの場合は
          <Link to="/login" className="text-sky-400 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
