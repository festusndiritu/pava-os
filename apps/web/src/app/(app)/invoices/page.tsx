'use client';

import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { documentsApi, type SaleDocument } from '../../../lib/documents-api';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Delivery note', bg: 'var(--color-bg)', fg: 'var(--color-ink-600)' },
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

export default function InvoicesPage() {
  const [tab, setTab] = useState<'invoices' | 'delivery-notes'>('invoices');
  const [docs, setDocs] = useState<SaleDocument[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setDocs(null);
    if (tab === 'delivery-notes') {
      const notes = await documentsApi.list({ type: 'DELIVERY_NOTE' });
      setDocs(notes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      return;
    }
    const [invoiced, paid] = await Promise.all([documentsApi.list({ status: 'INVOICED' }), documentsApi.list({ status: 'PAID' })]);
    setDocs([...invoiced, ...paid].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

      <div className="mt-4 flex gap-1.5">
        <button type="button" onClick={() => setTab('invoices')} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: tab === 'invoices' ? 'var(--color-accent)' : 'var(--color-border)', color: tab === 'invoices' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
          Invoices
        </button>
        <button type="button" onClick={() => setTab('delivery-notes')} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: tab === 'delivery-notes' ? 'var(--color-accent)' : 'var(--color-border)', color: tab === 'delivery-notes' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
          Delivery notes
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Number</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Customer</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>{tab === 'delivery-notes' ? 'Created' : 'Invoiced'}</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Status</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {docs === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}
            {docs?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>{tab === 'delivery-notes' ? 'No delivery notes yet' : 'No invoices yet'}</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>{tab === 'delivery-notes' ? "Create one from a quote or invoice's detail view." : 'Convert a quote to an invoice to see it here.'}</p>
                </td>
              </tr>
            )}
            {docs?.map((d) => {
              const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.DRAFT;
              return (
                <tr key={d.id} onClick={() => setDetailId(d.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 data-num" style={{ color: 'var(--color-ink-600)' }}>{d.deliveryNoteNumber ?? d.receiptNumber ?? d.invoiceNumber ?? '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>{d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.invoicedAt ?? d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {d.total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {docs === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {docs?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>{tab === 'delivery-notes' ? 'No delivery notes yet' : 'No invoices yet'}</p>
            </div>
          )}
          {docs?.map((d) => {
            const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.DRAFT;
            return (
              <button key={d.id} type="button" onClick={() => setDetailId(d.id)} className="flex w-full flex-col gap-1 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}</p>
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {d.total.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>{d.deliveryNoteNumber ?? d.receiptNumber ?? d.invoiceNumber ?? fmtDate(d.invoicedAt ?? d.createdAt)}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <DocumentDetailDrawer documentId={detailId} onClose={() => setDetailId(null)} onChanged={load} onNavigate={setDetailId} />
    </div>
  );
}