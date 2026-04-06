import { useTranslation } from '@maestro/i18n';

interface OrgSectionProps {
  orgName: string;
  onOrgNameChange: (name: string) => void;
  orgDescription: string;
  onOrgDescriptionChange: (description: string) => void;
  saving: boolean;
  onSave: () => void;
}

export default function OrgSection({
  orgName,
  onOrgNameChange,
  orgDescription,
  onOrgDescriptionChange,
  saving,
  onSave,
}: OrgSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-4">
      <h2 className="text-lg font-bold">{t('settings.orgInfo')}</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.orgName')}</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.orgDescription')}</label>
          <textarea
            value={orgDescription}
            onChange={(e) => onOrgDescriptionChange(e.target.value)}
            rows={3}
            className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text resize-none"
          />
        </div>
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        aria-label={t('settings.orgInfo') + ' - ' + t('common.save')}
        className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 px-4 py-2 rounded-th-md font-medium transition-colors"
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}
