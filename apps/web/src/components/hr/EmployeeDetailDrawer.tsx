'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Avatar } from '../Avatar';
import { hrApi, type Employee, type AdvanceStatus } from '../../lib/hr-api';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const ADVANCE_LABEL: Record<AdvanceStatus, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Pending', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  APPROVED: { label: 'Approved', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
  REJECTED: { label: 'Rejected', fg: 'var(--color-status-bad)', bg: 'var(--color-status-badSoft)' },
  SETTLED: { label: 'Settled', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
};

export function EmployeeDetailDrawer({
  employeeId,
  onClose,
  onEdit,
}: {
  employeeId: string | null;
  onClose: () => void;
  onEdit: (e: Employee) => void;
}) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    hrApi.get(employeeId).then((e) => {
      setEmployee(e);
      setLoading(false);
    });
  }, [employeeId]);

  if (!employeeId) return null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={employee?.displayName || 'Employee'}
      subtitle={employee?.jobTitle ?? undefined}
      footer={
        employee && (
          <button type="button" onClick={() => onEdit(employee)} className="w-full rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
            Edit
          </button>
        )
      }
    >
      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Loading…
        </p>
      )}

      {employee && !loading && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={employee.displayName} avatar={employee.avatar} size={44} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {employee.displayName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {[employee.jobTitle, employee.department].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                Base salary
              </p>
              <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                {money(employee.baseSalary)}
              </p>
            </div>
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </p>
              <p className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {employee.employmentStatus === 'ACTIVE' ? 'Active' : employee.employmentStatus === 'ON_LEAVE' ? 'On leave' : 'Terminated'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {employee.phone && <p>Phone: {employee.phone}</p>}
            {employee.employmentStartDate && <p>Started: {fmtDate(employee.employmentStartDate)}</p>}
            {(employee.emergencyContactName || employee.emergencyContactPhone) && (
              <p>
                Emergency contact: {employee.emergencyContactName ?? '—'} {employee.emergencyContactPhone ? `(${employee.emergencyContactPhone})` : ''}
              </p>
            )}
            {employee.notes && <p>Notes: {employee.notes}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-900)', letterSpacing: '0.04em' }}>
              Advances
            </h3>
            {(!employee.advances || employee.advances.length === 0) && (
              <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                No advances on record.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {employee.advances?.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {money(a.amount)}
                      {a.reason ? ` · ${a.reason}` : ''}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {fmtDate(a.createdAt)} · {a.createdBy.name}
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: ADVANCE_LABEL[a.status].bg, color: ADVANCE_LABEL[a.status].fg }}>
                    {ADVANCE_LABEL[a.status].label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Request or approve advances from Payroll → Advances.
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}