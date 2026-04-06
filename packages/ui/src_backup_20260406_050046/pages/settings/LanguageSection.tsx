import { useTranslation } from '@maestro/i18n';

interface LanguageSectionProps {
  language: string;
  onLanguageChange: (language: string) => void;
  saving: boolean;
  onSave: () => void;
}

export default function LanguageSection({
  language,
  onLanguageChange,
  saving,
  onSave,
}: LanguageSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-th-surface-0 rounded-th-md p-6 border border-th-border space-y-3">
      <h2 className="text-lg font-bold">{t('settings.language')}</h2>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        aria-label={t('settings.language')}
        className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2 text-th-text"
      >
        <option value="ja">{t('settings.languageJa')}</option>
        <option value="en">{t('settings.languageEn')}</option>
      </select>
      <button
        onClick={onSave}
        disabled={saving}
        aria-label={t('settings.language') + ' - ' + t('common.save')}
        className="bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 px-4 py-2 rounded-th-md font-medium transition-colors"
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}
