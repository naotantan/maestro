import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../../lib/api.ts';

interface Plugin {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string;
}

export default function PluginsPage() {
  const [newPluginUrl, setNewPluginUrl] = useState('');
  const { data: plugins, isLoading, error } = useQuery<Plugin[]>(
    'plugins',
    () => api.get('/plugins').then((r) => r.data),
  );

  const handleInstall = async () => {
    if (!newPluginUrl.trim()) return;
    await api.post('/plugins/install', { url: newPluginUrl });
    setNewPluginUrl('');
  };

  if (isLoading) return <div className="p-6">読み込み中...</div>;
  if (error) return <div className="p-6 text-red-400">エラーが発生しました</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">プラグイン</h1>

      {/* インストールフォーム */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">プラグインをインストール</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPluginUrl}
            onChange={(e) => setNewPluginUrl(e.target.value)}
            placeholder="プラグインURL..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
          />
          <button
            onClick={handleInstall}
            className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
          >
            インストール
          </button>
        </div>
      </div>

      {/* プラグイン一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plugins && plugins.length > 0 ? (
          plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <h3 className="text-lg font-bold">{plugin.name}</h3>
              <p className="text-slate-400 text-sm mb-2">v{plugin.version}</p>
              <p className="text-slate-300 text-sm mb-3">{plugin.description}</p>
              <span
                className={`inline-block px-2 py-1 rounded text-xs ${
                  plugin.status === 'enabled'
                    ? 'bg-green-900 text-green-200'
                    : 'bg-gray-900 text-gray-200'
                }`}
              >
                {plugin.status === 'enabled' ? '有効' : '無効'}
              </span>
            </div>
          ))
        ) : (
          <p className="text-slate-400">プラグインはインストールされていません</p>
        )}
      </div>
    </div>
  );
}
