import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Search, X, Brain } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Memory {
  id: string;
  title: string;
  type: 'user' | 'project' | 'feedback' | 'reference' | 'session';
  content: string;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  user: 'ユーザー',
  project: 'プロジェクト',
  feedback: 'フィードバック',
  reference: '参照情報',
  session: 'セッション',
};

const TYPE_BADGE: Record<string, string> = {
  user:      'bg-th-accent-dim text-th-accent',
  project:   'bg-th-success-dim text-th-success',
  feedback:  'bg-th-warning-dim text-th-warning',
  reference: 'bg-th-info-dim text-th-info',
  session:   'bg-th-surface-2 text-th-text-3',
};

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'user', label: 'ユーザー' },
  { value: 'project', label: 'プロジェクト' },
  { value: 'feedback', label: 'フィードバック' },
  { value: 'reference', label: '参照情報' },
  { value: 'session', label: 'セッション' },
];

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString('ja-JP');
}

export default function MemoryPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'user', content: '' });

  const { data: memories, isLoading, error } = useQuery<Memory[]>(
    'memories',
    () => api.get('/memories').then((r) => r.data.data ?? r.data),
  );

  const createMemory = useMutation(
    (body: { title: string; type: string; content: string }) => api.post('/memories', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('memories');
        setShowModal(false);
        setForm({ title: '', type: 'user', content: '' });
      },
    },
  );

  const deleteMemory = useMutation(
    (id: string) => api.delete(`/memories/${id}`),
    { onSuccess: () => queryClient.invalidateQueries('memories') },
  );

  const filtered = (memories ?? []).filter((m) => {
    const matchType = !typeFilter || m.type === typeFilter;
    const matchSearch = !search
      || m.title.toLowerCase().includes(search.toLowerCase())
      || m.content.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-th-text">メモリ</h1>
          <p className="mt-1 text-sm text-th-text-3">AIエージェントが参照する記憶データ</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-th-md bg-th-accent px-4 py-2 text-sm font-medium text-white hover:bg-th-accent-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          追加
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-none w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-th-text-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="メモリを検索..."
            className="w-full rounded-th-md border border-th-border bg-th-surface pl-8 pr-3 py-1.5 text-[13px] text-th-text placeholder-th-text-4 focus:border-th-accent focus:ring-2 focus:ring-th-accent/20 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1 rounded-th-md border text-[13px] transition-colors ${
                typeFilter === opt.value
                  ? 'bg-th-accent border-th-accent text-white'
                  : 'border-th-border bg-th-surface text-th-text hover:bg-th-surface-1'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="メモリを読み込み中..." />
      ) : error ? (
        <Alert variant="danger" message="メモリの読み込みに失敗しました" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Brain size={32} />} title="メモリがありません" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtered.map((mem) => (
            <div
              key={mem.id}
              className="rounded-th-lg border border-th-border bg-th-surface p-4 shadow-th-sm hover:border-th-border-2 transition-colors"
            >
              <div className="flex items-start justify-between mb-2.5">
                <span className={`inline-block text-[11px] px-2 py-0.5 rounded-th-sm font-medium ${TYPE_BADGE[mem.type] ?? TYPE_BADGE.session}`}>
                  {TYPE_LABEL[mem.type] ?? mem.type}
                </span>
                <button
                  onClick={() => deleteMemory.mutate(mem.id)}
                  className="text-th-text-3 hover:text-th-danger transition-colors"
                  aria-label="削除"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm font-medium text-th-text mb-1.5">{mem.title}</p>
              <p className="text-xs text-th-text-2 leading-relaxed mb-3 line-clamp-3">{mem.content}</p>
              <p className="text-[11px] text-th-text-3">作成: {formatDate(mem.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-th-overlay backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-md rounded-th-lg border border-th-border bg-th-surface p-6 shadow-th-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-th-text">メモリを追加</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-th-text-3 hover:text-th-text transition-colors"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[13px] font-medium text-th-text-2 mb-1.5">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="メモリのタイトル"
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2 text-sm text-th-text placeholder-th-text-4 focus:border-th-accent focus:ring-2 focus:ring-th-accent/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-th-text-2 mb-1.5">タイプ</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2 text-sm text-th-text focus:border-th-accent focus:ring-2 focus:ring-th-accent/20 transition-colors"
                >
                  <option value="user">ユーザー</option>
                  <option value="project">プロジェクト</option>
                  <option value="feedback">フィードバック</option>
                  <option value="reference">参照情報</option>
                  <option value="session">セッション</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-th-text-2 mb-1.5">内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="記憶させる内容を入力..."
                  rows={4}
                  className="w-full rounded-th-md border border-th-border bg-th-bg px-3 py-2 text-sm text-th-text placeholder-th-text-4 focus:border-th-accent focus:ring-2 focus:ring-th-accent/20 transition-colors resize-y"
                />
              </div>
              {createMemory.isError && <Alert variant="danger" message="メモリの追加に失敗しました" />}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-th-md border border-th-border bg-th-surface text-sm text-th-text hover:bg-th-surface-1 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => createMemory.mutate(form)}
                  disabled={!form.title.trim() || !form.content.trim() || createMemory.isLoading}
                  className="px-4 py-2 rounded-th-md bg-th-accent text-sm font-medium text-white hover:bg-th-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMemory.isLoading ? '追加中...' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
