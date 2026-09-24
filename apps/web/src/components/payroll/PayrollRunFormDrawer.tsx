'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { Avatar } from '../Avatar';
import { hrApi, type Employee } from '../../lib/hr-api';
import { payrollApi } from '../../lib/payroll-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function PayrollRunFormDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPeriodStart('');
    setPeriodEnd('');
    setNotes('');
    setError(null);
    hrApi.list(undefined, 'ACTIVE').then((list) => {
      setEmployees(list);
      setSelected(new Set(list.map((e) => e.id)));
    });
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      setError('Select at least one employee.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await payrollApi.createRun({
        periodStart,
        periodEnd,
        employeeIds: [...selected],
        notes: notes || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create payroll run.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      guardUnsaved
      open={open}
      onClose={onClose}
      title="New payroll run"
      subtitle="Base salaries are snapshotted now; advances are swept in when you finalize."
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="payroll-run-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Creating…' : `Create draft (${selected.size})`}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="payroll-run-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Period start
            </label>
            <input required type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Period end
            </label>
            <input required type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
              Employees
            </label>
            <button type="button" onClick={() => setSelected(selected.size === employees.length ? new Set() : new Set(employees.map((e) => e.id)))} className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              {selected.size === employees.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="flex flex-col gap-1.5 rounded-md border p-2" style={{ borderColor: 'var(--color-border)' }}>
            {employees.length === 0 && (
              <p className="px-1 py-2 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                No active employees. Add one under HR first.
              </p>
            )}
            {employees.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg)]">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                <Avatar name={e.displayName} avatar={e.avatar} size={26} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {e.displayName}
                  </p>
                </div>
                <p className="text-xs data-num" style={{ color: 'var(--color-ink-600)' }}>
                  KSh {e.baseSalary.toLocaleString()}
                </p>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Drawer>
  );
}