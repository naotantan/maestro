import { useTranslation } from '@maestro/i18n';
import ThemeSection from './ThemeSection.tsx';
import AgentModeSection from './AgentModeSection.tsx';
import OrgSection from './OrgSection.tsx';
import LanguageSection from './LanguageSection.tsx';
import BackupSection from './BackupSection.tsx';
import ClaudeIntegrationSection from './ClaudeIntegrationSection.tsx';
import useSettings from './useSettings.ts';

export default function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettings();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      {settings.message && (
        <div className={`px-4 py-2 rounded-th-md border ${
          settings.message.type === 'success'
            ? 'bg-th-success-dim border-th-border text-th-success'
            : 'bg-th-danger-dim border-th-border text-th-danger'
        }`}>
          {settings.message.text}
        </div>
      )}

      <ThemeSection />

      <AgentModeSection
        defaultAgentType={settings.defaultAgentType}
        onAgentTypeChange={settings.setDefaultAgentType}
        anthropicApiKey={settings.anthropicApiKey}
        onApiKeyChange={settings.setAnthropicApiKey}
        hasApiKey={settings.hasApiKey}
        saving={settings.saving === 'agentMode'}
        onSave={settings.handleSaveAgentMode}
      />

      <OrgSection
        orgName={settings.orgName}
        onOrgNameChange={settings.setOrgName}
        orgDescription={settings.orgDescription}
        onOrgDescriptionChange={settings.setOrgDescription}
        saving={settings.saving === 'org'}
        onSave={settings.handleSaveOrg}
      />

      <LanguageSection
        language={settings.language}
        onLanguageChange={settings.setLanguage}
        saving={settings.saving === 'language'}
        onSave={settings.handleSaveLanguage}
      />

      <BackupSection
        backup={settings.backup}
        onBackupChange={settings.handleBackupChange}
        saving={settings.saving === 'backup'}
        onSave={settings.handleSaveBackup}
        running={settings.running}
        onRunNow={settings.handleRunBackup}
        gdriveRefreshKey={settings.gdriveRefreshKey}
      />

      <ClaudeIntegrationSection />

      {/* スキル統計リセット */}
      <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('plugins.resetUsageStats')}</h2>
          <p className="text-sm text-th-text-3 mt-1">{t('plugins.resetUsageStatsConfirm').replace('よろしいですか？', '')}</p>
        </div>
        <button
          onClick={settings.handleResetSkillUsage}
          disabled={settings.saving === 'resetSkillUsage'}
          className="bg-th-danger hover:bg-th-danger/80 disabled:opacity-50 text-white px-4 py-2 rounded-th-md font-medium transition-colors text-sm"
        >
          {settings.saving === 'resetSkillUsage' ? t('common.loading') : t('plugins.resetUsageStats')}
        </button>
      </div>

    </div>
  );
}
