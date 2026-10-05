'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Trash2, Truck, X } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { ProductPicker } from '../products/ProductPicker';
import { customersApi, type Customer } from '../../lib/customers-api';
import { canEditQuote, documentsApi, type CreateDocumentInput, type SaleDocument } from '../../lib/documents-api';
import type { Product } from '../../lib/products-api';
import { ApiError } from '../../lib/api';
import { TransportDialog, type TransportSettings } from '../pos/TransportDialog';
import { NumericInput, toNumber } from '../ui/inputs';
import { fmtNumber } from '../../lib/format';

interface Line {
  product: Product;
  qty: string;
  unitPrice: string;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

/**
 * What the person typed for a saved line, recovered from what was stored.
 * With transport folded into prices the stored unit price already includes
 * its share of transport plus rounding, so the negotiated price is rebuilt by
 * taking those back out of the line total. Otherwise it is stored as typed.
 */
function negotiatedUnitPrice(doc: SaleDocument, item: SaleDocument['items'][number]) {
  if (doc.transportMode !== 'DISTRIBUTED') return item.unitPrice;
  return Math.round((item.lineTotal - item.transportAllocated - item.roundingAdjustment) / item.qty);
}

/**
 * Creates a quote, or — when `editId` is given — edits that quote in place
 * (same quote number). The same form either way, so a change can never be
 * priced differently from how it would have been the first time.
 */
export function QuoteFormDrawer({
  open,
  onClose,
  onCreated,
  editId,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  editId?: string | null;
  onUpdated?: (id: string) => void;
}) {
  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [walkinName, setWalkinName] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [transport, setTransport] = useState<TransportSettings | null>(null);
  const [transportOpen, setTransportOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  // Edit mode only: true once the quote has been fetched and prefilled, so a
  // failed load can never be saved over the real quote with an empty form.
  const [editReady, setEditReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerMode('walkin');
      setWalkinName('');
      setSelectedCustomer(null);
      setLines([]);
      setTransport(null);
      setNotes('');
      setError(null);
      setQuoteNumber(null);
      setEditReady(false);
      setLoadingQuote(false);
    }
  }, [open]);

  // Edit mode: fetch the quote by id (the list rows don't carry full product
  // details) and prefill every field from it.
  useEffect(() => {
    if (!open || !editId) return;
    let stale = false;
    setLoadingQuote(true);
    setError(null);
    documentsApi
      .get(editId)
      .then((doc) => {
        if (stale) return;
        if (!canEditQuote(doc) || doc.items.some((i) => !i.product)) {
          setError(doc.status === 'QUOTED' ? 'This quote has lines the form cannot edit.' : 'Only a quote that has not been invoiced can be edited.');
          return;
        }
        setQuoteNumber(doc.quoteNumber);
        setEditReady(true);
        if (doc.customerId && doc.customer) {
          setCustomerMode('existing');
          setSelectedCustomer(doc.customer);
          setWalkinName('');
        } else {
          setCustomerMode('walkin');
          setSelectedCustomer(null);
          setWalkinName(doc.customerName ?? '');
        }
        setLines(doc.items.map((i) => ({ product: i.product!, qty: String(i.qty), unitPrice: String(negotiatedUnitPrice(doc, i)) })));
        const folded = doc.transportMode === 'DISTRIBUTED';
        if (doc.transportAmount > 0) {
          const absorbing = doc.items.filter((i) => i.transportAllocated > 0).map((i) => i.productId!);
          setTransport({
            amount: doc.transportAmount,
            allocation: 'QUANTITY',
            applyTo: folded && absorbing.length > 0 ? absorbing : doc.items.map((i) => i.productId!),
            manualAllocations: {},
            fold: folded,
          });
        } else {
          setTransport(null);
        }
        setNotes(doc.notes ?? '');
      })
      .catch((err) => {
        if (!stale) setError(err instanceof ApiError ? err.message : 'Could not load this quote.');
      })
      .finally(() => {
        if (!stale) setLoadingQuote(false);
      });
    return () => {
      stale = true;
    };
  }, [open, editId]);

  useEffect(() => {
    if (customerMode !== 'existing' || customerQuery.trim().length < 1) {
      setCustomerResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(
      () =>
        customersApi.list(customerQuery).then((r) => {
          if (!stale) setCustomerResults(r.slice(0, 8));
        }),
      250,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [customerQuery, customerMode]);

  // Approximate for the footer — the server computes the precise, correctly-rounded total.
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const transportAmt = transport?.amount || 0;
  const total = subtotal + transportAmt;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateDocumentInput = {
        customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
        customerName: customerMode === 'walkin' ? walkinName || undefined : undefined,
        items: lines.map((l) => ({
          productId: l.product.id,
          qty: toNumber(l.qty) ?? 0,
          unitPrice: toNumber(l.unitPrice) ?? 0,
        })),
        transportAmount: transport?.amount || undefined,
        transportAllocation: transport?.allocation,
        transportApplyTo: transport?.applyTo,
        manualAllocations: undefined,
        foldTransportIntoPrices: transport?.fold ?? true,
        notes: notes || undefined,
      };
      if (editId) {
        const doc = await documentsApi.update(editId, payload);
        onUpdated?.(doc.id);
      } else {
        const doc = await documentsApi.create(payload);
        onCreated(doc.id);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editId ? 'Could not save these changes.' : 'Could not create this quote.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      guardUnsaved
      open={open}
      onClose={onClose}
      title={editId ? `Edit quote${quoteNumber ? ` ${quoteNumber}` : ''}` : 'New quote'}
      wide
      footer={
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Total: <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(total)}</span>
          </p>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
                {error}
              </span>
            )}
            <button type="submit" form="quote-form" disabled={saving || loadingQuote || (!!editId && !editReady)} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Create quote'}
            </button>
          </div>
        </div>
      }
    >
      {loadingQuote && (
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Loading quote…
        </p>
      )}

      <form id="quote-form" onSubmit={handleSubmit} className={loadingQuote ? 'hidden' : 'flex flex-col gap-5'}>
        <div>
          <label className={labelClass} style={labelStyle}>
            Customer
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setCustomerMode('walkin')} className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium" style={{ borderColor: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
              Walk-in
            </button>
            <button type="button" onClick={() => setCustomerMode('existing')} className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium" style={{ borderColor: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
              Existing customer
            </button>
          </div>
          {customerMode === 'walkin' ? (
            <input value={walkinName} onChange={(e) => setWalkinName(e.target.value)} placeholder="Customer name (optional)" className="mt-2 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
          ) : (
            <div className="relative mt-2">
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm" style={inputStyle}>
                  <span>{selectedCustomer.businessName || selectedCustomer.name}</span>
                  <button type="button" onClick={() => setSelectedCustomer(null)} style={{ color: 'var(--color-ink-600)' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <>
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search customers…" className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      {customerResults.map((c) => (
                        <button key={c.id} type="button" onClick={() => { setSelectedCustomer(c); setCustomerQuery(''); setCustomerResults([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg)]" style={{ color: 'var(--color-ink-900)' }}>
                          {c.businessName || c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Add product
          </label>
          <ProductPicker
            onSelect={(p) => {
              if (lines.some((l) => l.product.id === p.id)) return;
              setLines((prev) => [...prev, { product: p, qty: '1', unitPrice: String(p.basePrice) }]);
            }}
          />
        </div>

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Product</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Qty</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Unit price</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={line.product.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>{line.product.displayName ?? line.product.name}</td>
                    <td className="px-3 py-2">
                      <NumericInput min={1} aria-label="Quantity" value={line.qty} onChange={(v) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: v } : l)))} className="w-16 rounded border px-2 py-1 text-sm data-num" style={inputStyle} />
                    </td>
                    <td className="px-3 py-2">
                      <NumericInput
                        aria-label="Unit price"
                        value={line.unitPrice}
                        onChange={(v) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitPrice: v } : l)))}
                        className="w-24 rounded border px-2 py-1 text-sm data-num"
                        style={inputStyle}
                        title="Edit directly to the price you negotiated — this is the final price, not a list price to discount from."
                      />
                    </td>
                    <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                      KSh {fmtNumber((toNumber(line.qty) ?? 0) * (toNumber(line.unitPrice) ?? 0))}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} style={{ color: 'var(--color-status-bad)' }}>
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <label className={labelClass} style={labelStyle}>
            Transport
          </label>
          <button
            type="button"
            onClick={() => setTransportOpen(true)}
            disabled={lines.length === 0}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: transport ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
          >
            <span className="flex items-center gap-1.5">
              <Truck size={14} strokeWidth={2} />
              {transport ? `KSh ${fmtNumber(transport.amount)}${transport.fold ? ' (folded into prices)' : ' (shown separately)'}` : 'No transport'}
            </span>
            <span>{transport ? 'Edit' : '+ Add'}</span>
          </button>
        </div>

        <div>
          <label htmlFor="quoteformdrawer-notes" className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea id="quoteformdrawer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
        </div>
      </form>

      {transportOpen && (
        <TransportDialog
          lines={lines.map((l) => ({ product: l.product, qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0, discount: 0 }))}
          initial={transport}
          onClose={() => setTransportOpen(false)}
          onApply={(t) => setTransport(t.amount > 0 ? t : null)}
        />
      )}
    </Drawer>
  );
}