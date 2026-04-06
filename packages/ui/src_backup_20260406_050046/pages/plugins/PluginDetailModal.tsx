import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '../../components/ui';
import { cleanDescription, extractSamplePrompts, formatLastUsed, CopyIcon } from './PluginCard.tsx';
import type { Plugin } from './PluginCard.tsx';

interface PluginDetailModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginDetailModal({ plugin, onClose }: PluginDetailModalProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const samplePrompts = extractSamplePrompts(plugin.usage_content, plugin.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-th-surface-0 border border-th-border rounded-th shadow-th-md w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between p-5 border-b border-th-border">
          <div>
            <h2 className="font-semibold text-base text-th-text">{plugin.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-th-text-4 text-xs">v{plugin.version}</p>
              {(plugin.usage_count ?? 0) > 0 && (
                <span className="text-xs text-th-text-4 flex items-center gap-1">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  {plugin.usage_count}回使用
                  {plugin.last_used_at && (
                    <span className="text-th-text-4/60">・最終: {formatLastUsed(plugin.last_used_at)}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-th-text-3 hover:text-th-text transition-colors text-xl leading-none ml-4"
          >
            ✕
          </button>
        </div>

        {/* 本文 */}
        <div className="overflow-auto p-5 space-y-4">
          {/* trigger type */}
          {plugin.trigger_type === 'auto' ? (
            <Badge variant="success" className="gap-1.5 text-sm px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-th-success" />
              このスキルは自動で動作します
            </Badge>
          ) : (
            <Badge variant="info" className="gap-1.5 text-sm px-3 py-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-th-accent" />
              /{plugin.name.replace(/[^a-zA-Z0-9_-]/g, '')} と入力して呼び出す
            </Badge>
          )}

          {/* 説明文 */}
          {cleanDescription(plugin.description) && (
            <div>
              <h3 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">説明</h3>
              <p className="text-th-text text-sm leading-relaxed">
                {cleanDescription(plugin.description)}
              </p>
            </div>
          )}

          {/* サンプルプロンプト */}
          {samplePrompts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">サンプルプロンプト</h3>
              <div className="space-y-1.5">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigator.clipboard.writeText(prompt);
                      setCopiedPrompt(prompt);
                      setTimeout(() => setCopiedPrompt(null), 1500);
                    }}
                    className="w-full text-left text-sm font-mono bg-th-surface-1 hover:bg-th-surface-2 text-th-text-2 px-3 py-2 rounded-th-sm transition-colors border border-th-border flex items-center gap-2"
                  >
                    <CopyIcon />
                    {copiedPrompt === prompt ? '✓ コピーしました' : prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 使い方 */}
          {plugin.usage_content && (
            <div>
              <h3 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">使い方</h3>
              <div className="prose prose-invert prose-sm max-w-none text-th-text-2">
                <ReactMarkdown>{plugin.usage_content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
