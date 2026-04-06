import { useState, useEffect } from 'react';
import { useTranslation } from '@maestro/i18n';
import { Check, Copy, Database } from 'lucide-react';
import api from '../../lib/api.ts';

interface ClaudeIntegrationData {
  dbUrl: string;
  apiUrl: string;
  mcpConfig: Record<string, unknown>;
}

export default function ClaudeIntegrationSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<ClaudeIntegrationData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/settings/claude-integration')
      .then((res: { data: { data: ClaudeIntegrationData } }) => setData(res.data.data))
      .catch(() => {});
  }, []);

  const snippet = data
    ? JSON.stringify(data.mcpConfig, null, 2)
    : '';

  function handleCopy() {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-th-accent" />
        <h2 className="text-lg font-bold">{t('settings.claudeIntegration.title')}</h2>
      </div>
      <p className="text-sm text-th-text-3">{t('settings.claudeIntegration.description')}</p>

      {data && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-th-text-3 uppercase tracking-wide">
              {t('settings.claudeIntegration.mcpConfigLabel')}
            </p>
            <div className="relative">
              <pre className="bg-th-surface-1 rounded-th-sm p-3 text-xs font-mono text-th-text overflow-x-auto border border-th-border">
                {snippet}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-th-sm bg-th-surface-0 border border-th-border text-th-text-3 hover:text-th-text hover:bg-th-surface-1 transition-colors"
                title={t('common.copy')}
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-th-success" />
                  : <Copy className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </div>

          <div className="bg-th-surface-1 rounded-th-sm px-3 py-2 border border-th-border text-xs text-th-text-3 space-y-1">
            <p className="font-medium text-th-text-2">{t('settings.claudeIntegration.steps')}</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>{t('settings.claudeIntegration.step1')}</li>
              <li>{t('settings.claudeIntegration.step2')}</li>
              <li>{t('settings.claudeIntegration.step3')}</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
