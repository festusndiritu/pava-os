'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { hrApi, type Employee } from '../../lib/hr-api';
import { payrollApi, type Advance } from '../../lib/payroll-api';
import type { AdvanceStatus } from '../../lib/hr-api';
import { Drawer } from '../ui/Drawer';
import { ApiError } from '../../lib/api';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_TABS: { key: AdvanceStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SETTLED', label: 'Settled' },
];

const STATUS_STYLE: Record<AdvanceStatus, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Pending', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  APPROVED: { label: 'Approved', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
  REJECTED: { label: 'Rejected', fg: 'var(--color-status-bad)', bg: 'var(--color-status-badSoft)' },
  SETTLED: { label: 'Settled', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
};

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

export function AdvancesTab() {
  const [advances, setAdvances] = useState<Advance[] | null>(null);
  const [status, setStatus] = useState<AdvanceStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setAdvances(await payrollApi.listAdvances(status ? { status } : undefined));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    setBusyId(id);
    try {
      await payrollApi.decideAdvance(id, decision);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
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
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Request advance
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {advances === null &&
          [...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md" style={{ backgroundColor: 'var(--color-bg)' }} />)}

        {advances?.length === 0 && (
          <div className="rounded-lg border px-4 py-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Wallet size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              No advances yet
            </p>
          </div>
        )}

        {advances?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {a.employee.displayName} · {money(a.amount)}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {fmtDate(a.createdAt)} · {a.createdBy.name}
                {a.reason ? ` · ${a.reason}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {a.status === 'PENDING' ? (
                <>
                  <button type="button" disabled={busyId === a.id} onClick={() => decide(a.id, 'REJECTED')} className="rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    Reject
                  </button>
                  <button type="button" disabled={busyId === a.id} onClick={() => decide(a.id, 'APPROVED')} className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
                    Approve
                  </button>
                </>
              ) : (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[a.status].bg, color: STATUS_STYLE[a.status].fg }}>
                  {STATUS_STYLE[a.status].label}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <AdvanceFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}

function AdvanceFormDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId('');
    setAmount('');
    setReason('');
    setNotes('');
    setError(null);
    hrApi.list(undefined, 'ACTIVE').then(setEmployees);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await payrollApi.createAdvance({ employeeId, amount: Math.round(Number(amount)), reason: reason || undefined, notes: notes || undefined });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save advance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Request advance"
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="advance-form" disabled={saving || !employeeId || !amount} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : 'Request'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="advance-form" onSubmit={submit} className="flex flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Employee
          </label>
          <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Amount (KSh)
          </label>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Reason
          </label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
      </form>
    </Drawer>
  );
}