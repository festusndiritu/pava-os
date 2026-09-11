'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { documentsApi, type SaleDocument } from '../../lib/documents-api';
import { ApiError } from '../../lib/api';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--color-bg)', fg: 'var(--color-ink-600)' },
  QUOTED: { label: 'Quote', bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

export function DocumentDetailDrawer({ documentId, onClose, onChanged }: { documentId: string | null; onClose: () => void; onChanged: () => void }) {
  const [doc, setDoc] = useState<SaleDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!documentId) return;
    setLoading(true);
    setDoc(await documentsApi.get(documentId));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (!documentId) return null;

  async function runAction(fn: () => Promise<SaleDocument>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete that action.');
    } finally {
      setBusy(false);
    }
  }

  const status = doc ? STATUS_LABEL[doc.status] : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={doc?.customer?.businessName || doc?.customer?.name || doc?.customerName || 'Walk-in customer'}
      subtitle={doc ? `${doc.type === 'QUOTE' ? 'Quote' : doc.type === 'INVOICE' ? 'Invoice' : 'Receipt'} · ${fmtDate(doc.createdAt)}` : undefined}
      footer={
        doc && (
          <div className="flex flex-col gap-2">
            {error && (
              <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
                {error}
              </p>
            )}
            <div className="flex gap-2">
              {doc.status === 'QUOTED' && (
                <>
                  <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.cancel(doc.id))} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                    Cancel quote
                  </button>
                  <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.convertToInvoice(doc.id))} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
                    Convert to invoice
                  </button>
                </>
              )}
              {doc.status === 'INVOICED' && (
                <>
                  <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.cancel(doc.id))} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                    Cancel invoice
                  </button>
                  <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.markPaid(doc.id))} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
                    Mark paid
                  </button>
                </>
              )}
              {(doc.status === 'PAID' || doc.status === 'CANCELLED') && (
                <button type="button" onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                  <Printer size={14} strokeWidth={2} />
                  Print
                </button>
              )}
            </div>
          </div>
        )
      }
    >
      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Loading…
        </p>
      )}

      {doc && !loading && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            {status && (
              <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: status.bg, color: status.fg }}>
                {status.label}
              </span>
            )}
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              By {doc.createdBy.name}
            </p>
          </div>

          <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Item</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Qty × Price</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>
                      {item.description}
                      {item.discount > 0 && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--color-status-bad)' }}>
                          -{money(item.discount)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-600)' }}>
                      {item.qty} × {money(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {money(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-ink-600)' }}>Subtotal</span>
              <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.subtotal)}</span>
            </div>
            {doc.transportAmount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-ink-600)' }}>Transport {doc.transportMode === 'DISTRIBUTED' ? '(included in prices)' : ''}</span>
                <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.transportAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span style={{ color: 'var(--color-ink-900)' }}>Total</span>
              <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.total)}</span>
            </div>
          </div>

          {doc.notes && (
            <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Notes: {doc.notes}
            </p>
          )}

          <div className="flex flex-col gap-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {doc.invoicedAt && <p>Invoiced: {fmtDate(doc.invoicedAt)}</p>}
            {doc.paidAt && <p>Paid: {fmtDate(doc.paidAt)}</p>}
          </div>
        </div>
      )}
    </Drawer>
  );
}