'use client';

import { useEffect, useState } from 'react';
import { Plus, Wallet2 } from 'lucide-react';
import { payrollApi, type PayrollRun, type PayrollStatus } from '../../../lib/payroll-api';
import { PayrollRunFormDrawer } from '../../../components/payroll/PayrollRunFormDrawer';
import { PayrollRunDetailDrawer } from '../../../components/payroll/PayrollRunDetailDrawer';
import { AdvancesTab } from '../../../components/payroll/AdvancesTab';
import { money } from '../../../lib/format';
import { ApiError } from '../../../lib/api';
import { useClientTable } from '../../../lib/use-data-table';
import { DataTable, type Column } from '../../../components/ui/DataTable';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_STYLE: Record<PayrollStatus, { label: string; fg: string; bg: string }> = {
  DRAFT: { label: 'Draft', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
  FINALIZED: { label: 'Finalized', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  PAID: { label: 'Paid', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
};

const runTotal = (r: PayrollRun) => r.items.reduce((sum, i) => sum + i.netPay, 0);

function RunStatusPill({ status }: { status: PayrollStatus }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
      {STATUS_STYLE[status].label}
    </span>
  );
}

function RunsTab() {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      setRuns(await payrollApi.listRuns());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load payroll runs. Check your connection and try again.');
      setRuns((prev) => prev ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Latest period first.
  const table = useClientTable<PayrollRun>({
    rows: runs,
    sortValues: {
      period: (r) => r.periodStart,
      employees: (r) => r.items.length,
      status: (r) => r.status,
      total: runTotal,
    },
    defaultSort: { id: 'period', dir: 'desc' },
    error: loadError,
    onRetry: load,
  });

  const columns: Column<PayrollRun>[] = [
    {
      id: 'period',
      header: 'Period',
      sortable: true,
      defaultDir: 'desc',
      cell: (r) => (
        <span className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
        </span>
      ),
    },
    { id: 'employees', header: 'Employees', sortable: true, defaultDir: 'desc', cell: (r) => <span style={{ color: 'var(--color-ink-600)' }}>{r.items.length}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (r) => <RunStatusPill status={r.status} /> },
    { id: 'total', header: 'Total net', sortable: true, defaultDir: 'desc', align: 'right', cell: (r) => <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>{money(runTotal(r))}</span> },
  ];

  const renderCard = (r: PayrollRun) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
        </p>
        <RunStatusPill status={r.status} />
      </div>
      <div className="flex items-center justify-between text-sm" style={{ color: 'var(--color-ink-600)' }}>
        <span>{r.items.length} employees</span>
        <span className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {money(runTotal(r))}
        </span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          New payroll run
        </button>
      </div>

      <div className="mt-4">
        <DataTable<PayrollRun>
          {...table.tableProps}
          caption="Payroll runs"
          columns={columns}
          rowKey={(r) => r.id}
          rowLabel={(r) => `${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)}`}
          onRowClick={(r) => setDetailId(r.id)}
          renderCard={renderCard}
          skeletonRows={3}
          empty={
            <>
              <Wallet2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No payroll runs yet
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                Create a run for the current period to start paying staff.
              </p>
            </>
          }
        />
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

      <div className="mt-5 flex gap-1 rounded-md border p-0.5" role="group" aria-label="Payroll views" style={{ borderColor: 'var(--color-border)', width: 'fit-content' }}>
        <button
          type="button"
          aria-pressed={tab === 'runs'}
          onClick={() => setTab('runs')}
          className="min-h-9 rounded px-3 text-sm font-medium transition-colors"
          style={{ backgroundColor: tab === 'runs' ? 'var(--color-accent-soft)' : 'transparent', color: tab === 'runs' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          Payroll runs
        </button>
        <button
          type="button"
          aria-pressed={tab === 'advances'}
          onClick={() => setTab('advances')}
          className="min-h-9 rounded px-3 text-sm font-medium transition-colors"
          style={{ backgroundColor: tab === 'advances' ? 'var(--color-accent-soft)' : 'transparent', color: tab === 'advances' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          Advances
        </button>
      </div>

      <div className="mt-5">{tab === 'runs' ? <RunsTab /> : <AdvancesTab />}</div>
    </div>
  );
}