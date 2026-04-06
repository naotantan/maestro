import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hoverable, selected, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-[#faf9f5] border border-[#f0eee6] rounded-th',
        'shadow-[rgba(0,0,0,0.05)_0px_4px_24px]',
        'transition-all duration-150',
        hoverable && 'cursor-pointer hover:shadow-[rgba(0,0,0,0.08)_0px_8px_32px] hover:border-[#e8e6dc] hover:-translate-y-px',
        selected && 'border-[#c96442] shadow-[0px_0px_0px_1px_rgba(201,100,66,0.3)]',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 pt-4 pb-3 border-b border-th-border', className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('p-5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 py-3 border-t border-th-border bg-[#f0eee6] rounded-b-th', className)}>
      {children}
    </div>
  );
}
