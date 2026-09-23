'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { payrollApi, type PayrollRun } from '../../lib/payroll-api';
import { ApiError } from '../../lib/api';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

export function PayrollRunDetailDrawer({ runId, onClose, onChanged }: { runId: string | null; onClose: () => void; onChanged: () => void }) {
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!runId) return;
    setLoading(true);
    const r = await payrollApi.getRun(runId);
    setRun(r);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  if (!runId) return null;

  const isDraft = run?.status === 'DRAFT';
  const totalNet = run?.items.reduce((s, i) => s + i.netPay, 0) ?? 0;

  async function saveField(itemId: string, field: 'otherDeductions' | 'adjustments', value: string) {
    if (!run) return;
    setBusyId(itemId);
    try {
      await payrollApi.updateItem(run.id, itemId, { [field]: value === '' ? 0 : Math.round(Number(value)) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setBusyId(null);
    }
  }

  async function finalize() {
    if (!run) return;
    setBusyId('__finalize');
    setError(null);
    try {
      await payrollApi.finalizeRun(run.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finalize.');
    } finally {
      setBusyId(null);
    }
  }

  async function pay(itemId: string) {
    if (!run) return;
    setBusyId(itemId);
    setError(null);
    try {
      await payrollApi.payItem(run.id, itemId);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record payment.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      title={run ? `${fmtDate(run.periodStart)} – ${fmtDate(run.periodEnd)}` : 'Payroll run'}
      subtitle={run ? `${run.items.length} employee${run.items.length === 1 ? '' : 's'} · Total net ${money(totalNet)}` : undefined}
      footer={
        run &&
        (isDraft ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={finalize} disabled={busyId === '__finalize'} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {busyId === '__finalize' ? 'Finalizing…' : 'Finalize run'}
            </button>
            <span className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Sweeps in approved advances and locks the numbers.
            </span>
          </div>
        ) : (
          error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )
        ))
      }
    >
      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Loading…
        </p>
      )}

      {run && !loading && (
        <div className="flex flex-col gap-4">
          {error && isDraft && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {run.items.map((item) => (
              <div key={item.id} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {item.employee.displayName}
                  </p>
                  {item.paymentStatus === 'PAID' ? (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-status-okSoft)', color: 'var(--color-status-ok)' }}>
                      Paid
                    </span>
                  ) : !isDraft ? (
                    <button
                      type="button"
                      onClick={() => pay(item.id)}
                      disabled={busyId === item.id}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {busyId === item.id ? 'Recording…' : 'Mark paid'}
                    </button>
                  ) : (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                      Draft
                    </span>
                  )}
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Base
                    </p>
                    <p className="data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {money(item.baseSalary)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Advances
                    </p>
                    <p className="data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {item.advancesDeducted > 0 ? `-${money(item.advancesDeducted)}` : money(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Other deductions
                    </p>
                    {isDraft ? (
                      <input
                        type="number"
                        defaultValue={item.otherDeductions}
                        onBlur={(e) => saveField(item.id, 'otherDeductions', e.target.value)}
                        className="w-full rounded-md border px-2 py-1 text-sm data-num outline-none focus:border-[var(--color-accent)]"
                        style={inputStyle}
                      />
                    ) : (
                      <p className="data-num" style={{ color: 'var(--color-ink-900)' }}>
                        {money(item.otherDeductions)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Adjustments
                    </p>
                    {isDraft ? (
                      <input
                        type="number"
                        defaultValue={item.adjustments}
                        onBlur={(e) => saveField(item.id, 'adjustments', e.target.value)}
                        className="w-full rounded-md border px-2 py-1 text-sm data-num outline-none focus:border-[var(--color-accent)]"
                        style={inputStyle}
                      />
                    ) : (
                      <p className="data-num" style={{ color: 'var(--color-ink-900)' }}>
                        {item.adjustments >= 0 ? '+' : ''}
                        {money(item.adjustments)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    Net pay
                  </span>
                  <span className="text-sm font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {money(item.netPay)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}