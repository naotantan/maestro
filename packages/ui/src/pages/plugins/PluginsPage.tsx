import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';
import { Alert, LoadingSpinner } from '../../components/ui';

// GET /api/plugins のレスポンス型
interface Plugin {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  repository_url?: string;
  version: string;
  enabled: boolean; // P-2修正: status: string → enabled: boolean
  created_at: string;
  updated_at: string;
}

export default function PluginsPage() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const queryClient = useQueryClient();

  // P-3修正: r.data → r.data.data
  const { data: plugins, isLoading, error } = useQuery<Plugin[]>(
    'plugins',
    () => api.get('/plugins').then((r) => r.data.data),
  );

  // P-1修正: 存在しないエンドポイントを削除し、POST /plugins に変更（name必須 + repository_url任意）
  // P-4修正: name + repository_url の作成フォームに変更
  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.post('/plugins', {
      name: newName.trim(),
      ...(newRepositoryUrl.trim() ? { repository_url: newRepositoryUrl.trim() } : {}),
    });
    setNewName('');
    setNewRepositoryUrl('');
    setShowCreate(false);
    queryClient.invalidateQueries('plugins');
  };

  // P-5修正: enabled/disabled 切り替え → PATCH /plugins/:id { is_active: boolean }
  const handleToggleEnabled = async (plugin: Plugin) => {
    await api.patch(`/plugins/${plugin.id}`, { is_active: !plugin.enabled });
    queryClient.invalidateQueries('plugins');
  };

  if (isLoading) return <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('plugins.fetchError')} /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('plugins.title')}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
        >
          {t('plugins.newPlugin')}
        </button>
      </div>

      {/* 新規作成フォーム（name必須 + repository_url任意）*/}
      {showCreate && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <h2 className="text-sm font-bold">{t('plugins.createPlugin')}</h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('plugins.pluginNamePlaceholder')}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
          />
          <input
            type="text"
            value={newRepositoryUrl}
            onChange={(e) => setNewRepositoryUrl(e.target.value)}
            placeholder={t('plugins.repositoryUrlPlaceholder')}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
            >
              {t('common.create')}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewRepositoryUrl(''); }}
              className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded text-sm font-medium"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* プラグイン一覧 */}
      {(plugins ?? []).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(plugins ?? []).map((plugin) => (
            <div
              key={plugin.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold">{plugin.name}</h3>
                  <p className="text-slate-400 text-xs">v{plugin.version}</p>
                </div>
                {/* P-5修正: enabled/disabled 切り替えボタン */}
                <button
                  onClick={() => handleToggleEnabled(plugin)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    plugin.enabled
                      ? 'bg-green-700 hover:bg-green-800 text-green-100'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                  }`}
                >
                  {plugin.enabled ? t('plugins.enabled') : t('plugins.disabled')}
                </button>
              </div>
              {plugin.description && (
                <p className="text-slate-300 text-sm mb-2">{plugin.description}</p>
              )}
              {plugin.repository_url && (
                <p className="text-slate-500 text-xs truncate">{plugin.repository_url}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400">{t('plugins.noPluginsInstalled')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
          >
            {t('plugins.createFirst')}
          </button>
        </div>
      )}
    </div>
  );
}
