import React from 'react';
import { FileCode, Clock } from 'lucide-react';

interface Session {
  id: string;
  headline: string;
  summary: string;
  changed_files: number;
  session_started_at: string;
  session_ended_at: string;
}

interface SessionCardProps {
  session: Session;
  accentColor?: string;
  onClick?: () => void;
}

function formatDuration(start: string, end: string): string {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (isNaN(startMs) || isNaN(endMs)) return '';
  const diffMin = Math.round((endMs - startMs) / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  if (isNaN(s.getTime())) return start;
  const dateStr = s.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
  const startTime = s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const e = new Date(end);
  const endTime = isNaN(e.getTime())
    ? ''
    : e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr} ${startTime}${endTime ? ` – ${endTime}` : ''}`;
}

export function SessionCard({
  session,
  accentColor = 'var(--color-primary)',
  onClick,
}: SessionCardProps) {
  const duration = formatDuration(session.session_started_at, session.session_ended_at);
  const dateRange = formatDateRange(session.session_started_at, session.session_ended_at);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow var(--transition-fast)',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-text-3)',
              marginBottom: '4px',
            }}
          >
            {dateRange}
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--color-text)',
              lineHeight: 1.3,
            }}
          >
            {session.headline}
          </div>
        </div>
        {duration && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--color-text-3)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={11} />
            {duration}
          </div>
        )}
      </div>

      {/* Meta badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-bg-2)',
            color: 'var(--color-text-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <FileCode size={11} />
          {session.changed_files} files changed
        </span>
      </div>

      {/* Summary */}
      <p
        style={{
          fontSize: '12px',
          color: 'var(--color-text-2)',
          lineHeight: 1.6,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {session.summary}
      </p>
    </div>
  );
}
