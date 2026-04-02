import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'pending';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    success: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50',
    warning: 'bg-amber-900/40 text-amber-300 border border-amber-700/50',
    danger: 'bg-red-900/40 text-red-300 border border-red-700/50',
    info: 'bg-sky-900/40 text-sky-300 border border-sky-700/50',
    pending: 'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  };

  return (
    <span
      className={clsx(
        'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
