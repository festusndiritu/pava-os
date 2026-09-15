'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, UserSquare2 } from 'lucide-react';
import { hrApi, type Employee, type EmploymentStatus } from '../../../lib/hr-api';
import { Avatar } from '../../../components/Avatar';
import { EmployeeFormDrawer } from '../../../components/hr/EmployeeFormDrawer';
import { EmployeeDetailDrawer } from '../../../components/hr/EmployeeDetailDrawer';

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

  async function load() {
    setEmployees(await hrApi.list(search || undefined, status || undefined));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or department"
            className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={inputStyle}
          />
        </div>
        <div className="flex gap-1 rounded-md border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: status === t.key ? 'var(--color-accent-soft)' : 'transparent', color: status === t.key ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Employee
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Department
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Base salary
              </th>
            </tr>
          </thead>
          <tbody>
            {employees === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {employees?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No employees yet
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Add your first employee to start tracking payroll and advances.
                  </p>
                </td>
              </tr>
            )}

            {employees?.map((e) => (
              <tr key={e.id} onClick={() => setDetailId(e.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                  {e.department ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={e.employmentStatus} />
                </td>
                <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                  KSh {e.baseSalary.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {employees === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {employees?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No employees yet
              </p>
            </div>
          )}

          {employees?.map((e) => (
            <button key={e.id} type="button" onClick={() => setDetailId(e.id)} className="flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
              <Avatar name={e.displayName} avatar={e.avatar} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {e.displayName}
                  </p>
                  <StatusBadge status={e.employmentStatus} />
                </div>
                <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                  {e.jobTitle ?? '—'} · KSh {e.baseSalary.toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
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