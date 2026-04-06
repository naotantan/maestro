import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../lib/api.ts';
import { formatDate } from '../../lib/date.ts';
import { LoadingSpinner, Alert, EmptyState } from '../../components/ui';
import {
  Link2, FileText, Image, FileBarChart, Package, ExternalLink,
  Trash2, Clock, Terminal, Tag, Search, Filter, BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Artifact {
  id: string;
  company_id: string;
  session_id: string | null;
  type: string;
  title: string;
  description: string | null;
  prompt: string | null;
  content: string | null;
  url: string | null;
  file_path: string | null;
  tags: string[] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactsResponse {
  data: Artifact[];
  meta: { limit: number; offset: number; total: number };
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Link2; color: string }> = {
  url:    { label: 'Web',    icon: Link2,        color: 'text-th-accent bg-th-accent-dim border-th-accent/20' },
  file:   { label: 'ファイル', icon: FileText,     color: 'text-th-success bg-th-success-dim border-th-success/20' },
  image:  { label: '画像',   icon: Image,        color: 'text-purple-600 bg-purple-50 border-purple-200' },
  report: { label: 'レポート', icon: FileBarChart, color: 'text-th-warning bg-th-warning-dim border-th-warning/20' },
  other:  { label: 'その他',  icon: Package,      color: 'text-th-text-3 bg-th-surface-1 border-th-border' },
};

const TYPE_FILTERS = [
  { value: 'all',    label: 'すべて' },
  { value: 'url',    label: 'Web' },
  { value: 'file',   label: 'ファイル' },
  { value: 'report', label: 'レポート' },
  { value: 'image',  label: '画像' },
  { value: 'other',  label: 'その他' },
];

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_LABELS[type] ?? TYPE_LABELS.other;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-th-sm border font-medium', cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ArtifactCard({ artifact, onDelete }: { artifact: Artifact; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const link = artifact.url ?? artifact.file_path;

  return (
    <div className="rounded-th border border-th-border bg-th-surface-1 overflow-hidden hover:border-th-border-strong transition-colors">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Type + Title */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <TypeBadge type={artifact.type} />
              <h3 className="text-sm font-semibold text-th-text truncate">{artifact.title}</h3>
            </div>

            {/* URL / file_path */}
            {link && (
              <div className="flex items-center gap-1 mt-1">
                {artifact.url ? (
                  <a
                    href={artifact.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-th-accent hover:underline truncate max-w-full"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {artifact.url}
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-th-text-3 font-mono truncate">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    {artifact.file_path}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {artifact.description && (
              <p className="mt-2 text-xs text-th-text-3 leading-relaxed line-clamp-2">
                {artifact.description}
              </p>
            )}

            {/* Tags */}
            {artifact.tags && artifact.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <Tag className="h-3 w-3 text-th-text-4" />
                {artifact.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-th-surface-2 text-th-text-3">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-3 text-xs text-th-text-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(artifact.created_at)}
              </span>
              {artifact.session_id && (
                <span className="font-mono">session: {artifact.session_id.slice(0, 8)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {artifact.content && (
              <button
                onClick={() => setShowContent(!showContent)}
                className={`p-1.5 rounded-th-sm transition-colors ${showContent ? 'text-th-accent bg-th-accent-dim' : 'text-th-text-4 hover:text-th-text hover:bg-th-surface-2'}`}
                title="本文を表示"
              >
                <BookOpen className="h-4 w-4" />
              </button>
            )}
            {artifact.prompt && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-th-sm text-th-text-4 hover:text-th-text hover:bg-th-surface-2 transition-colors"
                title="指示を表示"
              >
                <Terminal className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(artifact.id)}
              className="p-1.5 rounded-th-sm text-th-text-4 hover:text-th-danger hover:bg-th-danger-dim transition-colors"
              title="削除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: content (report body) */}
      {showContent && artifact.content && (
        <div className="border-t border-th-border bg-th-surface-0 px-5 py-4">
          <p className="text-xs font-semibold text-th-text-4 uppercase tracking-wider mb-3 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            本文
          </p>
          <pre className="text-sm text-th-text-2 whitespace-pre-wrap break-words font-sans leading-relaxed bg-th-surface-1 rounded-th-sm p-4 overflow-y-auto max-h-[600px]">
            {artifact.content}
          </pre>
        </div>
      )}

      {/* Expanded: prompt */}
      {expanded && artifact.prompt && (
        <div className="border-t border-th-border bg-th-surface-0 px-5 py-4">
          <p className="text-xs font-semibold text-th-text-4 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            作成のきっかけとなった指示
          </p>
          <pre className="text-xs text-th-text-3 whitespace-pre-wrap break-words font-sans leading-relaxed bg-th-surface-1 rounded-th-sm p-3 max-h-40 overflow-y-auto">
            {artifact.prompt}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ArtifactsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: response, isLoading, error } = useQuery<ArtifactsResponse>(
    ['artifacts', typeFilter, q, page],
    () => api.get('/artifacts', {
      params: { type: typeFilter, q: q || undefined, limit, offset: (page - 1) * limit },
    }).then(r => r.data),
    { keepPreviousData: true },
  );

  const deleteMutation = useMutation(
    (id: string) => api.delete(`/artifacts/${id}`),
    {
      onSuccess: () => queryClient.invalidateQueries('artifacts'),
    }
  );

  function handleDelete(id: string) {
    if (window.confirm('この成果物を削除しますか？')) {
      deleteMutation.mutate(id);
    }
  }

  const artifacts = response?.data ?? [];
  const total = response?.meta?.total ?? artifacts.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // タイプ別カウント（表示件数ベース）
  const typeCounts = artifacts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner text="成果物を読み込み中..." /></div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">成果物</h1>
        <Alert variant="danger" message="成果物の読み込みに失敗しました" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold gradient-text">成果物</h1>
        <p className="text-th-text-3">
          Claude Code が作成したWeb画面・ファイル・レポートなどを自動記録します。
          各成果物にはいつ・どんな指示で作られたかの情報が付きます。
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <div className="rounded-th border border-th-border bg-th-surface-1 px-4 py-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-th-text-3" />
          <span className="text-sm text-th-text-2">合計 {total} 件</span>
        </div>
        {Object.entries(typeCounts).map(([type, count]) => {
          const cfg = TYPE_LABELS[type] ?? TYPE_LABELS.other;
          const Icon = cfg.icon;
          return (
            <div key={type} className="rounded-th border border-th-border bg-th-surface-1 px-4 py-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-th-text-3" />
              <span className="text-sm text-th-text-2">{cfg.label} {count}</span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-th-text-4" />
          <input
            type="text"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="タイトル・URL・パスで検索..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-th border border-th-border bg-th-surface-1 text-th-text placeholder:text-th-text-4 focus:outline-none focus:border-th-accent"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-th-text-4" />
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setTypeFilter(f.value); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 rounded-th-sm text-xs font-medium transition-colors',
                typeFilter === f.value
                  ? 'bg-th-accent text-white'
                  : 'bg-th-surface-1 text-th-text-3 hover:bg-th-surface-2 border border-th-border',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {artifacts.length === 0 ? (
        <EmptyState
          icon="📦"
          title="成果物がまだありません"
          description="maestro-watch.sh が動いていると、Claude Code が作成したファイルやWebページが自動的にここに記録されます"
        />
      ) : (
        <>
          <div className="space-y-3">
            {artifacts.map(artifact => (
              <ArtifactCard key={artifact.id} artifact={artifact} onDelete={handleDelete} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={clsx(
                  'px-3 py-2 rounded-th-sm text-sm font-medium transition-colors',
                  page === 1 ? 'bg-th-surface-1 text-th-text-4 cursor-not-allowed' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
                )}
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'min-w-[2.5rem] px-2 py-1 rounded-th-sm text-sm font-medium transition-colors',
                    p === page ? 'bg-th-accent text-white' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={clsx(
                  'px-3 py-2 rounded-th-sm text-sm font-medium transition-colors',
                  page === totalPages ? 'bg-th-surface-1 text-th-text-4 cursor-not-allowed' : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2',
                )}
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
