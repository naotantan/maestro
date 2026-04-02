import { useState } from 'react';
import { useTranslation } from '@company/i18n';
import i18n from '@company/i18n';
import api from '../../lib/api.ts';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState(i18n.language || 'ja');
  const [message, setMessage] = useState('');

  const handleSaveApiKey = async () => {
    try {
      await api.post('/settings/api-key', { apiKey });
      setMessage(t('settings.saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage(t('errors.serverError'));
    }
  };

  const handleSaveLanguage = async () => {
    try {
      await i18n.changeLanguage(language);
      localStorage.setItem('language', language);
      await api.post('/settings/language', { language });
      setMessage(t('settings.saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage(t('errors.serverError'));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      {message && (
        <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-2 rounded">
          {message}
        </div>
      )}

      {/* APIキー設定 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-4">{t('settings.apiKeys')}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.apiKeyName')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('settings.newApiKey')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            />
          </div>
          <button
            onClick={handleSaveApiKey}
            className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium"
          >
            {t('common.save')}
          </button>
        </div>
      </div>

      {/* 言語設定 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold mb-4">{t('settings.language')}</h2>
        <div className="space-y-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
          >
            <option value="ja">{t('settings.languageJa')}</option>
            <option value="en">{t('settings.languageEn')}</option>
          </select>
          <button
            onClick={handleSaveLanguage}
            className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
