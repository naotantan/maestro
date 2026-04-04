import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { authStore } from '../stores/auth.ts';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Activity,
  BellRing,
  Bot,
  Briefcase,
  Building2,
  FolderKanban,
  Gauge,
  Goal,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'layout.sectionOverview',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: Gauge },
      { to: '/inbox', labelKey: 'layout.inbox', icon: BellRing },
      { to: '/activity', labelKey: 'nav.activity', icon: Activity },
    ],
  },
  {
    titleKey: 'layout.sectionExecution',
    items: [
      { to: '/agents', labelKey: 'nav.agents', icon: Bot },
      { to: '/issues', labelKey: 'layout.issues', icon: Briefcase },
      { to: '/goals', labelKey: 'nav.goals', icon: Goal },
      { to: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { to: '/routines', labelKey: 'nav.routines', icon: Workflow },
    ],
  },
  {
    titleKey: 'layout.sectionGovernance',
    items: [
      { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck },
      { to: '/costs', labelKey: 'nav.costs', icon: Receipt },
      { to: '/plugins', labelKey: 'nav.plugins', icon: Sparkles },
      { to: '/org', labelKey: 'nav.org', icon: Building2 },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

const mobilePrimaryNav = [
  { to: '/', labelKey: 'layout.home', icon: Gauge },
  { to: '/issues', labelKey: 'layout.issues', icon: Briefcase },
  { to: '/agents', labelKey: 'nav.agents', icon: Bot },
  { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

function isActivePath(currentPath: string, itemPath: string) {
  if (itemPath === '/') return currentPath === '/';
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function SidebarNavLink({
  item,
  onNavigate,
  t,
}: {
  item: NavItem;
  onNavigate?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950',
          isActive
            ? 'bg-sky-500/15 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={clsx(
              'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
              isActive
                ? 'border-sky-400/40 bg-sky-400/15 text-sky-200'
                : 'border-slate-800 bg-slate-900/70 text-slate-500 group-hover:border-slate-700 group-hover:text-slate-200'
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{t(item.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({
  onNavigate,
  onLogout,
  t,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
          {t('layout.console')}
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-white">.maestro</h1>
          <p className="mt-1 max-w-xs text-sm leading-6 text-slate-400">{t('layout.consoleDescription')}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 pb-6">
        <div className="space-y-6">
          {navSections.map((section) => (
            <section key={section.titleKey}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {t(section.titleKey)}
              </p>
              <div className="mt-2 space-y-1.5">
                {section.items.map((item) => (
                  <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} t={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 bg-slate-950/80 px-3 py-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">{t('layout.session')}</p>
          <p className="mt-2 text-sm text-slate-300">{t('layout.sessionDescription')}</p>
          <button
            onClick={onLogout}
            className={clsx(
              'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium transition-colors',
              'text-slate-300 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-100',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950'
            )}
            aria-label={t('nav.logout')}
          >
            <LogOut className="h-4 w-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  function handleLogout() {
    authStore.logout();
    navigate('/login');
  }

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_46%),linear-gradient(180deg,rgba(15,23,42,0.85)_0%,rgba(2,6,23,0)_100%)]" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/95 backdrop-blur xl:flex xl:flex-col 2xl:w-80">
          <SidebarContent onLogout={handleLogout} t={t} />
        </aside>

        {isMobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm xl:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label={t('layout.closeNavigation')}
          />
        )}

        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col border-r border-white/10 bg-slate-950/98 shadow-2xl shadow-slate-950/50 backdrop-blur transition-transform duration-300 xl:hidden',
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-end px-3 pt-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
              aria-label={t('layout.closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SidebarContent onNavigate={() => setIsMobileNavOpen(false)} onLogout={handleLogout} t={t} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur xl:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10"
                aria-label={t('layout.openMenu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">.maestro</p>
                <p className="text-sm text-slate-400">{t('layout.console')}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10"
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-24 xl:pb-0">
            <Outlet />
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur xl:hidden">
            <div className="grid grid-cols-5 gap-1">
              {mobilePrimaryNav.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(location.pathname, item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'bg-sky-500/15 text-sky-100'
                        : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
