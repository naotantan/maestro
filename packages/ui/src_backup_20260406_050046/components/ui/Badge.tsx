import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'pending';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-th-surface-2 text-th-text-2 border border-th-border',
    success: 'bg-th-success-dim text-th-success border border-th-success/20',
    warning: 'bg-th-warning-dim text-th-warning border border-th-warning/20',
    danger: 'bg-th-danger-dim text-th-danger border border-th-danger/20',
    info: 'bg-th-accent-dim text-th-accent border border-th-accent/20',
    pending: 'bg-th-warning-dim text-th-warning border border-th-warning/20',
  };

  return (
    <span
      className={clsx(
        'inline-flex px-2 py-0.5 rounded-th-sm text-[11px] font-medium tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
