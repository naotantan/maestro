import React from 'react';
import { AlertCircle, ArrowUp, Minus } from 'lucide-react';

type Priority = 'high' | 'medium' | 'low';

interface KanbanItem {
  id: string;
  title: string;
  status?: string;
  priority?: Priority;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  items: KanbanItem[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
}

const priorityConfig: Record<Priority, { icon: React.ReactNode; color: string }> = {
  high: { icon: <ArrowUp size={11} />, color: 'var(--color-danger)' },
  medium: { icon: <Minus size={11} />, color: 'var(--color-warning)' },
  low: { icon: <ArrowUp size={11} style={{ transform: 'rotate(180deg)' }} />, color: 'var(--color-text-3)' },
};

function KanbanItemCard({ item }: { item: KanbanItem }) {
  const pri = item.priority ? priorityConfig[item.priority] : null;

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow var(--transition-fast)',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div
        style={{
          fontSize: '13px',
          color: 'var(--color-text)',
          lineHeight: 1.4,
          marginBottom: pri || item.status ? '8px' : 0,
        }}
      >
        {item.title}
      </div>

      {(pri || item.status) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {pri && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                color: pri.color,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {pri.icon}
              {item.priority}
            </span>
          )}
          {item.status && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--color-text-3)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-2)',
                border: '1px solid var(--color-border)',
                textTransform: 'capitalize',
              }}
            >
              {item.status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ columns }: KanbanBoardProps) {
  if (columns.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8)',
          color: 'var(--color-text-3)',
          fontSize: '13px',
          gap: 'var(--space-2)',
        }}
      >
        <AlertCircle size={14} />
        No columns defined.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
        gap: 'var(--space-4)',
        overflowX: 'auto',
      }}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minWidth: 0,
          }}
        >
          {/* Column header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: col.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text)',
                flex: 1,
              }}
            >
              {col.title}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-3)',
                background: 'var(--color-bg-3)',
                padding: '1px 7px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {col.items.length}
            </span>
          </div>

          {/* Items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              minHeight: '60px',
            }}
          >
            {col.items.length === 0 ? (
              <div
                style={{
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--color-text-3)',
                }}
              >
                No items
              </div>
            ) : (
              col.items.map((item) => <KanbanItemCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
