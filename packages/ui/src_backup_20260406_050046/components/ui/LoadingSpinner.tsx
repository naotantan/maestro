import { useTranslation } from '@maestro/i18n';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ text, size = 'md' }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const resolvedText = text ?? t('common.loading');

  const sizeClasses = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-12 h-12' };
  const textSizeClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-label={t('common.loading')}>
      <svg className={`animate-spin text-th-accent ${sizeClasses[size]}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className={`text-th-text-3 ${textSizeClasses[size]}`}>{resolvedText}</span>
    </div>
  );
}
