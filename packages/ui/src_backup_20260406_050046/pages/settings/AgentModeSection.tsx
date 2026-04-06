import { useTranslation } from '@maestro/i18n';

interface AgentModeSectionProps {
  defaultAgentType: 'claude_local' | 'claude_api';
  onAgentTypeChange: (type: 'claude_local' | 'claude_api') => void;
  anthropicApiKey: string;
  onApiKeyChange: (key: string) => void;
  hasApiKey: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function AgentModeSection({
  defaultAgentType,
  onAgentTypeChange,
  anthropicApiKey,
  onApiKeyChange,
  hasApiKey,
  saving,
  onSave,
}: AgentModeSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t('settings.agentMode')}</h2>
        <p className="text-sm text-th-text-3 mt-1">{t('settings.agentModeDesc')}</p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label={t('settings.agentMode')}>
        {/* claude_local */}
        <label className={`flex items-start gap-3 p-4 rounded-th-md border cursor-pointer transition-colors ${
          defaultAgentType === 'claude_local'
            ? 'border-th-border-accent bg-th-accent-dim'
            : 'border-th-border-strong hover:border-th-border'
        }`}>
          <input
            type="radio"
            name="agentType"
            value="claude_local"
            checked={defaultAgentType === 'claude_local'}
            onChange={() => onAgentTypeChange('claude_local')}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium">{t('settings.agentModeSubscription')}</div>
            <div className="text-sm text-th-text-3 mt-0.5">{t('settings.agentModeSubscriptionDesc')}</div>
          </div>
        </label>

        {/* claude_api */}
        <label className={`flex items-start gap-3 p-4 rounded-th-md border cursor-pointer transition-colors ${
          defaultAgentType === 'claude_api'
            ? 'border-th-border-accent bg-th-accent-dim'
            : 'border-th-border-strong hover:border-th-border'
        }`}>
          <input
            type="radio"
            name="agentType"
            value="claude_api"
            checked={defaultAgentType === 'claude_api'}
            onChange={() => onAgentTypeChange('claude_api')}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium">{t('settings.agentModeApi')}</div>
            <div className="text-sm text-th-text-3 mt-0.5">{t('settings.agentModeApiDesc')}</div>
          </div>
        </label>
      </div>

      {/* Anthropic API key (shown only when claude_api is selected) */}
      {defaultAgentType === 'claude_api' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('settings.anthropicApiKey')}</label>
          {hasApiKey && !anthropicApiKey && (
            <p className="text-xs text-th-text-3">{t('settings.anthropicApiKeySet')}</p>
          )}
          <input
            type="password"
            value={anthropicApiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={hasApiKey ? '••••••••••••' : t('settings.anthropicApiKeyPlaceholder')}
            aria-label={t('settings.anthropicApiKey')}
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text placeholder-th-text-4"
          />
        </div>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        aria-label={t('settings.agentMode') + ' - ' + t('common.save')}
        className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 px-4 py-2 rounded-th-md font-medium transition-colors"
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}
