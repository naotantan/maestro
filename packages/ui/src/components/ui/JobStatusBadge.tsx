import React from 'react';

export type JobStatus = 'running' | 'completed' | 'failed' | 'pending' | 'cancelled';

interface JobStatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const statusConfig: Record<
  JobStatus,
  { label: string; bg: string; color: string; border: string; pulse?: boolean }
> = {
  running: {
    label: 'Running',
    bg: 'var(--color-primary-dim)',
    color: 'var(--color-primary)',
    border: 'rgba(83,58,253,0.2)',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    bg: 'var(--color-success-dim)',
    color: 'var(--color-success)',
    border: 'rgba(0,168,90,0.2)',
  },
  failed: {
    label: 'Failed',
    bg: 'var(--color-danger-dim)',
    color: 'var(--color-danger)',
    border: 'rgba(239,68,68,0.2)',
  },
  pending: {
    label: 'Pending',
    bg: 'var(--color-warning-dim)',
    color: 'var(--color-warning)',
    border: 'rgba(245,158,11,0.2)',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'var(--color-bg-3)',
    color: 'var(--color-text-3)',
    border: 'var(--color-border)',
  },
};

export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const cfg = statusConfig[status];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px 2px 6px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        letterSpacing: '0.02em',
      }}
    >
      {cfg.pulse ? (
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            width: '7px',
            height: '7px',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: cfg.color,
              opacity: 0.4,
              animation: 'job-status-ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
            }}
          />
          <span
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: cfg.color,
            }}
          />
          <style>{`
            @keyframes job-status-ping {
              75%, 100% { transform: scale(2); opacity: 0; }
            }
          `}</style>
        </span>
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: cfg.color,
            opacity: 0.8,
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}
