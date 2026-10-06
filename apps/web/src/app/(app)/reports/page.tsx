'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart, Undo2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { documentsApi, type SaleDocument } from '../../../lib/documents-api';
import { reportsApi, type ReturnRow } from '../../../lib/analytics-api';
import { RangeBar, useDateRange } from '../../../components/insights/RangeBar';
import { StatCard } from '../../../components/dashboard/DashboardPrimitives';
import { money, plural } from '../../../components/dashboard/dashboard-derive';
import { downloadCsv } from '../../../lib/csv';
import { useClientTable } from '../../../lib/use-data-table';
import { DataTable, type Column } from '../../../components/ui/DataTable';

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

  const salesTable = useClientTable<SaleDocument>({
    rows: docs,
    sortValues: {
      date: (d) => d.createdAt,
      number: (d) => docNumber(d),
      customer: (d) => customerLabel(d),
      by: (d) => d.createdBy?.name,
      payment: (d) => d.paymentMethod,
      status: (d) => d.status,
      total: (d) => d.total,
    },
    defaultSort: { id: 'date', dir: 'desc' },
    deps: [range.from, range.to],
    pageSize: 50,
  });
  const returnsTable = useClientTable<ReturnRow>({
    rows: returns,
    sortValues: {
      date: (r) => r.createdAt,
      number: (r) => r.returnNumber,
      against: (r) => r.document?.receiptNumber ?? r.document?.invoiceNumber,
      refund: (r) => r.refundMethod,
      reason: (r) => r.reason,
      items: (r) => r.items.length,
      total: (r) => r.total,
    },
    defaultSort: { id: 'date', dir: 'desc' },
    deps: [range.from, range.to],
    pageSize: 50,
  });

  const salesColumns: Column<SaleDocument>[] = [
    { id: 'date', header: 'Date', sortable: true, defaultDir: 'desc', className: 'whitespace-nowrap', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDateTime(d.createdAt)}</span> },
    { id: 'number', header: 'Number', sortable: true, className: 'whitespace-nowrap', cell: (d) => <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{docNumber(d)}</span> },
    { id: 'customer', header: 'Customer', sortable: true, className: 'max-w-[220px] truncate', cell: (d) => <span style={{ color: 'var(--color-ink-900)' }}>{customerLabel(d)}</span> },
    { id: 'by', header: 'Raised by', sortable: true, hideBelow: 'lg', className: 'whitespace-nowrap', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{d.createdBy?.name ?? '—'}</span> },
    { id: 'payment', header: 'Payment', sortable: true, hideBelow: 'lg', className: 'whitespace-nowrap', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{d.paymentMethod ?? '—'}</span> },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (d) => {
        const badge = STATUS_BADGE[d.status];
        return badge ? (
          <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
            {badge.label}
          </span>
        ) : null;
      },
    },
    { id: 'total', header: 'Total', sortable: true, defaultDir: 'desc', align: 'right', className: 'whitespace-nowrap', cell: (d) => <span className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>{money(d.total)}</span> },
  ];

  const returnsColumns: Column<ReturnRow>[] = [
    { id: 'date', header: 'Date', sortable: true, defaultDir: 'desc', className: 'whitespace-nowrap', cell: (r) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDateTime(r.createdAt)}</span> },
    { id: 'number', header: 'Return', sortable: true, className: 'whitespace-nowrap', cell: (r) => <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{r.returnNumber}</span> },
    { id: 'against', header: 'Against', sortable: true, className: 'whitespace-nowrap', cell: (r) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{r.document?.receiptNumber ?? r.document?.invoiceNumber ?? '—'}</span> },
    { id: 'refund', header: 'Refund', sortable: true, className: 'whitespace-nowrap', cell: (r) => <span style={{ color: 'var(--color-ink-600)' }}>{r.refundMethod ?? '—'}</span> },
    { id: 'reason', header: 'Reason', sortable: true, hideBelow: 'lg', className: 'max-w-[220px] truncate', cell: (r) => <span style={{ color: 'var(--color-ink-600)' }}>{r.reason ?? '—'}</span> },
    { id: 'items', header: 'Items', sortable: true, defaultDir: 'desc', className: 'whitespace-nowrap', cell: (r) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{r.items.length}</span> },
    { id: 'total', header: 'Total', sortable: true, defaultDir: 'desc', align: 'right', className: 'whitespace-nowrap', cell: (r) => <span className="data-num font-medium" style={{ color: 'var(--color-status-warn)' }}>{money(r.total)}</span> },
  ];

  const salesCard = (d: SaleDocument) => {
    const badge = STATUS_BADGE[d.status];
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {docNumber(d)}
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {customerLabel(d)}
            </p>
          </div>
          <p className="data-num shrink-0 font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {money(d.total)}
          </p>
        </div>
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-ink-600)' }}>
          <span>
            {fmtDateTime(d.createdAt)} · {d.createdBy?.name ?? '—'} · {d.paymentMethod ?? '—'}
          </span>
          {badge && (
            <span className="shrink-0 rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    );
  };

  const returnsCard = (r: ReturnRow) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {r.returnNumber}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
            Against {r.document?.receiptNumber ?? r.document?.invoiceNumber ?? '—'}
            {r.reason ? ` · ${r.reason}` : ''}
          </p>
        </div>
        <p className="data-num shrink-0 font-medium" style={{ color: 'var(--color-status-warn)' }}>
          {money(r.total)}
        </p>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
        {fmtDateTime(r.createdAt)} · {r.refundMethod ?? '—'} · {r.items.length} {plural(r.items.length, 'item')}
      </p>
    </div>
  );

  function exportCurrentTab() {
    if (tab === 'sales') {
      downloadCsv(`sales-${range.from}-to-${range.to}.csv`, [
        ['Date', 'Number', 'Type', 'Status', 'Customer', 'Raised by', 'Payment', 'Total'],
        ...(salesTable.sortedRows ?? docs ?? []).map((d) => [
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
      ...(returnsTable.sortedRows ?? returns ?? []).map((r) => [
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

      <div className="flex gap-1.5" role="group" aria-label="Report">
        {(['sales', 'returns'] as Tab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(key)}
              className="min-h-9 rounded-md border px-3 text-xs font-medium"
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

      {tab === 'sales' ? (
        <DataTable<SaleDocument>
          {...salesTable.tableProps}
          rows={error ? [] : salesTable.rows}
          caption="Sales register"
          columns={salesColumns}
          rowKey={(d) => d.id}
          rowLabel={docNumber}
          renderCard={salesCard}
          empty={<p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Nothing was recorded in this period.</p>}
        />
      ) : (
        <DataTable<ReturnRow>
          {...returnsTable.tableProps}
          rows={error ? [] : returnsTable.rows}
          caption="Returns"
          columns={returnsColumns}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.returnNumber}
          renderCard={returnsCard}
          empty={<p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Nothing was recorded in this period.</p>}
        />
      )}
    </div>
  );
}
