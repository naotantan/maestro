import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui';

interface Plugin {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  repository_url?: string;
  version: string;
  enabled: boolean;
  category?: string;
  trigger_type?: string;
  usage_content?: string;
  usage_count?: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** `|` や空白のみの説明はYAMLアーティファクト — 表示しない */
export function cleanDescription(desc: string | undefined): string | null {
  if (!desc) return null;
  const trimmed = desc.trim();
  if (trimmed === '|' || trimmed === '' || trimmed === '>') return null;
  return trimmed;
}

/** 最終使用日を相対表記で返す */
export function formatLastUsed(lastUsedAt: string | null | undefined): string | null {
  if (!lastUsedAt) return null;
  const diff = Date.now() - new Date(lastUsedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 30) return `${days}日前`;
  return new Date(lastUsedAt).toLocaleDateString('ja-JP');
}

/** サンプルプロンプトを usage_content から抽出 */
export function extractSamplePrompts(usageContent: string | undefined, _name: string): string[] {
  if (!usageContent) return [];
  const prompts: string[] = [];

  const codeBlocks = usageContent.matchAll(/```[^\n]*\n([\s\S]*?)```/g);
  for (const block of codeBlocks) {
    const lines = block[1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    prompts.push(...lines.slice(0, 2));
    if (prompts.length >= 3) break;
  }

  if (prompts.length === 0) {
    const exampleLines = usageContent.matchAll(/(?:例:|例えば|Example:)\s*(.+)/g);
    for (const m of exampleLines) {
      prompts.push(m[1].trim());
      if (prompts.length >= 3) break;
    }
  }

  return prompts.slice(0, 3);
}

export const CopyIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

export const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/** 説明文コンポーネント：実際にクランプされている場合のみ「続きを読む」を表示 */
export function DescriptionBlock({ desc, onClick }: { desc: string; onClick: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  const checkClamp = useCallback(() => {
    if (ref.current) {
      setIsClamped(ref.current.scrollHeight > ref.current.clientHeight + 1);
    }
  }, []);

  useEffect(() => {
    checkClamp();
    window.addEventListener('resize', checkClamp);
    return () => window.removeEventListener('resize', checkClamp);
  }, [checkClamp, desc]);

  return (
    <button className="text-left w-full" onClick={onClick}>
      <p ref={ref} className="text-th-text-3 text-xs leading-relaxed line-clamp-3 hover:text-th-text transition-colors cursor-pointer">
        {desc}
      </p>
      {isClamped && (
        <span className="text-th-text-4 hover:text-th-text-2 text-xs transition-colors">
          続きを読む →
        </span>
      )}
    </button>
  );
}

export interface PluginCardProps {
  plugin: Plugin;
  deleting: string | null;
  onToggle: (p: Plugin) => void;
  onUninstall: (p: Plugin) => void;
  onShowDetail: (p: Plugin) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function PluginCard({
  plugin,
  deleting,
  onToggle,
  onUninstall,
  onShowDetail,
  favorites,
  onToggleFavorite,
  t,
}: PluginCardProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const desc = cleanDescription(plugin.description);
  const lastUsed = formatLastUsed(plugin.last_used_at);
  const samplePrompts = extractSamplePrompts(plugin.usage_content, plugin.name);

  const handleCopyPrompt = (prompt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(prompt);
    setTimeout(() => setCopiedPrompt(null), 1500);
  };

  return (
    <div className="bg-th-surface-0 rounded-th p-4 border border-th-border hover:border-th-border-accent transition-all duration-150 flex flex-col gap-2">
      {/* ヘッダー行 */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-th-text truncate">{plugin.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-th-text-4 text-xs">v{plugin.version}</p>
            {(plugin.usage_count ?? 0) > 0 && (
              <span className="text-xs text-th-text-4 flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                {plugin.usage_count}回使用
                {lastUsed && <span className="text-th-text-4/60">・{lastUsed}</span>}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {plugin.enabled ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle(plugin)}
              className="text-th-warning bg-th-warning-dim hover:bg-th-warning-dim/80"
            >
              無効化
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle(plugin)}
              className="text-th-success bg-th-success-dim hover:bg-th-success-dim/80"
            >
              有効化
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => onUninstall(plugin)}
            disabled={deleting === plugin.id}
          >
            {deleting === plugin.id ? '...' : t('plugins.uninstall')}
          </Button>
        </div>
      </div>

      {/* trigger_type バッジ + コマンド */}
      <div className="flex items-center gap-2 flex-wrap">
        {plugin.trigger_type === 'auto' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-th-success-dim text-th-success border border-th-success/20 rounded-th-sm px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-th-success shrink-0" />
            自動起動
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-mono bg-th-accent-dim text-th-accent border border-th-accent/20 rounded-th-sm px-2 py-0.5 cursor-pointer hover:bg-th-accent/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              const cmd = `/${plugin.name.replace(/[^a-zA-Z0-9_-]/g, '')}`;
              navigator.clipboard.writeText(cmd);
              const el = e.currentTarget;
              const orig = el.textContent;
              el.textContent = 'コピーしました';
              setTimeout(() => { if (el.textContent === 'コピーしました') el.textContent = orig; }, 1200);
            }}
            title="クリックでコピー"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-th-accent shrink-0" />
            /{plugin.name.replace(/[^a-zA-Z0-9_-]/g, '')}
            <CopyIcon />
          </span>
        )}
      </div>

      {/* 説明文 */}
      {desc && (
        <DescriptionBlock desc={desc} onClick={() => onShowDetail(plugin)} />
      )}

      {/* サンプルプロンプト */}
      {samplePrompts.length > 0 && (
        <div className="space-y-1 border-t border-th-border/50 pt-2 mt-1">
          <p className="text-xs text-th-text-4">使い方の例 <span className="text-th-text-4/60">（クリックでコピー）</span></p>
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={(e) => handleCopyPrompt(prompt, e)}
              className="w-full text-left text-xs font-mono bg-th-surface-1 hover:bg-th-surface-2 text-th-text-3 hover:text-th-text px-2 py-1 rounded-th-sm transition-colors border border-th-border/50 truncate"
              title={prompt}
            >
              {copiedPrompt === prompt ? '✓ コピーしました' : `"${prompt}"`}
            </button>
          ))}
        </div>
      )}

      {/* 詳細・お気に入りボタン */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onShowDetail(plugin)}
          className="text-xs text-th-accent hover:text-th-accent/80 transition-colors"
        >
          使い方を見る →
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(plugin.id); }}
          aria-label={favorites.has(plugin.id) ? 'お気に入りから削除' : 'お気に入りに追加'}
          className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-th-sm text-xs transition-all duration-200 border ${
            favorites.has(plugin.id)
              ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
              : 'text-th-text-4 hover:text-amber-500 hover:bg-amber-500/10 border-transparent'
          }`}
          title={favorites.has(plugin.id) ? 'お気に入りから削除' : 'お気に入りに追加'}
        >
          <StarIcon filled={favorites.has(plugin.id)} />
        </button>
      </div>
    </div>
  );
}

export type { Plugin };
