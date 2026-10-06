'use client';

import { useEffect, useState } from 'react';
import { FileText, Search, Filter, ShieldCheck, UserRound, Clock, Activity, X } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { auditApi, type AuditLogEntry } from '../../../lib/audit-api';
import { Avatar } from '../../../components/Avatar';
import { useServerTable } from '../../../lib/use-data-table';
import { useDebounced } from '../../../lib/use-debounced';
import { DataTable, type Column } from '../../../components/ui/DataTable';

const ENTITY_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  User: UserRound,
  Product: Activity,
  Customer: UserRound,
  Document: FileText,
  Inventory: Activity,
};

function ActionBadge({ action }: { action: string }) {
  const actionLower = action.toLowerCase();

  let colorKey = 'accent';

  if (actionLower.includes('create')) colorKey = 'ok'
  else if (actionLower.includes('update')) colorKey = 'info';
  else if (actionLower.includes('delete') || actionLower.includes('deactivate')) colorKey = 'bad';
  else if (actionLower.includes('login')) colorKey = 'accent';

  const colors: Record<string, { bg: string; fg: string }> = {
    ok: { bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
    info: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
    bad: { bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
    accent: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  };

  return (
    <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: colors[colorKey].bg, color: colors[colorKey].fg }}>
      {action}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const filterStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

function Actor({ log, size }: { log: AuditLogEntry; size: number }) {
  return log.actor ? (
    <div className="flex items-center gap-2">
      <Avatar name={log.actor.name} avatar={log.actor.avatar} size={size} />
      <span className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {log.actor.name}
      </span>
    </div>
  ) : (
    <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
      System
    </span>
  );
}

export default function AuditPage() {
  const { hasPermission } = useAuth();
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  // The entity filter's options come from the entries seen so far. Remembering
  // them (instead of re-deriving from the filtered page) keeps every option
  // available after one is chosen.
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const debouncedAction = useDebounced(filterAction);

  // Newest first is the nature of a log; the server always returns it that way, so no column sorts.
  const table = useServerTable<AuditLogEntry>({
    fetcher: async (q) => {
      const result = await auditApi.list({
        page: Math.floor(q.offset / q.limit) + 1,
        limit: q.limit,
        action: debouncedAction || undefined,
        entityType: filterEntity || undefined,
      });
      return { items: result.data, total: result.pagination.total };
    },
    deps: [debouncedAction, filterEntity],
    defaultSort: { id: 'time', dir: 'desc' },
  });
  const { rows: logs } = table;

  useEffect(() => {
    if (!logs) return;
    setEntityTypes((prev) => {
      const next = new Set(prev);
      logs.forEach((l) => l.entityType && next.add(l.entityType));
      return next.size === prev.length ? prev : [...next].sort();
    });
  }, [logs]);

  if (!hasPermission('AUDIT')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  const filtersActive = !!(filterAction || filterEntity);
  const pretty = (log: AuditLogEntry) => (log.metadata ? JSON.stringify(log.metadata, null, 2) : '');
  const summary = (log: AuditLogEntry) => {
    const text = log.metadata ? JSON.stringify(log.metadata) : '';
    return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      id: 'time',
      header: 'Timestamp',
      cell: (log) => (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          <Clock size={13} strokeWidth={2} />
          {fmtDate(log.createdAt)}
        </div>
      ),
    },
    { id: 'user', header: 'User', cell: (log) => <Actor log={log} size={28} /> },
    { id: 'action', header: 'Action', cell: (log) => <ActionBadge action={log.action} /> },
    {
      id: 'entity',
      header: 'Entity',
      cell: (log) => {
        const EntityIcon = log.entityType ? (ENTITY_ICONS[log.entityType] ?? Activity) : Activity;
        return log.entityType ? (
          <div className="flex items-center gap-1.5">
            <EntityIcon size={14} strokeWidth={2} />
            <span className="text-sm" style={{ color: 'var(--color-ink-700)' }}>
              {log.entityType}
              {log.entityId && <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}> · {log.entityId.slice(0, 8)}</span>}
            </span>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}>—</span>
        );
      },
    },
    {
      id: 'details',
      header: 'Details',
      hideBelow: 'lg',
      cell: (log) =>
        log.metadata ? (
          <code className="block max-w-md truncate text-xs" title="Expand the row for the full entry" style={{ color: 'var(--color-ink-600)' }}>
            {summary(log)}
          </code>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}>—</span>
        ),
    },
  ];

  const renderCard = (log: AuditLogEntry) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Actor log={log} size={32} />
        <ActionBadge action={log.action} />
      </div>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
        <Clock size={12} strokeWidth={2} />
        {fmtDate(log.createdAt)}
      </div>
      {log.entityType && (
        <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {log.entityType}
          {log.entityId && ` · ${log.entityId.slice(0, 8)}`}
        </p>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Audit Trail
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            System activity log — who did what and when.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex items-center">
          <Search size={14} strokeWidth={2} className="pointer-events-none absolute left-2.5" style={{ color: 'var(--color-ink-500)' }} />
          <input
            type="search"
            aria-label="Filter by action"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-52 rounded-md border py-2 pl-8 pr-8 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
            style={filterStyle}
          />
          {filterAction && (
            <button type="button" aria-label="Clear action filter" onClick={() => setFilterAction('')} className="absolute right-0.5 flex h-8 w-8 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <Filter size={14} strokeWidth={2} className="pointer-events-none absolute left-2.5" style={{ color: 'var(--color-ink-500)' }} />
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} aria-label="Filter by entity" className="w-40 rounded-md border px-3 py-2 pl-8 text-sm outline-none transition-shadow" style={filterStyle}>
            <option value="">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setFilterAction('');
              setFilterEntity('');
            }}
            className="min-h-9 text-sm font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-5">
        <DataTable<AuditLogEntry>
          {...table.tableProps}
          caption="Audit trail"
          columns={columns}
          rowKey={(l) => l.id}
          rowLabel={(l) => `${l.action} ${fmtDate(l.createdAt)}`}
          // Only entries with something to show can open.
          detail={(log) =>
            log.metadata ? (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs" style={{ color: 'var(--color-ink-700)' }}>
                {pretty(log)}
              </pre>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                No further details were recorded for this entry.
              </p>
            )
          }
          renderCard={renderCard}
          skeletonRows={8}
          empty={
            <>
              <ShieldCheck size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No audit logs found
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {filtersActive ? 'Adjust your filters or check back later.' : 'Activity will appear here as people use the system.'}
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}
