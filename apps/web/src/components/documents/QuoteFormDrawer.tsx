'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { ProductPicker } from '../products/ProductPicker';
import { customersApi, type Customer } from '../../lib/customers-api';
import { documentsApi, type TransportMode } from '../../lib/documents-api';
import type { Product } from '../../lib/products-api';
import { ApiError } from '../../lib/api';

interface Line {
  product: Product;
  qty: string;
  unitPrice: string;
  discount: string;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function QuoteFormDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [walkinName, setWalkinName] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [transportAmount, setTransportAmount] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('NONE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerMode('walkin');
      setWalkinName('');
      setSelectedCustomer(null);
      setLines([]);
      setTransportAmount('');
      setTransportMode('NONE');
      setNotes('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (customerMode !== 'existing' || customerQuery.trim().length < 1) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => customersApi.list(customerQuery).then((r) => setCustomerResults(r.slice(0, 8))), 250);
    return () => clearTimeout(t);
  }, [customerQuery, customerMode]);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0), 0);
  const transportAmt = Number(transportAmount) || 0;
  const total = transportMode === 'ITEMIZED' ? subtotal + transportAmt : subtotal;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const doc = await documentsApi.create({
        customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
        customerName: customerMode === 'walkin' ? walkinName || undefined : undefined,
        items: lines.map((l) => ({
          productId: l.product.id,
          description: l.product.displayName ?? l.product.name,
          qty: Number(l.qty) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
        })),
        transportMode,
        transportAmount: transportAmt,
        notes: notes || undefined,
      });
      onCreated(doc.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this quote.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New quote"
      wide
      footer={
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Total: <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {total.toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
                {error}
              </span>
            )}
            <button type="submit" form="quote-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? 'Saving…' : 'Create quote'}
            </button>
          </div>
        </div>
      }
    >
      <form id="quote-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
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
              setLines((prev) => [...prev, { product: p, qty: '1', unitPrice: String(p.basePrice), discount: '' }]);
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
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Price</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Discount</th>
                  <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={line.product.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>{line.product.displayName ?? line.product.name}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={line.qty} onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: e.target.value } : l)))} className="w-16 rounded border px-2 py-1 text-sm data-num" style={inputStyle} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitPrice: e.target.value } : l)))} className="w-24 rounded border px-2 py-1 text-sm data-num" style={inputStyle} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, discount: e.target.value } : l)))} placeholder="0" className="w-20 rounded border px-2 py-1 text-sm data-num" style={inputStyle} />
                    </td>
                    <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                      KSh {((Number(line.qty) || 0) * (Number(line.unitPrice) || 0) - (Number(line.discount) || 0)).toLocaleString()}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Transport
            </label>
            <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode)} className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}>
              <option value="NONE">No transport</option>
              <option value="ITEMIZED">Shown as separate charge</option>
              <option value="DISTRIBUTED">Already folded into prices above</option>
            </select>
          </div>
          {transportMode !== 'NONE' && (
            <div>
              <label className={labelClass} style={labelStyle}>
                Transport amount (KSh)
              </label>
              <input type="number" min="0" value={transportAmount} onChange={(e) => setTransportAmount(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm data-num" style={inputStyle} />
            </div>
          )}
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
        </div>
      </form>
    </Drawer>
  );
}