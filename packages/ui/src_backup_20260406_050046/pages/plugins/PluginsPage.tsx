import { useState, useCallback } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import { Alert, Button, Card, LoadingSpinner } from '../../components/ui';
import { PluginCard, StarIcon, type Plugin } from './PluginCard.tsx';
import { PluginDetailModal } from './PluginDetailModal.tsx';
import { usePluginActions } from './usePluginActions.ts';
import api from '../../lib/api.ts';

const ALL_CATEGORY = 'すべて';
const FAVORITES_TAB = 'お気に入り';

/** localStorageでお気に入りスキルIDを管理するhook */
function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('plugin_favorites');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      try { localStorage.setItem('plugin_favorites', JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

const RefreshIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const CategoryIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h8M4 18h12" />
  </svg>
);

const SyncIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2v6h-6M3 22v-6h6M21 13a9 9 0 01-15.36 6.36M3 11A9 9 0 0118.36 4.64" />
  </svg>
);

/** コピー可能なプロンプト表示 */
function CopyablePrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs font-mono bg-th-surface-2 hover:bg-th-surface-3 text-th-text-2 px-2 py-1 rounded-th-sm transition-colors border border-th-border"
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      <span>{copied ? 'コピーしました' : prompt}</span>
    </button>
  );
}

interface PluginGridProps {
  plugins: Plugin[];
  deleting: string | null;
  onToggle: (p: Plugin) => void;
  onUninstall: (p: Plugin) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function PluginGrid({ plugins, deleting, onToggle, onUninstall, favorites, onToggleFavorite, t }: PluginGridProps) {
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            deleting={deleting}
            onToggle={onToggle}
            onUninstall={onUninstall}
            onShowDetail={setDetailPlugin}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            t={t}
          />
        ))}
      </div>

      {detailPlugin && (
        <PluginDetailModal
          plugin={detailPlugin}
          onClose={() => setDetailPlugin(null)}
        />
      )}
    </>
  );
}

export default function PluginsPage() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const { favorites, toggleFavorite } = useFavorites();

  const {
    busyOp,
    actionError,
    syncResult,
    deleting,
    installResult,
    setActionError,
    setSyncResult,
    setInstallResult,
    handleCreate,
    handleSync,
    handleUpdateAllRepos,
    handleFetchUsage,
    handleCategorize,
    handleTranslateUsage,
    handleToggleEnabled,
    handleUninstall,
  } = usePluginActions();

  const { data: plugins, isLoading, error } = useQuery<Plugin[]>(
    'plugins',
    () => api.get('/plugins').then((r) => r.data.data),
  );

  const categories = [
    ALL_CATEGORY,
    ...Array.from(new Set((plugins ?? []).map((p) => p.category ?? 'その他'))).sort(),
  ];

  const filtered = (plugins ?? []).filter((p) => {
    if (selectedCategory === FAVORITES_TAB) return favorites.has(p.id);
    if (selectedCategory === ALL_CATEGORY) return true;
    return (p.category ?? 'その他') === selectedCategory;
  });

  const grouped: Record<string, Plugin[]> = {};
  if (selectedCategory === ALL_CATEGORY) {
    for (const p of filtered) {
      const cat = p.category ?? 'その他';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
  }
  const groupKeys = Object.keys(grouped).sort();

  const onInstallSuccess = () => {
    setNewRepositoryUrl('');
    setShowCreate(false);
  };

  if (isLoading) return <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('plugins.fetchError')} /></div>;

  return (
    <div className="p-6 space-y-5">
      {actionError && <Alert variant="danger" message={actionError} onClose={() => setActionError('')} />}

      {syncResult && (
        <div className="bg-th-success-dim border border-th-success/20 rounded-th-md px-4 py-3 text-th-success text-sm">
          {syncResult}
          <button
            onClick={() => setSyncResult('')}
            aria-label="閉じる"
            className="ml-2 text-th-success/60 hover:text-th-success"
          >
            ✕
          </button>
        </div>
      )}

      {/* インストール完了プレビューカード */}
      {installResult && (
        <div className="bg-th-surface-0 border border-th-accent/30 rounded-th-md p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-th-success text-lg">✓</span>
                <h2 className="font-semibold text-th-text">
                  {installResult.imported}件のスキルをインストールしました
                </h2>
              </div>
              <p className="text-th-text-4 text-xs">{installResult.repo}</p>
            </div>
            <button
              onClick={() => setInstallResult(null)}
              aria-label="閉じる"
              className="text-th-text-3 hover:text-th-text text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {installResult.designCount > 0 && (
            <div className="bg-th-accent-dim border border-th-accent/20 rounded-th-sm px-3 py-2 text-sm text-th-accent">
              🎨 {installResult.designCount}種類のデザインガイドが使えるようになりました
            </div>
          )}

          <div className="space-y-2">
            {installResult.skillDetails.map((skill) => (
              <div key={skill.name} className="bg-th-surface-1 rounded-th-sm p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-th-accent-dim text-th-accent px-2 py-0.5 rounded-th-sm border border-th-accent/20">
                    {skill.name}
                  </span>
                  {skill.isDesign && <span className="text-xs text-th-text-4">デザインコレクション</span>}
                </div>
                <p className="text-xs text-th-text-3">{skill.description}</p>
                {skill.samplePrompt && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-th-text-4">例:</span>
                    <CopyablePrompt prompt={skill.samplePrompt} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-th-text-4">
            スキルカードの「使い方」をクリックするとサンプルプロンプトをコピーできます
          </p>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-th-text">{t('plugins.title')}</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* 管理アクション群 */}
          <div className="flex items-center gap-1.5 border border-th-border rounded-th-md p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateAllRepos}
              loading={busyOp === 'update'}
              disabled={busyOp !== null && busyOp !== 'update'}
              icon={<RefreshIcon />}
              title="登録済みの全スキルリポジトリを今すぐ更新してDBに同期"
            >
              スキル更新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFetchUsage}
              loading={busyOp === 'fetchUsage'}
              disabled={busyOp !== null && busyOp !== 'fetchUsage'}
              icon={<EditIcon />}
            >
              使い方取得
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCategorize}
              loading={busyOp === 'categorize'}
              disabled={busyOp !== null && busyOp !== 'categorize'}
              icon={<CategoryIcon />}
            >
              カテゴリ分類
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslateUsage}
              loading={busyOp === 'translate'}
              disabled={busyOp !== null && busyOp !== 'translate'}
              icon={<EditIcon />}
            >
              使い方翻訳
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              loading={busyOp === 'sync'}
              disabled={busyOp !== null && busyOp !== 'sync'}
              icon={<SyncIcon />}
            >
              スキル同期
            </Button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreate(true)}
          >
            {t('plugins.newPlugin')}
          </Button>
        </div>
      </div>

      {/* 新規作成フォーム */}
      {showCreate && (
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-th-text">スキルをインストール</h2>
          <input
            type="text"
            value={newRepositoryUrl}
            onChange={(e) => setNewRepositoryUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(newRepositoryUrl, onInstallSuccess)}
            placeholder="GitHubリポジトリURL（例: https://github.com/owner/repo）"
            className="w-full bg-th-surface-1 border border-th-border rounded-th-sm px-3 py-2 text-th-text text-sm placeholder:text-th-text-4 focus:outline-none focus:ring-2 focus:ring-th-accent focus:border-transparent"
            autoFocus
          />
          <p className="text-th-text-4 text-xs">GitHubのURLを入力するとスキルを自動インストールします。SKILL.md がなくてもREADMEから自動認識します。</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleCreate(newRepositoryUrl, onInstallSuccess)}
              disabled={!newRepositoryUrl.trim() || busyOp !== null}
              loading={busyOp === 'install'}
            >
              インストール
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setShowCreate(false); setNewRepositoryUrl(''); }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* カテゴリタブ */}
      {(plugins ?? []).length > 0 && (
        <div className="flex gap-2 flex-wrap border-b border-th-border pb-3">
          {/* お気に入りタブ（先頭） */}
          <button
            onClick={() => setSelectedCategory(FAVORITES_TAB)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === FAVORITES_TAB
                ? 'bg-amber-500 text-white'
                : 'bg-th-surface-1 hover:bg-th-surface-2 text-amber-500'
            }`}
          >
            <StarIcon filled={selectedCategory === FAVORITES_TAB} />
            お気に入り
            <span className={`text-xs ${selectedCategory === FAVORITES_TAB ? 'text-white/70' : 'text-th-text-4'}`}>
              {favorites.size}
            </span>
          </button>

          {categories.map((cat) => {
            const count = cat === ALL_CATEGORY
              ? (plugins ?? []).length
              : (plugins ?? []).filter((p) => (p.category ?? 'その他') === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-th-accent text-white'
                    : 'bg-th-surface-1 hover:bg-th-surface-2 text-th-text-2'
                }`}
              >
                {cat}
                <span className={`ml-1.5 text-xs ${selectedCategory === cat ? 'text-white/70' : 'text-th-text-4'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* スキル一覧 */}
      {(plugins ?? []).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-th-text-3">{t('plugins.noPluginsInstalled')}</p>
          <Button
            variant="primary"
            size="md"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            {t('plugins.createFirst')}
          </Button>
        </div>
      ) : selectedCategory === ALL_CATEGORY ? (
        // グループ表示
        <div className="space-y-8">
          {groupKeys.map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-th-text">{cat}</h2>
                <span className="text-xs text-th-text-4 bg-th-surface-1 px-2 py-0.5 rounded-full">
                  {grouped[cat].length}
                </span>
              </div>
              <PluginGrid
                plugins={grouped[cat]}
                deleting={deleting}
                onToggle={handleToggleEnabled}
                onUninstall={handleUninstall}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                t={t}
              />
            </div>
          ))}
        </div>
      ) : (
        // フィルタ表示 / お気に入り
        <PluginGrid
          plugins={filtered}
          deleting={deleting}
          onToggle={handleToggleEnabled}
          onUninstall={handleUninstall}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          t={t}
        />
      )}
    </div>
  );
}
