import { useTranslation } from '@company/i18n';
import { EmptyState } from '../components/ui';

export default function InboxPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t('inbox.title')}</h1>
      <EmptyState
        icon="📭"
        title={t('inbox.notAvailable')}
        description={t('inbox.notAvailableDescription')}
      />
    </div>
  );
}
