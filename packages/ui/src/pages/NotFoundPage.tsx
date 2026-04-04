import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@maestro/i18n';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent mb-2">
            404
          </h1>
          <p className="text-slate-400 text-lg">{t('errors.notFound')}</p>
        </div>

        <p className="text-slate-400 mb-8">
          {t('errors.notFoundMessage')}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => navigate('/')}
            className="w-full"
          >
            {t('errors.goHome')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full"
          >
            {t('layout.goBack')}
          </Button>
        </div>

        <div className="mt-12 text-6xl opacity-20">🚀</div>
      </div>
    </div>
  );
}
