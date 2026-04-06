import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:  'bg-[#f0eee6] text-[#5e5d59] border border-[#e8e6dc]',
  success:  'bg-th-success-dim text-th-success border border-th-success/15',
  warning:  'bg-th-warning-dim text-th-warning border border-th-warning/15',
  danger:   'bg-[rgba(181,51,51,0.12)] text-[#b53333] border border-[rgba(181,51,51,0.15)]',
  info:     'bg-[rgba(56,152,236,0.12)] text-[#3898ec] border border-[rgba(56,152,236,0.15)]',
  pending:  'bg-th-warning-dim text-th-warning border border-th-warning/15',
  accent:   'bg-[rgba(201,100,66,0.12)] text-[#c96442] border border-[rgba(201,100,66,0.15)]',
};

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap',
      variantStyles[variant],
      className
    )}>
      {dot && (
        <span className={clsx(
          'h-1.5 w-1.5 rounded-full flex-shrink-0',
          variant === 'success' && 'bg-th-success',
          variant === 'warning' && 'bg-th-warning',
          variant === 'pending' && 'bg-th-warning',
          variant === 'danger' && 'bg-th-danger',
          variant === 'info' && 'bg-th-info',
          variant === 'accent' && 'bg-th-accent',
          (variant === 'default') && 'bg-th-text-3',
        )} />
      )}
      {children}
    </span>
  );
}
