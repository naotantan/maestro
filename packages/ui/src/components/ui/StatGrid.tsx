import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Stat {
  label: string;
  value: string | number;
  change?: string | number;
  changeType?: 'up' | 'down';
  icon?: React.ReactNode;
}

interface StatGridProps {
  stats: Stat[];
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {stat.label}
            </span>
            {stat.icon && (
              <span
                style={{
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {stat.icon}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1,
            }}
          >
            {stat.value}
          </div>

          {stat.change !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color:
                  stat.changeType === 'up'
                    ? 'var(--color-success)'
                    : stat.changeType === 'down'
                    ? 'var(--color-danger)'
                    : 'var(--color-text-3)',
              }}
            >
              {stat.changeType === 'up' && <TrendingUp size={13} />}
              {stat.changeType === 'down' && <TrendingDown size={13} />}
              <span>{stat.change}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
