'use client';

import { useEffect, useState } from 'react';
import { FileText, Search, Filter, ChevronLeft, ChevronRight, ShieldCheck, UserRound, Clock, Activity } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { auditApi, type AuditLogEntry } from '../../../lib/audit-api';
import { Avatar } from '../../../components/Avatar';

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

export default function AuditPage() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [filterAction, setFilterAction] = useState('');
    const [filterEntity, setFilterEntity] = useState('');
    const [page, setPage] = useState(1);
    const limit = 30;
    
    async function load() {
      setLoading(true);
        try {
        const result = await auditApi.list({
          page,
          limit,
          action: filterAction || undefined,
          entityType: filterEntity || undefined,
        });
      setLogs(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, filterAction, filterEntity]);

  if (!hasPermission('AUDIT')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  const entityTypes = Array.from(new Set(logs?.map((l) => l.entityType).filter(Boolean) as string[])).sort();

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

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex items-center">
          <Search size={14} strokeWidth={2} className="absolute left-2.5" style={{ color: 'var(--color-ink-500)' }} />
          <input
            type="text"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            className="w-48 rounded-md border px-3 py-2 pl-8 text-sm outline-none transition-shadow"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-ink-900)',
            }}
          />
        </div>

        <div className="relative flex items-center">
          <Filter size={14} strokeWidth={2} className="absolute left-2.5" style={{ color: 'var(--color-ink-500)' }} />
          <select
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value);
              setPage(1);
            }}
            className="w-40 rounded-md border px-3 py-2 pl-8 text-sm outline-none transition-shadow"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-ink-900)',
            }}
          >
            <option value="">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {(filterAction || filterEntity) && (
          <button
            type="button"
            onClick={() => {
              setFilterAction('');
              setFilterEntity('');
              setPage(1);
            }}
            className="text-sm font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Timestamp
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                User
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Action
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Entity
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {!loading && logs?.length === 0 && (
              <tr>
                <td className="px-4 py-12 text-center" colSpan={5}>
                  <ShieldCheck size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No audit logs found
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    Adjust your filters or check back later.
                  </p>
                </td>
              </tr>
            )}

            {!loading &&
              logs?.map((log) => {
                const EntityIcon = log.entityType ? ENTITY_ICONS[log.entityType] ?? Activity : Activity;
                return (
                  <tr key={log.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        <Clock size={13} strokeWidth={2} />
                        {fmtDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.actor ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={log.actor.name} avatar={log.actor.avatar} size={28} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                            {log.actor.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      {log.entityType ? (
                        <div className="flex items-center gap-1.5">
                          <EntityIcon size={14} strokeWidth={2} style={{ color: 'var(--color-ink-500)' }} />
                          <span className="text-sm" style={{ color: 'var(--color-ink-700)' }}>
                            {log.entityType}
                            {log.entityId && <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}> · {log.entityId.slice(0, 8)}</span>}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.metadata ? (
                        <pre className="max-w-md overflow-hidden text-ellipsis text-xs" style={{ color: 'var(--color-ink-600)' }}>
                          {JSON.stringify(log.metadata, null, 2).slice(0, 200)}
                          {JSON.stringify(log.metadata, null, 2).length > 200 && '…'}
                        </pre>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {loading &&
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {!loading &&
            logs?.map((log) => (
              <div key={log.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.actor ? (
                      <>
                        <Avatar name={log.actor.name} avatar={log.actor.avatar} size={32} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                          {log.actor.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>System</span>
                    )}
                  </div>
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
                {log.metadata && (
                  <pre className="overflow-hidden text-ellipsis text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    {JSON.stringify(log.metadata, null, 2).slice(0, 150)}
                    {JSON.stringify(log.metadata, null, 2).length > 150 && '…'}
                  </pre>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-700)', backgroundColor: 'var(--color-bg)' }}
            >
              <ChevronLeft size={14} strokeWidth={2} />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-700)', backgroundColor: 'var(--color-bg)' }}
            >
              Next
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
