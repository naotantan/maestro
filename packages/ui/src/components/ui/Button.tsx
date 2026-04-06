import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-th-accent focus-visible:ring-offset-2 focus-visible:ring-offset-th-bg';

  const variants = {
    primary:
      'bg-[#c96442] text-[#faf9f5] hover:bg-[#b5532e] rounded-th-md shadow-none',
    secondary:
      'bg-[#e8e6dc] text-[#4d4c48] border-0 hover:bg-[#dddbd0] rounded-th-md shadow-[0px_0px_0px_1px_#d1cfc5]',
    danger:
      'bg-[#b53333] text-[#faf9f5] hover:bg-[#a02828] rounded-th-md',
    ghost:
      'text-[#5e5d59] border border-[#e8e6dc] hover:bg-[#f0eee6] hover:text-[#141413] rounded-th-md',
    success:
      'bg-th-success text-white hover:opacity-90 rounded-th-md',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
