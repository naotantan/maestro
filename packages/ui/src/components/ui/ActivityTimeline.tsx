import React from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';

type ActivityAction = 'create' | 'update' | 'delete' | 'complete';

interface Activity {
  id: string;
  action: ActivityAction;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, unknown>;
  created_at: string;
  company_id?: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

const actionConfig: Record<
  ActivityAction,
  { icon: React.ReactNode; label: string; bg: string; color: string }
> = {
  create: {
    icon: <Plus size={12} />,
    label: 'Created',
    bg: 'var(--color-primary-dim)',
    color: 'var(--color-primary)',
  },
  update: {
    icon: <Edit2 size={12} />,
    label: 'Updated',
    bg: 'var(--color-info-dim)',
    color: 'var(--color-info)',
  },
  delete: {
    icon: <Trash2 size={12} />,
    label: 'Deleted',
    bg: 'var(--color-danger-dim)',
    color: 'var(--color-danger)',
  },
  complete: {
    icon: <Check size={12} />,
    label: 'Completed',
    bg: 'var(--color-success-dim)',
    color: 'var(--color-success)',
  },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function buildDescription(activity: Activity): React.ReactNode {
  const entityLabel = activity.entity_type.charAt(0).toUpperCase() + activity.entity_type.slice(1);
  const cfg = actionConfig[activity.action] ?? actionConfig.update;

  return (
    <>
      {cfg.label} {entityLabel}{' '}
      <strong style={{ color: 'var(--color-text)' }}>{activity.entity_id}</strong>
      {activity.changes && Object.keys(activity.changes).length > 0 && (
        <span style={{ color: 'var(--color-text-3)' }}>
          {' '}— {Object.keys(activity.changes).join(', ')}
        </span>
      )}
    </>
  );
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--color-text-3)',
          fontSize: '13px',
        }}
      >
        No activity yet.
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {activities.map((activity, i) => {
        const cfg = actionConfig[activity.action] ?? actionConfig.update;
        const isLast = i === activities.length - 1;

        return (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: '12px var(--space-5)',
              borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            {/* Timestamp */}
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-3)',
                width: '56px',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {formatRelativeTime(activity.created_at)}
            </span>

            {/* Action icon badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-sm)',
                background: cfg.bg,
                color: cfg.color,
                flexShrink: 0,
              }}
            >
              {cfg.icon}
            </span>

            {/* Description */}
            <span
              style={{
                fontSize: '13px',
                color: 'var(--color-text-2)',
                flex: 1,
                lineHeight: 1.4,
              }}
            >
              {buildDescription(activity)}
            </span>

            {/* Entity type chip */}
            <span
              style={{
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-2)',
                color: 'var(--color-text-3)',
                border: '1px solid var(--color-border)',
                flexShrink: 0,
                textTransform: 'capitalize',
                letterSpacing: '0.03em',
              }}
            >
              {activity.entity_type}
            </span>
          </div>
        );
      })}
    </div>
  );
}
