'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Minus, Plus, Receipt, RotateCcw, Search, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { documentsApi, type SaleDocument } from '../../lib/documents-api';
import { posApi, type ReturnableSale, type SaleReturn } from '../../lib/pos-api';

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}

/**
 * Partial returns against a completed sale. The original sale is never
 * edited: quantities are checked against what is still returnable (sold minus
 * anything given back on an earlier return), and the backend writes a
 * separate return record, restores stock and handles the refund.
 */
export function ReturnDialog({ onClose, onCompleted }: { onClose: () => void; onCompleted: (result: SaleReturn) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SaleDocument[] | null>(null);
  const [sale, setSale] = useState<ReturnableSale | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'MPESA'>('CASH');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SaleReturn | null>(null);

  // Most returns are for something bought today, so the recent sales are
  // listed before anything is typed.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const term = query.trim();
        const [paid, invoiced] = await Promise.all([
          documentsApi.list({ status: 'PAID', search: term || undefined }),
          documentsApi.list({ status: 'INVOICED', search: term || undefined }),
        ]);
        setResults(
          [...paid, ...invoiced]
            .filter((d) => d.type !== 'DELIVERY_NOTE')
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, 12),
        );
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function openSale(id: string) {
    setError(null);
    setBusy(true);
    try {
      const detail = await posApi.returnable(id);
      setSale(detail);
      setQuantities({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that sale.');
    } finally {
      setBusy(false);
    }
  }

  function setQty(documentItemId: string, next: number, max: number) {
    const clamped = Math.max(0, Math.min(next, max));
    setQuantities((prev) => ({ ...prev, [documentItemId]: clamped }));
  }

  const selected = sale ? sale.items.filter((i) => (quantities[i.documentItemId] || 0) > 0) : [];
  const refundTotal = selected.reduce((sum, i) => sum + (quantities[i.documentItemId] || 0) * i.unitPrice, 0);
  const onAccount = sale?.paymentMethod === 'CREDIT';

  async function submit() {
    if (!sale || selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await posApi.createReturn(sale.id, {
        items: selected.map((i) => ({ documentItemId: i.documentItemId, qty: quantities[i.documentItemId] })),
        refundMethod: onAccount ? undefined : refundMethod,
        reason: reason.trim() || undefined,
      });
      setDone(result);
      onCompleted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this return.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border sm:max-w-lg sm:rounded-lg"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {done ? 'Return recorded' : sale ? 'Return items' : 'Find the original sale'}
            </h2>
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {done
                ? done.returnNumber
                : sale
                  ? `${sale.receiptNumber ?? sale.invoiceNumber ?? ''} · ${sale.customerLabel}`
                  : 'Search by receipt number or customer'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
            </p>
          )}

          {done && (
            <div className="py-6 text-center">
              <CheckCircle2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-status-ok)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {money(done.total)} returned
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                Stock has been put back and the original sale is unchanged.
              </p>
            </div>
          )}

          {!done && !sale && (
            <>
              <div className="relative">
                <Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Receipt number or customer name"
                  className="min-h-11 w-full rounded-md border pl-10 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
                />
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                {results?.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openSale(d.id)}
                    className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-left"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <Receipt size={15} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={{ color: 'var(--color-ink-900)' }}>
                        {d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in customer'}
                      </span>
                      <span className="block truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {d.receiptNumber ?? d.invoiceNumber ?? '—'} · {fmtDate(d.createdAt)}
                      </span>
                    </span>
                    <span className="data-num shrink-0 text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {money(d.total)}
                    </span>
                  </button>
                ))}
                {results?.length === 0 && (
                  <p className="py-8 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    No matching sales.
                  </p>
                )}
              </div>
            </>
          )}

          {!done && sale && (
            <>
              <div className="flex flex-col gap-2">
                {sale.items.map((item) => {
                  const picked = quantities[item.documentItemId] || 0;
                  const exhausted = item.qtyReturnable <= 0;
                  return (
                    <div
                      key={item.documentItemId}
                      className="rounded-md border p-3"
                      style={{ borderColor: picked > 0 ? 'var(--color-accent)' : 'var(--color-border)', backgroundColor: picked > 0 ? 'var(--color-accent-soft)' : 'transparent', opacity: exhausted ? 0.55 : 1 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                            {item.description}
                          </p>
                          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                            Sold {item.qtySold}
                            {item.unit ? ` ${item.unit}` : ''} · {money(item.unitPrice)} each
                            {item.qtyReturned > 0 ? ` · ${item.qtyReturned} already returned` : ''}
                          </p>
                        </div>
                        {!exhausted && (
                          <div className="flex shrink-0 items-center rounded-md border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                            <button
                              type="button"
                              aria-label="Less"
                              onClick={() => setQty(item.documentItemId, picked - 1, item.qtyReturnable)}
                              className="flex h-10 w-10 items-center justify-center"
                              style={{ color: 'var(--color-ink-600)' }}
                            >
                              <Minus size={14} strokeWidth={2} />
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={picked || ''}
                              placeholder="0"
                              onChange={(e) => setQty(item.documentItemId, Number(e.target.value) || 0, item.qtyReturnable)}
                              className="data-num w-12 border-0 bg-transparent text-center text-sm outline-none"
                              style={{ color: 'var(--color-ink-900)' }}
                            />
                            <button
                              type="button"
                              aria-label="More"
                              onClick={() => setQty(item.documentItemId, picked + 1, item.qtyReturnable)}
                              className="flex h-10 w-10 items-center justify-center"
                              style={{ color: 'var(--color-ink-600)' }}
                            >
                              <Plus size={14} strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs" style={{ color: exhausted ? 'var(--color-ink-600)' : 'var(--color-status-ok)' }}>
                        {exhausted ? 'Fully returned' : `${item.qtyReturnable} still returnable`}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
                  Refund
                </p>
                {onAccount ? (
                  <p className="mt-1.5 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                    Credited back to the customer&apos;s account.
                  </p>
                ) : (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(['MPESA', 'CASH'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRefundMethod(m)}
                        className="min-h-11 rounded-md border text-sm font-medium"
                        style={{
                          borderColor: refundMethod === m ? 'var(--color-accent)' : 'var(--color-border)',
                          color: refundMethod === m ? 'var(--color-accent)' : 'var(--color-ink-600)',
                          backgroundColor: refundMethod === m ? 'var(--color-accent-soft)' : 'transparent',
                        }}
                      >
                        {m === 'MPESA' ? 'M-Pesa' : 'Cash'}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="mt-2 min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
                />
              </div>
            </>
          )}
        </div>

        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {done ? (
            <button type="button" onClick={onClose} className="min-h-11 w-full rounded-md px-4 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              Done
            </button>
          ) : sale ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSale(null);
                  setQuantities({});
                }}
                className="min-h-11 rounded-md border px-4 text-sm font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={selected.length === 0 || busy}
                onClick={submit}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <RotateCcw size={15} strokeWidth={2} />
                {busy ? 'Recording…' : `Return ${selected.length > 0 ? money(refundTotal) : 'items'}`}
              </button>
            </div>
          ) : (
            <p className="text-center text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Pick the sale the items were bought on.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}