import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader, Plus, X } from 'lucide-react';
import api from '../lib/api.ts';

interface CreatedMeta {
  skipped: boolean;
  classified_as?: 'todo' | 'issue';
  project_name?: string | null;
  handoff_agent?: string | null;
  reason?: string;
}

interface CreatedIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
}

export function QuickInstructionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ issue: CreatedIssue | null; meta: CreatedMeta } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) { setText(''); setResult(null); setTimeout(() => textareaRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/instructions', { text });
      setResult({ issue: res.data.data, meta: res.data.meta });
    } catch {
      setResult({ issue: null, meta: { skipped: true, reason: '登録に失敗しました。もう一度お試しください。' } });
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  const handleNext = () => { setText(''); setResult(null); setTimeout(() => textareaRef.current?.focus(), 50); };
  const statusLabel: Record<string, string> = { todo: 'Todo', backlog: 'Backlog' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-th-overlay backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-th-xl border border-th-border bg-th-surface-0 shadow-th-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-th-accent" />
            <h2 className="text-sm font-semibold text-th-text">開発指示を登録</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-th-sm p-1.5 text-th-text-4 transition-colors hover:bg-th-surface-1 hover:text-th-text-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={"指示内容を入力してください\n例: ログイン画面のバリデーションを修正する"}
                className="w-full rounded-th-md border border-th-border bg-th-bg px-4 py-3 text-sm text-th-text placeholder:text-th-text-4 resize-none focus:border-th-accent focus:outline-none"
                rows={5}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-th-text-4">
                  プロジェクト・優先度は自動判定されます
                  <span className="ml-2 text-th-text-4/60">⌘+Enter で送信</span>
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim() || loading}
                  className="inline-flex items-center gap-2 rounded-th-md bg-th-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-accent-hover disabled:opacity-40"
                >
                  {loading ? (<><Loader className="h-4 w-4 animate-spin" />登録中...</>) : '登録する'}
                </button>
              </div>
            </>
          ) : result.meta.skipped ? (
            <div className="space-y-4">
              <div className="rounded-th-md border border-th-warning/20 bg-th-warning-dim px-4 py-3">
                <p className="text-sm text-th-warning">{result.meta.reason}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleNext} className="rounded-th-md bg-th-surface-2 px-4 py-2 text-sm font-medium text-th-text transition-colors hover:bg-th-surface-3">別の指示を入力</button>
                <button type="button" onClick={onClose} className="rounded-th-md bg-th-surface-1 px-4 py-2 text-sm font-medium text-th-text-3 transition-colors hover:bg-th-surface-2">閉じる</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-th-md border border-th-success/20 bg-th-success-dim px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-th-success flex-shrink-0" />
                  <span className="text-sm font-medium text-th-success">登録しました</span>
                </div>
                <p className="text-xs text-th-text-2 font-medium">{result.issue?.identifier} — {result.issue?.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-th-text-3">
                  <span>種別: <span className="text-th-accent">{statusLabel[result.issue?.status ?? ''] ?? result.issue?.status}</span></span>
                  {result.meta.project_name ? (
                    <span>プロジェクト: <span className="text-th-accent">{result.meta.project_name}</span></span>
                  ) : (
                    <span className="text-th-text-4">プロジェクト未紐付き</span>
                  )}
                  {result.meta.handoff_agent ? (
                    <span className="text-th-success">→ <span className="font-medium">{result.meta.handoff_agent}</span> が最大 30 秒以内に処理します</span>
                  ) : (
                    <span className="text-th-warning">稼働中エージェントなし（手動対応が必要）</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleNext} className="rounded-th-md bg-th-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-accent-hover">続けて登録</button>
                <button type="button" onClick={onClose} className="rounded-th-md bg-th-surface-1 px-4 py-2 text-sm font-medium text-th-text-3 transition-colors hover:bg-th-surface-2">閉じる</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
