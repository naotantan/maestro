import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Hash, Layers, Zap } from 'lucide-react';
import api from '../../lib/api.ts';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'issues' | 'sessions' | 'plugins';
}

interface SearchResponse {
  issues?: SearchResult[];
  sessions?: SearchResult[];
  plugins?: SearchResult[];
}

type Tab = 'all' | 'issues' | 'sessions' | 'plugins';

const TAB_LABELS: Record<Tab, string> = {
  all: 'All',
  issues: 'Issues',
  sessions: 'Sessions',
  plugins: 'Plugins',
};

const TYPE_ICON: Record<SearchResult['type'], React.ReactNode> = {
  issues: <Hash size={12} />,
  sessions: <Layers size={12} />,
  plugins: <Zap size={12} />,
};

const TYPE_COLOR: Record<SearchResult['type'], string> = {
  issues: 'var(--color-primary-dim)',
  sessions: 'var(--color-info-dim)',
  plugins: 'var(--color-warning-dim)',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CommandPaletteProps {
  onSelect?: (result: SearchResult) => void;
}

export function CommandPalette({ onSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [results, setResults] = useState<SearchResponse>({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({});
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch results
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.get('/search', { params: { q: debouncedQuery } })
      .then((r) => {
        if (!cancelled) {
          setResults(r.data.data ?? r.data);
          setSelectedIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const flatResults = useCallback((): SearchResult[] => {
    const types: SearchResult['type'][] = ['issues', 'sessions', 'plugins'];
    const all: SearchResult[] = [];
    for (const t of types) {
      if (activeTab === 'all' || activeTab === t) {
        const items = results[t] ?? [];
        all.push(...items);
      }
    }
    return all;
  }, [results, activeTab]);

  function handleKeyNavigation(e: React.KeyboardEvent) {
    const flat = flatResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flat[selectedIndex];
      if (item) {
        onSelect?.(item);
        setOpen(false);
      }
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '6px 12px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-2)',
          color: 'var(--color-text-3)',
          fontSize: '13px',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-3)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-2)';
        }}
      >
        <Search size={13} />
        Search...
        <span
          style={{
            marginLeft: 'var(--space-2)',
            fontSize: '11px',
            padding: '1px 5px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ⌘K
        </span>
      </button>
    );
  }

  const tabs: Tab[] = ['all', 'issues', 'sessions', 'plugins'];
  let globalIndex = 0;

  function renderGroup(type: SearchResult['type']) {
    const items = results[type] ?? [];
    if (items.length === 0) return null;
    if (activeTab !== 'all' && activeTab !== type) return null;

    return (
      <div key={type} style={{ paddingBottom: 'var(--space-2)' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-3)',
            padding: '8px 16px 4px',
          }}
        >
          {TAB_LABELS[type]} ({items.length})
        </div>
        {items.map((item) => {
          const idx = globalIndex++;
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              onClick={() => {
                onSelect?.(item);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '10px 16px',
                cursor: 'pointer',
                background: isSelected ? 'var(--color-primary-dim)' : 'transparent',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  background: TYPE_COLOR[type],
                  color: 'var(--color-text-2)',
                  flexShrink: 0,
                }}
              >
                {TYPE_ICON[type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </div>
                {item.subtitle && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.subtitle}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const hasResults =
    (results.issues?.length ?? 0) +
      (results.sessions?.length ?? 0) +
      (results.plugins?.length ?? 0) >
    0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,14,26,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '620px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.3)',
          zIndex: 1001,
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyNavigation}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: '16px var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <Search size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, sessions, plugins..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-text)',
              background: 'transparent',
            }}
          />
          {loading && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>searching...</span>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 6px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-2)',
              color: 'var(--color-text-3)',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
            aria-label="Close"
          >
            Esc
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-1)',
            padding: '8px var(--space-4) 0',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedIndex(0); }}
              style={{
                padding: '5px 12px 8px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-3)',
                borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                fontFamily: 'var(--font-sans)',
                transition: 'color var(--transition-fast)',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {!query.trim() ? (
            <div
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--color-text-3)',
                fontSize: '13px',
              }}
            >
              Start typing to search...
            </div>
          ) : !hasResults && !loading ? (
            <div
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--color-text-3)',
                fontSize: '13px',
              }}
            >
              No results for "{query}"
            </div>
          ) : (
            <>
              {renderGroup('issues')}
              {renderGroup('sessions')}
              {renderGroup('plugins')}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: '8px 16px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-2)',
            fontSize: '11px',
            color: 'var(--color-text-3)',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </>
  );
}
