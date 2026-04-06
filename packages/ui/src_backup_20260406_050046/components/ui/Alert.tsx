import { clsx } from 'clsx';
import { useTranslation } from '@maestro/i18n';

type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  onClose?: () => void;
  icon?: React.ReactNode;
}

export function Alert({
  variant = 'info',
  title,
  message,
  onClose,
  icon,
}: AlertProps) {
  const { t } = useTranslation();
  const variants: Record<AlertVariant, string> = {
    success: 'bg-th-success-dim border-th-success/20 text-th-success',
    warning: 'bg-th-warning-dim border-th-warning/20 text-th-warning',
    danger: 'bg-th-danger-dim border-th-danger/20 text-th-danger',
    info: 'bg-th-accent-dim border-th-accent/20 text-th-accent',
  };

  const iconMap = { success: '✓', warning: '⚠', danger: '✕', info: 'ℹ' };

  return (
    <div className={clsx('flex gap-3 rounded-th-md border px-4 py-3', variants[variant])} role="alert">
      <span className="flex-shrink-0 text-base" aria-hidden="true">{icon || iconMap[variant]}</span>
      <div className="flex-1">
        {title && <h4 className="font-semibold text-sm">{title}</h4>}
        <p className="text-sm">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 hover:opacity-70 transition-opacity" aria-label={t('common.close')}>✕</button>
      )}
    </div>
  );
}
