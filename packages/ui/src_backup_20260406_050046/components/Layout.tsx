import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { authStore } from '../stores/auth.ts';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Activity, BellRing, Bot, BookOpen, Building2, FolderKanban,
  Gauge, LogOut, Menu, Package, Receipt, Settings, ShieldCheck, Sparkles, Workflow, X, ChefHat, Wand2,
  type LucideIcon,
} from 'lucide-react';

interface NavItem { to: string; labelKey: string; icon: LucideIcon }
interface NavSection { titleKey: string; items: NavItem[] }

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
      { to: '/plugins', labelKey: 'nav.skills', icon: Sparkles },
      { to: '/playbooks', labelKey: 'nav.playbooks', icon: Wand2 },
      { to: '/recipes', labelKey: 'nav.recipes', icon: ChefHat },
      { to: '/agents', labelKey: 'nav.agents', icon: Bot },
      { to: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { to: '/routines', labelKey: 'nav.routines', icon: Workflow },
      { to: '/sessions', labelKey: 'nav.sessions', icon: BookOpen },
      { to: '/artifacts', labelKey: 'nav.artifacts', icon: Package },
    ],
  },
  {
    titleKey: 'layout.sectionGovernance',
    items: [
      { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck },
      { to: '/costs', labelKey: 'nav.costs', icon: Receipt },
      { to: '/org', labelKey: 'nav.org', icon: Building2 },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

const mobilePrimaryNav = [
  { to: '/', labelKey: 'layout.home', icon: Gauge },
  { to: '/plugins', labelKey: 'nav.skills', icon: Sparkles },
  { to: '/agents', labelKey: 'nav.agents', icon: Bot },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

function SidebarNavLink({ item, onNavigate, t }: { item: NavItem; onNavigate?: () => void; t: (key: string) => string }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-th-md px-3 py-2 text-[13px] font-medium transition-all duration-150',
          isActive
            ? 'bg-th-accent-dim text-th-accent'
            : 'text-th-text-3 hover:bg-th-surface-1 hover:text-th-text'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={clsx('h-4 w-4 flex-shrink-0', isActive ? 'text-th-accent' : 'text-th-text-4 group-hover:text-th-text-2')} />
          <span className="truncate">{t(item.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate, onLogout, t }: { onNavigate?: () => void; onLogout: () => void; t: (key: string) => string }) {
  return (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-th-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-th-sm bg-th-accent flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <h1 className="text-base font-semibold tracking-tight text-th-text">.maestro</h1>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-th-text-3">{t('layout.consoleDescription')}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={t('layout.mainNavigation')}>
        <div className="space-y-5">
          {navSections.map((section) => (
            <section key={section.titleKey}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-th-text-4">{t(section.titleKey)}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} t={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-th-border px-3 py-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-th-md px-3 py-2 text-[13px] font-medium text-th-text-3 transition-colors hover:bg-th-danger-dim hover:text-th-danger"
          aria-label={t('nav.logout')}
        >
          <LogOut className="h-4 w-4" />
          <span>{t('nav.logout')}</span>
        </button>
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

  useEffect(() => { setIsMobileNavOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-th-bg text-th-text">
      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-th-border bg-th-surface-0 xl:flex xl:flex-col">
          <SidebarContent onLogout={handleLogout} t={t} />
        </aside>

        {/* Mobile overlay */}
        {isMobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-th-overlay backdrop-blur-sm xl:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label={t('layout.closeNavigation')}
          />
        )}

        {/* Mobile sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-[280px] flex-col bg-th-surface-0 border-r border-th-border shadow-th-lg transition-transform duration-200 xl:hidden',
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-end px-3 pt-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-3 hover:bg-th-surface-1"
              aria-label={t('layout.closeMenu')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SidebarContent onNavigate={() => setIsMobileNavOpen(false)} onLogout={handleLogout} t={t} />
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 border-b border-th-border bg-th-bg/80 backdrop-blur-md xl:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-2 hover:bg-th-surface-1"
                aria-label={t('layout.openMenu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold text-th-text">.maestro</p>
              <button
                type="button"
                onClick={handleLogout}
                className="h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-2 hover:bg-th-surface-1"
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-24 xl:pb-0">
            <Outlet />
          </main>

          {/* Mobile bottom nav */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-th-border bg-th-bg/95 backdrop-blur-md px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 xl:hidden" aria-label={t('layout.mobileNavigation')}>
            <div className="grid grid-cols-5 gap-1">
              {mobilePrimaryNav.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 rounded-th-md px-2 py-2 text-[10px] font-medium transition-colors',
                      isActive ? 'text-th-accent' : 'text-th-text-4 hover:text-th-text-2'
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
