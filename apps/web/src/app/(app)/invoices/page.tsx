'use client';

import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { documentsApi, type SaleDocument } from '../../../lib/documents-api';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

export default function InvoicesPage() {
  const [docs, setDocs] = useState<SaleDocument[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    const [invoiced, paid] = await Promise.all([documentsApi.list({ status: 'INVOICED' }), documentsApi.list({ status: 'PAID' })]);
    setDocs([...invoiced, ...paid].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Invoices
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Converted from quotes. New invoices are created from a quote's detail view.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Customer</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Invoiced</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Status</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {docs === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}
            {docs?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No invoices yet</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>Convert a quote to an invoice to see it here.</p>
                </td>
              </tr>
            )}
            {docs?.map((d) => {
              const badge = STATUS_BADGE[d.status];
              return (
                <tr key={d.id} onClick={() => setDetailId(d.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
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

        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {docs === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {docs?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No invoices yet</p>
            </div>
          )}
          {docs?.map((d) => {
            const badge = STATUS_BADGE[d.status];
            return (
              <button key={d.id} type="button" onClick={() => setDetailId(d.id)} className="flex w-full flex-col gap-1 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}</p>
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {d.total.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.invoicedAt ?? d.createdAt)}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <DocumentDetailDrawer documentId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
    </div>
  );
}