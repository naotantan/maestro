import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-4 py-16 text-center', className)} role="status">
      {icon && <div className="text-4xl opacity-30" aria-hidden="true">{icon}</div>}
      <div>
        <h3 className="text-base font-semibold text-th-text-2">{title}</h3>
        {description && <p className="text-th-text-3 text-sm mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
