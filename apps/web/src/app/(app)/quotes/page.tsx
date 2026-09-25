'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { documentsApi } from '../../../lib/documents-api';
import { QuoteFormDrawer } from '../../../components/documents/QuoteFormDrawer';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';
import { DocumentRowActions } from '../../../components/documents/DocumentRowActions';
import { fmtNumber } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';
import { usePagedList } from '../../../lib/use-paged-list';
import { ListFooter } from '../../../components/ui/ListFooter';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  QUOTED: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  CANCELLED: { bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

export default function QuotesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lets global search (Ctrl/Cmd+K) land straight on a quote's detail drawer
  // via `/quotes?open=<id>` — it fetches by id itself, independent of the
  // currently loaded list.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setDetailId(id);
  }, []);

  const { items: docs, hasMore, loadingMore, error: listError, loadMore, reload: load } = usePagedList(
    (offset, limit) => documentsApi.list({ type: 'QUOTE', status: ['QUOTED', 'CANCELLED'], offset, limit }),
    [],
  );

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
        <button type="button" onClick={() => setFormOpen(true)} className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Plus size={15} strokeWidth={2} />
          New quote
        </button>
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} className="mt-4 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </button>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Number</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Customer</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Date</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Status</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}
            {docs?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FileText size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No quotes yet</p>
                </td>
              </tr>
            )}
            {docs?.map((d) => {
              const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.QUOTED;
              return (
                <tr key={d.id} onClick={() => setDetailId(d.id)} onKeyDown={activateOnKey(() => setDetailId(d.id))} tabIndex={0} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 data-num" style={{ color: 'var(--color-ink-600)' }}>{d.quoteNumber ?? '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>{d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{fmtDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>{d.status === 'CANCELLED' ? 'Cancelled' : 'Quote'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(d.total)}</td>
                  <td className="px-2 py-2">
                    <DocumentRowActions doc={d} onOpen={setDetailId} onChanged={load} onError={setError} />
                  </td>
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
              <FileText size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No quotes yet</p>
            </div>
          )}
          {docs?.map((d) => {
            const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.QUOTED;
            return (
              <div key={d.id} onClick={() => setDetailId(d.id)} onKeyDown={activateOnKey(() => setDetailId(d.id))} tabIndex={0} role="button" className="flex w-full flex-col gap-1 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}</p>
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(d.total)}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>{d.quoteNumber ?? fmtDate(d.createdAt)}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>{d.status === 'CANCELLED' ? 'Cancelled' : 'Quote'}</span>
                </div>
                <div className="mt-1.5">
                  <DocumentRowActions doc={d} onOpen={setDetailId} onChanged={load} onError={setError} />
                </div>
              </div>
            );
          })}
        </div>
        <ListFooter hasMore={hasMore} loadingMore={loadingMore} error={listError} onMore={loadMore} onRetry={load} />
      </div>

      <QuoteFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onCreated={(id) => { load(); setDetailId(id); }} />
      <DocumentDetailDrawer documentId={detailId} onClose={() => setDetailId(null)} onChanged={load} onNavigate={setDetailId} />
    </div>
  );
}