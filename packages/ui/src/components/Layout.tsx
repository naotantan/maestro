import { useEffect, useState, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { authStore } from '../stores/auth.ts';
import { clsx } from 'clsx';
import {
  Activity, BarChart2, Bell, Bot, BookOpen, Brain, Briefcase,
  Building2, ChefHat, Clock, ExternalLink, FolderKanban,
  Gauge, Globe, LogOut, Menu, Package, Receipt, Search,
  Settings, ShieldCheck, Sparkles, Wand2, Workflow, X,
  type LucideIcon,
} from 'lucide-react';
import { CommandPalette } from './ui/CommandPalette.tsx';

interface NavItem { to: string; labelKey: string; icon: LucideIcon; external?: boolean }
interface NavSection { titleKey: string; items: NavItem[] }

function buildNavSections(planeUrl: string): NavSection[] { return [
  {
    // ホーム — まず全体像を把握する
    titleKey: 'layout.sectionHome',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: Gauge },
      { to: '/activity', labelKey: 'nav.activity', icon: Activity },
    ],
  },
  {
    // タスク管理 — やるべき仕事を管理する
    titleKey: 'layout.sectionTasks',
    items: [
      { to: '/issues', labelKey: 'nav.issues', icon: BookOpen },
      { to: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck },
      { to: planeUrl, labelKey: 'nav.plane', icon: ExternalLink, external: true },
    ],
  },
  {
    // AI実行 — エージェントとジョブを動かす
    titleKey: 'layout.sectionExecution',
    items: [
      { to: '/agents', labelKey: 'nav.agents', icon: Bot },
      { to: '/jobs', labelKey: 'nav.jobs', icon: Briefcase },
      { to: '/routines', labelKey: 'nav.routines', icon: Workflow },
      { to: '/playbooks', labelKey: 'nav.playbooks', icon: Wand2 },
    ],
  },
  {
    // ツール＆知識 — AIに使わせるリソース
    titleKey: 'layout.sectionTools',
    items: [
      { to: '/plugins', labelKey: 'nav.plugins', icon: Sparkles },
      { to: '/recipes', labelKey: 'nav.recipes', icon: ChefHat },
      { to: '/memory', labelKey: 'nav.memory', icon: Brain },
    ],
  },
  {
    // 記録・分析 — 何が起きたかを振り返る
    titleKey: 'layout.sectionHistory',
    items: [
      { to: '/sessions', labelKey: 'nav.sessions', icon: Clock },
      { to: '/artifacts', labelKey: 'nav.artifacts', icon: Package },
      { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart2 },
    ],
  },
  {
    // 管理 — システム設定と運用
    titleKey: 'layout.sectionAdmin',
    items: [
      { to: '/webhooks', labelKey: 'nav.webhooks', icon: Globe },
      { to: '/costs', labelKey: 'nav.costs', icon: Receipt },
      { to: '/org', labelKey: 'nav.org', icon: Building2 },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
]; }

const mobilePrimaryNav = [
  { to: '/', labelKey: 'layout.home', icon: Gauge },
  { to: '/agents', labelKey: 'nav.agents', icon: Bot },
  { to: '/jobs', labelKey: 'nav.jobs', icon: Briefcase },
  { to: '/plugins', labelKey: 'nav.plugins', icon: Sparkles },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

function SidebarNavLink({ item, onNavigate, t }: { item: NavItem; onNavigate?: () => void; t: (key: string) => string }) {
  const Icon = item.icon;
  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#5e5d59] font-normal hover:text-[#141413] hover:bg-[#e8e6dc] transition-all duration-150"
      >
        <Icon className="h-4 w-4 flex-shrink-0 text-[#87867f] group-hover:text-[#5e5d59] transition-colors" />
        <span className="truncate">{t(item.labelKey)}</span>
        <ExternalLink className="h-3 w-3 ml-auto opacity-40 group-hover:opacity-70" />
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150',
          isActive
            ? 'bg-[#c96442]/12 text-[#c96442] font-medium border-l-2 border-[#c96442]'
            : 'text-[#5e5d59] font-normal hover:text-[#141413] hover:bg-[#e8e6dc]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={clsx('h-4 w-4 flex-shrink-0 transition-colors', isActive ? 'text-[#c96442]' : 'text-[#87867f] group-hover:text-[#5e5d59]')} />
          <span className="truncate">{t(item.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate, onLogout, t, navSections }: { onNavigate?: () => void; onLogout: () => void; t: (key: string) => string; navSections: NavSection[] }) {
  return (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[#e8e6dc]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#c96442] flex items-center justify-center">
            <span className="text-white text-xs font-semibold">M</span>
          </div>
          <span className="text-base text-[#141413]" style={{fontWeight: 500, fontFamily: 'Georgia, serif', letterSpacing: '-0.3px'}}>maestro</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#87867f]">{t('layout.consoleDescription')}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={t('layout.mainNavigation')}>
        <div className="space-y-5">
          {navSections.map((section) => (
            <section key={section.titleKey}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#87867f]">{t(section.titleKey)}</p>
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
      <div className="border-t border-[#e8e6dc] px-3 py-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[#87867f] transition-colors hover:bg-[#f5c8c8] hover:text-[#b53333]"
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [planeUrl, setPlaneUrl] = useState('http://localhost:8090');

  useEffect(() => {
    fetch('/api/settings/plane')
      .then((r) => r.json())
      .then((d: { data?: { baseUrl?: string } }) => {
        if (d.data?.baseUrl) setPlaneUrl(d.data.baseUrl);
      })
      .catch(() => {/* use default */});
  }, []);

  const navSections = useMemo(() => buildNavSections(planeUrl), [planeUrl]);

  function handleLogout() {
    authStore.logout();
    navigate('/login');
  }

  useEffect(() => { setIsMobileNavOpen(false); }, [location.pathname]);

  // Fetch unread notification count
  useEffect(() => {
    let cancelled = false;
    const fetchUnread = () => {
      fetch('/api/notifications/unread-count')
        .then((r) => r.json())
        .then((data: { count?: number }) => {
          if (!cancelled) setUnreadCount(data.count ?? 0);
        })
        .catch(() => {/* silently ignore */});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-screen bg-th-bg text-th-text">
      {/* CommandPalette — rendered at root so Cmd+K works everywhere */}
      <CommandPalette />

      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-[#e8e6dc] xl:flex xl:flex-col" style={{ background: '#f0eee6' }}>
          <SidebarContent onLogout={handleLogout} t={t} navSections={navSections} />
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
            'fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-[280px] flex-col border-r border-[#e8e6dc] shadow-th-lg transition-transform duration-200 xl:hidden',
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          style={{ background: '#f0eee6' }}
        >
          <div className="flex items-center justify-end px-3 pt-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[#87867f] hover:bg-[#e8e6dc]"
              aria-label={t('layout.closeMenu')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SidebarContent onNavigate={() => setIsMobileNavOpen(false)} onLogout={handleLogout} t={t} navSections={navSections} />
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
              <div className="flex items-center gap-1">
                {/* Search */}
                <NavLink
                  to="/search"
                  className="h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-2 hover:bg-th-surface-1"
                  aria-label={t('nav.search')}
                >
                  <Search className="h-4 w-4" />
                </NavLink>
                {/* Notifications */}
                <NavLink
                  to="/notifications"
                  className="relative h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-2 hover:bg-th-surface-1"
                  aria-label={t('nav.notifications')}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-th-accent px-1 text-[9px] font-bold text-white leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-9 w-9 flex items-center justify-center rounded-th-sm text-th-text-2 hover:bg-th-surface-1"
                  aria-label={t('nav.logout')}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
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
