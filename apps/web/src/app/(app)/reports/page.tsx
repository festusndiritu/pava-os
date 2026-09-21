'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart, Undo2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { documentsApi, type SaleDocument } from '../../../lib/documents-api';
import { reportsApi, type ReturnRow } from '../../../lib/analytics-api';
import { RangeBar, useDateRange } from '../../../components/insights/RangeBar';
import { StatCard } from '../../../components/dashboard/DashboardPrimitives';
import { money, plural } from '../../../components/dashboard/dashboard-derive';

type Tab = 'sales' | 'returns';

const SETTLED: SaleDocument['status'][] = ['INVOICED', 'PAID'];

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Delivery note', bg: 'var(--color-bg)', fg: 'var(--color-ink-600)' },
  QUOTED: { label: 'Quote', bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function docNumber(doc: SaleDocument) {
  return doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.deliveryNoteNumber ?? '—';
}

function customerLabel(doc: SaleDocument) {
  return doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in';
}

/**
 * Quotes a CSV cell the way a spreadsheet expects, and defuses the leading
 * =/+/-/@ that Excel would otherwise execute as a formula — customer names
 * and note fields are free text typed by staff.
 */
function csvCell(value: string | number) {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // BOM so Excel opens it as UTF-8 rather than mangling anything non-ASCII.
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const { range, preset, setPreset, setBound } = useDateRange('30d');
  const [tab, setTab] = useState<Tab>('sales');
  const [docs, setDocs] = useState<SaleDocument[] | null>(null);
  const [returns, setReturns] = useState<ReturnRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDocs(null);
    setReturns(null);
    setError(null);
    Promise.all([documentsApi.list({ from: range.from, to: range.to }), reportsApi.returns()])
      .then(([documents, returnRows]) => {
        if (cancelled) return;
        setDocs(documents);
        // The returns endpoint takes a limit, not a range, so the range is
        // applied here rather than asking for a filter the API doesn't have.
        setReturns(returnRows.filter((r) => r.createdAt.slice(0, 10) >= range.from && r.createdAt.slice(0, 10) <= range.to));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load reports');
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const settled = useMemo(() => (docs ?? []).filter((d) => SETTLED.includes(d.status)), [docs]);
  const settledTotal = settled.reduce((sum, d) => sum + d.total, 0);
  const unpaidTotal = settled.filter((d) => d.status === 'INVOICED').reduce((sum, d) => sum + d.total, 0);
  const returnsTotal = (returns ?? []).reduce((sum, r) => sum + r.total, 0);

  function exportCurrentTab() {
    if (tab === 'sales') {
      downloadCsv(`sales-${range.from}-to-${range.to}.csv`, [
        ['Date', 'Number', 'Type', 'Status', 'Customer', 'Raised by', 'Payment', 'Total'],
        ...(docs ?? []).map((d) => [
          d.createdAt.slice(0, 10),
          docNumber(d),
          d.type,
          d.status,
          customerLabel(d),
          d.createdBy?.name ?? '',
          d.paymentMethod ?? '',
          d.total,
        ]),
      ]);
      return;
    }
    downloadCsv(`returns-${range.from}-to-${range.to}.csv`, [
      ['Date', 'Return number', 'Against', 'Refund method', 'Reason', 'Items', 'Total'],
      ...(returns ?? []).map((r) => [
        r.createdAt.slice(0, 10),
        r.returnNumber,
        r.document?.receiptNumber ?? r.document?.invoiceNumber ?? '',
        r.refundMethod ?? '',
        r.reason ?? '',
        r.items.length,
        r.total,
      ]),
    ]);
  }

  if (!hasPermission('REPORTS')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }

  const loading = docs === null && returns === null && !error;
  const rowCount = tab === 'sales' ? docs?.length ?? 0 : returns?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Reports
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Every document raised in a period, line by line — the register to reconcile the till against.
        </p>
      </div>

      <RangeBar
        range={range}
        preset={preset}
        onPreset={setPreset}
        onBound={setBound}
        trailing={
          <button
            type="button"
            onClick={exportCurrentTab}
            disabled={rowCount === 0}
            className="ml-auto flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}
          >
            <Download size={14} strokeWidth={2} />
            Export CSV
          </button>
        }
      />

      {error && (
        <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Settled sales" value={money(settledTotal)} sub={`${settled.length} ${plural(settled.length, 'document')}`} icon={FileBarChart} />
        <StatCard
          label="Still unpaid"
          value={money(unpaidTotal)}
          sub="Invoiced, not yet settled"
          icon={FileBarChart}
          tone={unpaidTotal > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          label="Returns"
          value={money(returnsTotal)}
          sub={`${returns?.length ?? 0} ${plural(returns?.length ?? 0, 'return')}`}
          icon={Undo2}
          tone={returnsTotal > 0 ? 'warn' : 'ok'}
        />
        <StatCard label="Net of returns" value={money(settledTotal - returnsTotal)} sub="Settled sales less credits" icon={FileBarChart} tone="ok" />
      </div>

      <div className="flex gap-1.5">
        {(['sales', 'returns'] as Tab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
              }}
            >
              {key === 'sales' ? 'Sales register' : 'Returns'}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                {(tab === 'sales'
                  ? ['Date', 'Number', 'Customer', 'Raised by', 'Payment', 'Status', 'Total']
                  : ['Date', 'Return', 'Against', 'Refund', 'Reason', 'Items', 'Total']
                ).map((heading, i, all) => (
                  <th
                    key={heading}
                    className={`whitespace-nowrap px-4 py-2.5 font-medium ${i === all.length - 1 ? 'text-right' : ''}`}
                    style={{ color: 'var(--color-ink-600)' }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                    </td>
                  </tr>
                ))}

              {!loading && rowCount === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-sm" colSpan={7} style={{ color: 'var(--color-ink-600)' }}>
                    Nothing was recorded in this period.
                  </td>
                </tr>
              )}

              {tab === 'sales' &&
                docs?.map((d) => {
                  const badge = STATUS_BADGE[d.status];
                  return (
                    <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                        {fmtDateTime(d.createdAt)}
                      </td>
                      <td className="data-num whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-900)' }}>
                        {docNumber(d)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3" style={{ color: 'var(--color-ink-900)' }}>
                        {customerLabel(d)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                        {d.createdBy?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                        {d.paymentMethod ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {badge && (
                          <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="data-num whitespace-nowrap px-4 py-3 text-right font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {money(d.total)}
                      </td>
                    </tr>
                  );
                })}

              {tab === 'returns' &&
                returns?.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {fmtDateTime(r.createdAt)}
                    </td>
                    <td className="data-num whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-900)' }}>
                      {r.returnNumber}
                    </td>
                    <td className="data-num whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.document?.receiptNumber ?? r.document?.invoiceNumber ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.refundMethod ?? '—'}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.reason ?? '—'}
                    </td>
                    <td className="data-num whitespace-nowrap px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.items.length}
                    </td>
                    <td className="data-num whitespace-nowrap px-4 py-3 text-right font-medium" style={{ color: 'var(--color-status-warn)' }}>
                      {money(r.total)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
