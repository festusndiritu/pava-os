'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, UserSquare2, X } from 'lucide-react';
import { hrApi, type Employee, type EmploymentStatus } from '../../../lib/hr-api';
import { Avatar } from '../../../components/Avatar';
import { EmployeeFormDrawer } from '../../../components/hr/EmployeeFormDrawer';
import { EmployeeDetailDrawer } from '../../../components/hr/EmployeeDetailDrawer';
import { fmtNumber } from '../../../lib/format';
import { ApiError } from '../../../lib/api';
import { useClientTable } from '../../../lib/use-data-table';
import { useDebounced } from '../../../lib/use-debounced';
import { DataTable, type Column } from '../../../components/ui/DataTable';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

const STATUS_TABS: { key: EmploymentStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'ON_LEAVE', label: 'On leave' },
  { key: 'TERMINATED', label: 'Terminated' },
];

function StatusBadge({ status }: { status: EmploymentStatus }) {
  const map = {
    ACTIVE: { label: 'Active', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
    ON_LEAVE: { label: 'On leave', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
    TERMINATED: { label: 'Terminated', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
  } as const;
  const s = map[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export default function HrPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmploymentStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      setEmployees(await hrApi.list(debouncedSearch || undefined, status || undefined));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load employees. Check your connection and try again.');
      setEmployees((prev) => prev ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status]);

  const table = useClientTable<Employee>({
    rows: employees,
    sortValues: {
      name: (e) => e.displayName,
      department: (e) => e.department,
      status: (e) => e.employmentStatus,
      salary: (e) => e.baseSalary,
    },
    defaultSort: { id: 'name', dir: 'asc' },
    deps: [debouncedSearch, status],
    error: loadError,
    onRetry: load,
  });

  const columns: Column<Employee>[] = [
    {
      id: 'name',
      header: 'Employee',
      sortable: true,
      cell: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={e.displayName} avatar={e.avatar} size={30} />
          <div>
            <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {e.displayName}
            </p>
            {e.jobTitle && (
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {e.jobTitle}
              </p>
            )}
          </div>
        </div>
      ),
    },
    { id: 'department', header: 'Department', sortable: true, cell: (e) => <span style={{ color: 'var(--color-ink-600)' }}>{e.department ?? '—'}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (e) => <StatusBadge status={e.employmentStatus} /> },
    { id: 'salary', header: 'Base salary', sortable: true, defaultDir: 'desc', align: 'right', cell: (e) => <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(e.baseSalary)}</span> },
  ];

  const renderCard = (e: Employee) => (
    <div className="flex items-center gap-3">
      <Avatar name={e.displayName} avatar={e.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {e.displayName}
          </p>
          <StatusBadge status={e.employmentStatus} />
        </div>
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          {e.jobTitle ?? '—'} · KSh {fmtNumber(e.baseSalary)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            HR
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Staff profiles, roles, and employment status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Add employee
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            type="search"
            aria-label="Search employees"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or department"
            className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
            style={inputStyle}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-md border p-0.5" role="group" aria-label="Employment status" style={{ borderColor: 'var(--color-border)' }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={status === t.key}
              onClick={() => setStatus(t.key)}
              className="min-h-9 rounded px-2.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: status === t.key ? 'var(--color-accent-soft)' : 'transparent', color: status === t.key ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <DataTable<Employee>
          {...table.tableProps}
          caption="Employees"
          columns={columns}
          rowKey={(e) => e.id}
          rowLabel={(e) => e.displayName}
          onRowClick={(e) => setDetailId(e.id)}
          renderCard={renderCard}
          empty={
            <>
              <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {search || status ? 'No employees match' : 'No employees yet'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {search || status ? 'Try a different search or status.' : 'Add your first employee to start tracking payroll and advances.'}
              </p>
            </>
          }
        />
      </div>

      <EmployeeFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} employee={editing} />
      <EmployeeDetailDrawer
        employeeId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(e) => {
          setDetailId(null);
          setEditing(e);
          setFormOpen(true);
        }}
      />
    </div>
  );
}