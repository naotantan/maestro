import { Outlet, NavLink } from 'react-router-dom';
import { authStore } from '../stores/auth.ts';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', label: 'ダッシュボード', icon: '⚡' },
  { to: '/inbox', label: '受信箱', icon: '📬' },
  { to: '/agents', label: 'エージェント', icon: '🤖' },
  { to: '/issues', label: 'Issue', icon: '📋' },
  { to: '/goals', label: 'ゴール', icon: '🎯' },
  { to: '/projects', label: 'プロジェクト', icon: '📁' },
  { to: '/routines', label: 'ルーティン', icon: '🔄' },
  { to: '/approvals', label: '承認', icon: '✅' },
  { to: '/costs', label: 'コスト', icon: '💰' },
  { to: '/activity', label: 'アクティビティ', icon: '📊' },
  { to: '/plugins', label: 'プラグイン', icon: '🔌' },
  { to: '/org', label: '組織', icon: '🏢' },
  { to: '/settings', label: '設定', icon: '⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    authStore.logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* サイドバー */}
      <aside className="w-56 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col border-r border-slate-700 shadow-xl">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-baseline gap-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
              .company
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">AIエージェント組織</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800',
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white shadow-lg shadow-sky-500/20'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                )
              }
              aria-current="page"
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={handleLogout}
            className={clsx(
              'w-full text-sm font-medium py-2.5 px-3 rounded-lg transition-colors',
              'text-slate-400 hover:text-slate-100 hover:bg-slate-700',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900'
            )}
            aria-label="ログアウト"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        <Outlet />
      </main>
    </div>
  );
}
