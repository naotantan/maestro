import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ExternalLink, Plus, X } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, EmptyState, LoadingSpinner } from '../../components/ui';

interface Job {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'done' | 'error';
  plane_issue_id?: string | null;
  plane_issue_url?: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  result?: string | null;
  error_message?: string | null;
}

const COLUMNS: { status: Job['status']; label: string; color: string; bg: string }[] = [
  { status: 'pending',  label: '待機中',  color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  { status: 'running',  label: '実行中',  color: '#2563eb', bg: 'rgba(59,130,246,0.08)'  },
  { status: 'done',     label: '完了',    color: '#16a34a', bg: 'rgba(34,197,94,0.08)'   },
  { status: 'error',    label: 'エラー',  color: '#dc2626', bg: 'rgba(239,68,68,0.08)'   },
];

function timeAgo(dt: string | null): string {
  if (!dt) return '—';
  const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return new Date(dt).toLocaleDateString('ja-JP');
}

function JobCard({ job, onDelete }: { job: Job; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const col = COLUMNS.find((c) => c.status === job.status)!;

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* タイトル行 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text)',
              margin: 0,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {job.prompt}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-4)', flexShrink: 0, padding: 2 }}
          title="削除"
        >
          <X size={14} />
        </button>
      </div>

      {/* Plane リンク */}
      {job.plane_issue_url && (
        <a
          href={job.plane_issue_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--color-primary)',
            textDecoration: 'none',
            marginTop: 6,
          }}
        >
          <ExternalLink size={11} />
          Plane で確認
        </a>
      )}

      {/* メタ情報 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: col.bg,
            color: col.color,
            fontWeight: 500,
          }}
        >
          {col.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-4)', marginLeft: 'auto' }}>
          {timeAgo(job.created_at)}
        </span>
      </div>

      {/* 展開時の詳細 */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          {job.result && (
            <p style={{ fontSize: 12, color: 'var(--color-text-2)', margin: 0, whiteSpace: 'pre-wrap' }}>{job.result}</p>
          )}
          {job.error_message && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{job.error_message}</p>
          )}
          {job.started_at && (
            <p style={{ fontSize: 11, color: 'var(--color-text-4)', margin: '4px 0 0' }}>
              開始: {new Date(job.started_at).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');

  const { data: jobs, isLoading, error } = useQuery<Job[]>(
    'jobs',
    () => api.get('/jobs', { params: { limit: 100 } }).then((r) => r.data.data ?? r.data),
    { refetchInterval: 10000 },
  );

  const createJob = useMutation(
    (body: { prompt: string }) => api.post('/jobs', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs');
        setShowModal(false);
        setPrompt('');
      },
    },
  );

  const deleteJob = useMutation(
    (id: string) => api.delete(`/jobs/${id}`),
    { onSuccess: () => queryClient.invalidateQueries('jobs') },
  );

  const jobsByStatus = (status: Job['status']) =>
    (jobs ?? []).filter((j) => j.status === status);

  return (
    <div style={{ padding: '24px', height: '100%' as const, display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>ジョブ</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-3)' }}>
            Claudeへの指示 · Plane Issue と自動同期
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', fontSize: 14, fontWeight: 500,
          }}
        >
          <Plus size={16} />
          新規ジョブ
        </button>
      </div>

      {!!error && <Alert variant="danger" message="ジョブの読み込みに失敗しました" />}

      {/* Kanban ボード */}
      {isLoading ? (
        <LoadingSpinner text="読み込み中..." />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
          }}
        >
          {COLUMNS.map((col) => {
            const colJobs = jobsByStatus(col.status);
            return (
              <div
                key={col.status}
                style={{
                  background: col.bg,
                  borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${col.color}22`,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 200,
                  overflow: 'hidden',
                }}
              >
                {/* カラムヘッダー */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid ${col.color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      fontWeight: 600,
                      background: col.color + '22',
                      color: col.color,
                      borderRadius: 99,
                      padding: '1px 8px',
                    }}
                  >
                    {colJobs.length}
                  </span>
                </div>

                {/* カード一覧 */}
                <div
                  style={{
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    overflowY: 'auto',
                    flex: 1,
                  }}
                >
                  {colJobs.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--color-text-4)', textAlign: 'center', padding: '12px 0' }}>
                      なし
                    </p>
                  ) : (
                    colJobs.map((job) => (
                      <JobCard key={job.id} job={job} onDelete={(id) => deleteJob.mutate(id)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新規ジョブ モーダル */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24, width: '100%', maxWidth: 520,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>新規ジョブ</h2>
                <p style={{ fontSize: 12, color: 'var(--color-text-4)', margin: '2px 0 0' }}>
                  Plane が設定されている場合は自動で Issue が作成されます
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  プロンプト（指示内容）
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Claudeへの指示を入力してください..."
                  rows={5}
                  style={{
                    width: '100%', padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
              {createJob.isError && <Alert variant="danger" message="ジョブの作成に失敗しました" />}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 14 }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => createJob.mutate({ prompt })}
                  disabled={!prompt.trim() || createJob.isLoading}
                  style={{
                    padding: '8px 16px', border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-primary)', color: '#fff',
                    cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    opacity: !prompt.trim() || createJob.isLoading ? 0.6 : 1,
                  }}
                >
                  {createJob.isLoading ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
