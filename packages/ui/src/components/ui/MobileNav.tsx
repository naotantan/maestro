import React from 'react';
import { LayoutDashboard, ListChecks, Bot, Zap, Settings } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const DEFAULT_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'Issues', href: '/issues', icon: <ListChecks size={20} /> },
  { label: 'Agents', href: '/agents', icon: <Bot size={20} /> },
  { label: 'Skills', href: '/skills', icon: <Zap size={20} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} /> },
];

interface MobileNavProps {
  currentPath?: string;
  items?: NavItem[];
  onNavigate?: (href: string) => void;
}

export function MobileNav({ currentPath = '/', items = DEFAULT_ITEMS, onNavigate }: MobileNavProps) {
  function isActive(href: string): boolean {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }

  return (
    <>
      {/* Spacer to push content above the nav bar */}
      <div
        style={{ height: '64px' }}
        className="mobile-nav-spacer"
        aria-hidden="true"
      />

      <nav
        aria-label="Mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 900,
          display: 'none', // controlled by CSS media query
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '64px',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="mobile-nav"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={
                onNavigate
                  ? (e) => {
                      e.preventDefault();
                      onNavigate(item.href);
                    }
                  : undefined
              }
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                flex: 1,
                height: '100%',
                color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
                textDecoration: 'none',
                transition: 'color var(--transition-fast)',
                padding: '4px 0',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '28px',
                  borderRadius: 'var(--radius-md)',
                  background: active ? 'var(--color-primary-dim)' : 'transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                {item.icon}
              </span>
              <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .mobile-nav {
            display: flex !important;
          }
          .mobile-nav-spacer {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
