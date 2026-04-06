import { useState } from 'react';
import { useQuery } from 'react-query';
import { Search, Zap } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Skill {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type?: 'explicit' | 'auto' | 'installed';
  usage_count?: number;
  last_used_at?: string | null;
}

const CATEGORIES = [
  { value: '', label: 'すべて' },
  { value: 'explicit', label: '明示的' },
  { value: 'auto', label: '自動' },
  { value: 'installed', label: 'インストール済み' },
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  frontend: { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' },
  backend: { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' },
  security: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
  infra: { bg: 'rgba(249,115,22,0.1)', color: '#ea580c' },
  agent: { bg: 'rgba(139,92,246,0.1)', color: '#7c3aed' },
  common: { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
};

function getCategoryStyle(category?: string) {
  const key = (category ?? 'common').toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.common;
}

function formatLastUsed(dt?: string | null): string {
  if (!dt) return '未使用';
  const d = new Date(dt);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 172800) return '昨日';
  return `${Math.floor(diff / 86400)}日前`;
}

export default function SkillsPage() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: skills, isLoading, error } = useQuery<Skill[]>(
    'plugins',
    () => api.get('/plugins').then((r) => r.data.data ?? r.data),
  );

  const filtered = (skills ?? []).filter((s) => {
    const matchCategory = !categoryFilter || s.type === categoryFilter || s.category === categoryFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          スキル{' '}
          <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-text-2)' }}>
            {skills?.length ?? 0}
          </span>
        </h1>
        <p style={{ marginTop: 4, color: 'var(--color-text-2)' }}>登録済みのAIスキルカタログ</p>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="スキルを検索..."
            style={{
              width: '100%',
              padding: '7px 12px 7px 30px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: categoryFilter === cat.value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: categoryFilter === cat.value ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="スキルを読み込み中..." />
      ) : error ? (
        <Alert variant="danger" message="スキルの読み込みに失敗しました" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🧩" title="スキルが見つかりません" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((skill) => {
            const catStyle = getCategoryStyle(skill.category);
            return (
              <div
                key={skill.id}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 18,
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                    }}
                  >
                    /{skill.name}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-2)',
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {skill.description ?? '説明なし'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: catStyle.bg,
                      color: catStyle.color,
                      fontWeight: 500,
                    }}
                  >
                    {skill.category ?? 'common'}
                  </span>
                  {skill.usage_count !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={11} />
                      {skill.usage_count}回使用
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    最終使用: {formatLastUsed(skill.last_used_at)}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(skill.name).catch(() => {});
                    }}
                    title="スキル名をクリップボードにコピー"
                    style={{
                      fontSize: 12,
                      padding: '3px 10px',
                      border: '1px solid var(--color-primary)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    コピー
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
