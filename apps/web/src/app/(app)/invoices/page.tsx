'use client';

import { useEffect, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { documentsApi, type DocumentListParams, type SaleDocument } from '../../../lib/documents-api';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';
import { useDocumentActions } from '../../../lib/use-document-actions';
import { fmtNumber } from '../../../lib/format';
import { useRowSelection, useServerTable } from '../../../lib/use-data-table';
import { downloadCsv } from '../../../lib/csv';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { toast } from '../../../components/ui/Toast';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Delivery note', bg: 'var(--color-bg)', fg: 'var(--color-ink-600)' },
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

const customerOf = (d: SaleDocument) => d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in';
const numberOf = (d: SaleDocument) => d.deliveryNoteNumber ?? d.receiptNumber ?? d.invoiceNumber ?? null;

function StatusPill({ doc }: { doc: SaleDocument }) {
  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.DRAFT;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
      {badge.label}
    </span>
  );
}

type Tab = 'invoices' | 'delivery-notes';

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lets global search (Ctrl/Cmd+K) land straight on a document's detail
  // drawer via `/invoices?open=<id>` — it fetches by id itself, independent
  // of which tab/list is currently loaded.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setDetailId(id);
  }, []);

  // Newest first, a page at a time — the server orders and pages one combined
  // list rather than the browser merging two full ones.
  const filters: DocumentListParams = tab === 'delivery-notes' ? { type: 'DELIVERY_NOTE' } : { status: ['INVOICED', 'PAID'] };
  const table = useServerTable<SaleDocument>({
    fetcher: (q) => documentsApi.listPage({ ...filters, sort: q.sort, offset: q.offset, limit: q.limit }),
    deps: [tab],
    defaultSort: { id: 'created', dir: 'desc' },
  });
  const { reload: load } = table;
  const documentActions = useDocumentActions({ onOpen: setDetailId, onChanged: load, onError: setError });
  const selection = useRowSelection<SaleDocument>((d) => d.id, [tab]);
  const isNotes = tab === 'delivery-notes';

  const columns: Column<SaleDocument>[] = [
    // Invoices and POS receipts carry different numbers, and only the quote,
    // invoice and delivery-note numbers can be ordered by on the server, so
    // this column sorts for delivery notes only.
    { id: 'deliveryNoteNumber', header: 'Number', sortable: isNotes, cell: (d) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{numberOf(d) ?? '—'}</span> },
    { id: 'customer', header: 'Customer', sortable: true, cell: (d) => <span className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{customerOf(d)}</span> },
    // Sorted by when the document was created; the date shown is when it became an invoice.
    { id: 'created', header: isNotes ? 'Created' : 'Invoiced', label: 'Date', sortable: true, defaultDir: 'desc', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.invoicedAt ?? d.createdAt)}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (d) => <StatusPill doc={d} /> },
    {
      id: 'total',
      header: isNotes ? 'Items' : 'Total',
      sortable: !isNotes,
      defaultDir: 'desc',
      align: 'right',
      // A delivery note carries no pricing anywhere, list views included.
      cell: (d) =>
        d.type === 'DELIVERY_NOTE' ? (
          <span style={{ color: 'var(--color-ink-600)' }}>
            {d.items.length} item{d.items.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
            KSh {fmtNumber(d.total)}
          </span>
        ),
    },
  ];

  const renderCard = (d: SaleDocument) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {customerOf(d)}
        </p>
        <p className="shrink-0 font-medium data-num" style={{ color: d.type === 'DELIVERY_NOTE' ? 'var(--color-ink-600)' : 'var(--color-ink-900)' }}>
          {d.type === 'DELIVERY_NOTE' ? `${d.items.length} item${d.items.length === 1 ? '' : 's'}` : `KSh ${fmtNumber(d.total)}`}
        </p>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-ink-600)' }}>{numberOf(d) ?? fmtDate(d.invoicedAt ?? d.createdAt)}</span>
        <StatusPill doc={d} />
      </div>
    </div>
  );

  function exportRows(rows: SaleDocument[]) {
    // Delivery notes carry no prices, in an export either.
    const head = ['Number', 'Customer', 'Date', 'Status', ...(isNotes ? ['Items'] : ['Total (KSh)'])];
    const body = rows.map((d) => [numberOf(d), customerOf(d), (d.invoicedAt ?? d.createdAt).slice(0, 10), (STATUS_BADGE[d.status] ?? STATUS_BADGE.DRAFT).label, isNotes ? d.items.length : d.total]);
    downloadCsv(`${isNotes ? 'delivery-notes' : 'invoices'}-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
    toast.success(`Exported ${rows.length} ${isNotes ? 'delivery note' : 'invoice'}${rows.length === 1 ? '' : 's'}`);
  }

  const tabButton = (key: Tab, label: string) => (
    <button
      type="button"
      aria-pressed={tab === key}
      onClick={() => setTab(key)}
      className="min-h-9 rounded-md border px-3 text-xs font-medium"
      style={{ borderColor: tab === key ? 'var(--color-accent)' : 'var(--color-border)', color: tab === key ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Invoices
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {tab === 'invoices' ? "Converted from quotes. New invoices are created from a quote's detail view." : "Frozen at creation — printing a delivery note again later won't reflect changes to the source invoice."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5" role="group" aria-label="Document type">
        {tabButton('invoices', 'Invoices')}
        {tabButton('delivery-notes', 'Delivery notes')}
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} role="alert" className="mt-4 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error} <span className="underline">Dismiss</span>
        </button>
      )}

      <div className="mt-5">
        <DataTable<SaleDocument>
          {...table.tableProps}
          caption={isNotes ? 'Delivery notes' : 'Invoices'}
          columns={columns}
          rowKey={(d) => d.id}
          rowLabel={(d) => numberOf(d) ?? customerOf(d)}
          onRowClick={(d) => setDetailId(d.id)}
          actions={documentActions}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={() => documentsApi.list(filters)}
          bulkActions={
            <button type="button" onClick={() => exportRows(selection.items)} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}>
              <Download size={14} strokeWidth={2} />
              Export selected
            </button>
          }
          empty={
            <>
              <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {isNotes ? 'No delivery notes yet' : 'No invoices yet'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {isNotes ? "Create one from a quote or invoice's detail view." : 'Convert a quote to an invoice to see it here.'}
              </p>
            </>
          }
        />
      </div>

      <DocumentDetailDrawer documentId={detailId} onClose={() => setDetailId(null)} onChanged={load} onNavigate={setDetailId} />
    </div>
  );
}
