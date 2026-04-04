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

/**
 * 開発指示をすぐに登録できるモーダル
 * Layout から常設の「＋」ボタンで開く
 */
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

  // 開いたらテキストエリアにフォーカス
  useEffect(() => {
    if (open) {
      setText('');
      setResult(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/instructions', { text });
      setResult({ issue: res.data.data, meta: res.data.meta });
    } catch {
      setResult({
        issue: null,
        meta: { skipped: true, reason: '登録に失敗しました。もう一度お試しください。' },
      });
    } finally {
      setLoading(false);
    }
  };

  // Ctrl+Enter / Cmd+Enter で送信
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNext = () => {
    setText('');
    setResult(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const statusLabel: Record<string, string> = {
    todo: 'Todo',
    backlog: 'Backlog',
  };

  return (
    // オーバーレイ
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* 背景ブラー */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">開発指示を登録</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="指示内容を入力してください&#10;例: ログイン画面のバリデーションを修正する"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:border-sky-500 focus:outline-none"
                rows={5}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  プロジェクト・優先度は自動判定されます
                  <span className="ml-2 text-slate-600">⌘+Enter で送信</span>
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim() || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      登録中...
                    </>
                  ) : '登録する'}
                </button>
              </div>
            </>
          ) : result.meta.skipped ? (
            // スキップ（開発指示でない）
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3">
                <p className="text-sm text-amber-300">{result.meta.reason}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                >
                  別の指示を入力
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            // 登録成功
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-emerald-300">登録しました</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  {result.issue?.identifier} — {result.issue?.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>種別: <span className="text-sky-300">{statusLabel[result.issue?.status ?? ''] ?? result.issue?.status}</span></span>
                  {result.meta.project_name ? (
                    <span>プロジェクト: <span className="text-sky-300">{result.meta.project_name}</span></span>
                  ) : (
                    <span className="text-slate-500">プロジェクト未紐付き</span>
                  )}
                  {result.meta.handoff_agent ? (
                    <span className="text-emerald-400">
                      → <span className="font-medium">{result.meta.handoff_agent}</span> が最大 30 秒以内に処理します
                    </span>
                  ) : (
                    <span className="text-amber-400">稼働中エージェントなし（手動対応が必要）</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
                >
                  続けて登録
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
