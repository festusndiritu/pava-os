'use client';

import { useEffect, useState } from 'react';
import { Plus, Wallet2 } from 'lucide-react';
import { payrollApi, type PayrollRun, type PayrollStatus } from '../../../lib/payroll-api';
import { PayrollRunFormDrawer } from '../../../components/payroll/PayrollRunFormDrawer';
import { PayrollRunDetailDrawer } from '../../../components/payroll/PayrollRunDetailDrawer';
import { AdvancesTab } from '../../../components/payroll/AdvancesTab';
import { money } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_STYLE: Record<PayrollStatus, { label: string; fg: string; bg: string }> = {
  DRAFT: { label: 'Draft', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
  FINALIZED: { label: 'Finalized', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  PAID: { label: 'Paid', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
};

function RunsTab() {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setRuns(await payrollApi.listRuns());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          New payroll run
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Period
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Employees
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Total net
              </th>
            </tr>
          </thead>
          <tbody>
            {runs === null &&
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {runs?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Wallet2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No payroll runs yet
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Create a run for the current period to start paying staff.
                  </p>
                </td>
              </tr>
            )}

            {runs?.map((r) => {
              const total = r.items.reduce((s, i) => s + i.netPay, 0);
              return (
                <tr key={r.id} onClick={() => setDetailId(r.id)} onKeyDown={activateOnKey(() => setDetailId(r.id))} tabIndex={0} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                    {r.items.length}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].fg }}>
                      {STATUS_STYLE[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {money(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {runs?.map((r) => {
            const total = r.items.reduce((s, i) => s + i.netPay, 0);
            return (
              <button key={r.id} type="button" onClick={() => setDetailId(r.id)} className="flex w-full flex-col gap-1.5 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-center justify-between">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                  </p>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].fg }}>
                    {STATUS_STYLE[r.status].label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--color-ink-600)' }}>
                  <span>{r.items.length} employees</span>
                  <span className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {money(total)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <PayrollRunFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <PayrollRunDetailDrawer runId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
    </div>
  );
}

export default function PayrollPage() {
  const [tab, setTab] = useState<'runs' | 'advances'>('runs');

  return (
    <div className="p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Payroll
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Payroll runs, payslips, and employee advances.
        </p>
      </div>

      <div className="mt-5 flex gap-1 rounded-md border p-0.5" style={{ borderColor: 'var(--color-border)', width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setTab('runs')}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ backgroundColor: tab === 'runs' ? 'var(--color-accent-soft)' : 'transparent', color: tab === 'runs' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          Payroll runs
        </button>
        <button
          type="button"
          onClick={() => setTab('advances')}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ backgroundColor: tab === 'advances' ? 'var(--color-accent-soft)' : 'transparent', color: tab === 'advances' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          Advances
        </button>
      </div>

      <div className="mt-5">{tab === 'runs' ? <RunsTab /> : <AdvancesTab />}</div>
    </div>
  );
}