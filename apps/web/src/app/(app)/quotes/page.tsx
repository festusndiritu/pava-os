'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Plus } from 'lucide-react';
import { documentsApi, type DocumentListParams, type SaleDocument } from '../../../lib/documents-api';
import { QuoteFormDrawer } from '../../../components/documents/QuoteFormDrawer';
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

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  QUOTED: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  CANCELLED: { bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

const customerOf = (d: SaleDocument) => d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in';
const statusLabel = (d: SaleDocument) => (d.status === 'CANCELLED' ? 'Cancelled' : 'Quote');

function StatusPill({ doc }: { doc: SaleDocument }) {
  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.QUOTED;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
      {statusLabel(doc)}
    </span>
  );
}

export default function QuotesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lets global search (Ctrl/Cmd+K) land straight on a quote's detail drawer
  // via `/quotes?open=<id>` — it fetches by id itself, independent of the
  // currently loaded list.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setDetailId(id);
  }, []);

  const filters: DocumentListParams = { type: 'QUOTE', status: ['QUOTED', 'CANCELLED'] };
  const table = useServerTable<SaleDocument>({
    fetcher: (q) => documentsApi.listPage({ ...filters, sort: q.sort, offset: q.offset, limit: q.limit }),
    deps: [],
    defaultSort: { id: 'created', dir: 'desc' },
  });
  const { reload: load } = table;
  const documentActions = useDocumentActions({ onOpen: setDetailId, onEdit: setEditId, onChanged: load, onError: setError });
  const selection = useRowSelection<SaleDocument>((d) => d.id, []);

  const columns: Column<SaleDocument>[] = [
    { id: 'quoteNumber', header: 'Number', sortable: true, cell: (d) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{d.quoteNumber ?? '—'}</span> },
    { id: 'customer', header: 'Customer', sortable: true, cell: (d) => <span className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{customerOf(d)}</span> },
    { id: 'created', header: 'Date', sortable: true, defaultDir: 'desc', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.createdAt)}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (d) => <StatusPill doc={d} /> },
    { id: 'total', header: 'Total', sortable: true, defaultDir: 'desc', align: 'right', cell: (d) => <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(d.total)}</span> },
  ];

  const renderCard = (d: SaleDocument) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {customerOf(d)}
        </p>
        <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
          KSh {fmtNumber(d.total)}
        </p>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-ink-600)' }}>{d.quoteNumber ?? fmtDate(d.createdAt)}</span>
        <StatusPill doc={d} />
      </div>
    </div>
  );

  function exportRows(rows: SaleDocument[]) {
    const head = ['Number', 'Customer', 'Date', 'Status', 'Total (KSh)'];
    downloadCsv(`quotes-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows.map((d) => [d.quoteNumber, customerOf(d), d.createdAt.slice(0, 10), statusLabel(d), d.total])]);
    toast.success(`Exported ${rows.length} quote${rows.length === 1 ? '' : 's'}`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Quotes
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Quotes not yet converted to invoices.
          </p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Plus size={15} strokeWidth={2} />
          New quote
        </button>
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} role="alert" className="mt-4 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error} <span className="underline">Dismiss</span>
        </button>
      )}

      <div className="mt-5">
        <DataTable<SaleDocument>
          {...table.tableProps}
          caption="Quotes"
          columns={columns}
          rowKey={(d) => d.id}
          rowLabel={(d) => d.quoteNumber ?? customerOf(d)}
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
              <FileText size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No quotes yet
              </p>
            </>
          }
        />
      </div>

      <QuoteFormDrawer
        open={formOpen || !!editId}
        editId={editId}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
        }}
        onCreated={(id) => {
          load();
          setDetailId(id);
        }}
        onUpdated={(id) => {
          load();
          setDetailId(id);
        }}
      />
      {/* Editing hands off from the detail drawer to the form (one drawer at a
          time); saving reopens the detail so the new numbers are what you see. */}
      <DocumentDetailDrawer
        documentId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={load}
        onNavigate={setDetailId}
        onEdit={(id) => {
          setDetailId(null);
          setEditId(id);
        }}
      />
    </div>
  );
}
