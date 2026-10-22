'use client';

import { useEffect, useState } from 'react';
import { Download, FilePenLine, Receipt } from 'lucide-react';
import { documentsApi, type DocumentListParams, type SaleDocument } from '../../../lib/documents-api';
import { EditRequestsDialog } from '../../../components/documents/EditRequests';
import { useAuth } from '../../../lib/auth-context';
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
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

const customerOf = (d: SaleDocument) => d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in';
const numberOf = (d: SaleDocument) => d.receiptNumber ?? d.invoiceNumber ?? null;

function StatusPill({ doc }: { doc: SaleDocument }) {
  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.INVOICED;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
      {badge.label}
    </span>
  );
}

export default function InvoicesPage() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [queueOpen, setQueueOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState(0);
  const countPending = () => {
    if (!isAdmin) return;
    documentsApi.listEditRequests('PENDING').then((r) => setPendingEdits(r.length)).catch(() => {});
  };
  useEffect(countPending, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('open');
    if (id) setDetailId(id);
    if (params.get('approvals') && isAdmin) setQueueOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters: DocumentListParams = { status: ['INVOICED', 'PAID'] };
  const table = useServerTable<SaleDocument>({
    fetcher: (q) => documentsApi.listPage({ ...filters, sort: q.sort, offset: q.offset, limit: q.limit }),
    deps: [],
    defaultSort: { id: 'created', dir: 'desc' },
  });
  const { reload: load } = table;
  const documentActions = useDocumentActions({ onOpen: setDetailId, onChanged: load });
  const selection = useRowSelection<SaleDocument>((d) => d.id, []);

  const columns: Column<SaleDocument>[] = [
    { id: 'number', header: 'Number', cell: (d) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{numberOf(d) ?? '—'}</span> },
    { id: 'customer', header: 'Customer', sortable: true, cell: (d) => <span className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{customerOf(d)}</span> },
    { id: 'created', header: 'Invoiced', label: 'Date', sortable: true, defaultDir: 'desc', cell: (d) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.invoicedAt ?? d.createdAt)}</span> },
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
        <span style={{ color: 'var(--color-ink-600)' }}>{numberOf(d) ?? fmtDate(d.invoicedAt ?? d.createdAt)}</span>
        <StatusPill doc={d} />
      </div>
    </div>
  );

  function exportRows(rows: SaleDocument[]) {
    const head = ['Number', 'Customer', 'Date', 'Status', 'Total (KSh)'];
    const body = rows.map((d) => [numberOf(d), customerOf(d), (d.invoicedAt ?? d.createdAt).slice(0, 10), (STATUS_BADGE[d.status] ?? STATUS_BADGE.INVOICED).label, d.total]);
    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
    toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? '' : 's'}`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Invoices
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Invoices and paid sales.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            style={{ borderColor: pendingEdits > 0 ? 'var(--color-status-warn)' : 'var(--color-border)', color: pendingEdits > 0 ? 'var(--color-status-warn)' : 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}
          >
            <FilePenLine size={14} strokeWidth={2} />
            Edit requests{pendingEdits > 0 ? ` (${pendingEdits})` : ''}
          </button>
        )}
      </div>

      <div className="mt-5">
        <DataTable<SaleDocument>
          {...table.tableProps}
          caption="Invoices"
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
                No invoices yet
              </p>
            </>
          }
        />
      </div>

      <DocumentDetailDrawer
        documentId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => {
          load();
          countPending();
        }}
      />
      {queueOpen && (
        <EditRequestsDialog
          onClose={() => setQueueOpen(false)}
          onChanged={() => {
            load();
            countPending();
          }}
        />
      )}
    </div>
  );
}
