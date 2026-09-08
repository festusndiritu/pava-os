'use client';

import { FormEvent, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { ProductPicker } from '../products/ProductPicker';
import { inventoryApi, productsApi, type Product, type ReceiveLineResult } from '../../lib/products-api';
import { ApiError } from '../../lib/api';

interface Line {
  product: Product;
  quantity: string;
  unitCost: string;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

export function ReceiveInventoryDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<ReceiveLineResult[] | null>(null);

  function reset() {
    setSupplier('');
    setReference('');
    setNotes('');
    setLines([]);
    setError(null);
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await inventoryApi.receive({
        supplier,
        reference: reference || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
      });
      // Only worth asking about products whose suggested price actually differs from the current one.
      const worthAsking = result.lines.filter((l) => l.suggestedPrice !== l.currentPrice);
      if (worthAsking.length > 0) {
        setSuggestions(worthAsking);
      } else {
        reset();
        onDone();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this receipt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Receive inventory"
        subtitle="Records a delivery, creates cost lots, and increases stock"
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
              <button
                type="submit"
                form="receive-form"
                disabled={saving}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {saving ? 'Saving…' : 'Save receipt'}
              </button>
            </div>
          </div>
        }
      >
        <form id="receive-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                Supplier
              </label>
              <input required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                Reference
              </label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INV-10392" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Notes
            </label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Add product
            </label>
            <ProductPicker
              onSelect={(p) => {
                if (lines.some((l) => l.product.id === p.id)) return;
                setLines((prev) => [...prev, { product: p, quantity: '', unitCost: p.lastCost != null ? String(p.lastCost) : '' }]);
              }}
            />
          </div>

          {lines.length > 0 && (
            <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                      Product
                    </th>
                    <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                      Qty
                    </th>
                    <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                      Unit cost
                    </th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                      Total
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.product.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>
                        {line.product.displayName ?? line.product.name}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={line.quantity}
                          onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: e.target.value } : l)))}
                          className="w-20 rounded border px-2 py-1 text-sm data-num"
                          style={inputStyle}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={line.unitCost}
                          onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitCost: e.target.value } : l)))}
                          className="w-24 rounded border px-2 py-1 text-sm data-num"
                          style={inputStyle}
                        />
                      </td>
                      <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                        KSh {((Number(line.quantity) || 0) * (Number(line.unitCost) || 0)).toLocaleString()}
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
        </form>
      </Drawer>

      {suggestions && (
        <PriceSuggestionDialog
          suggestions={suggestions}
          onClose={() => {
            setSuggestions(null);
            reset();
            onDone();
          }}
        />
      )}
    </>
  );
}

function PriceSuggestionDialog({ suggestions, onClose }: { suggestions: ReceiveLineResult[]; onClose: () => void }) {
  const [decided, setDecided] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  async function apply(line: ReceiveLineResult, update: boolean) {
    if (update) {
      await productsApi.update(line.productId, { basePrice: line.suggestedPrice });
    }
    setDecided((prev) => ({ ...prev, [line.productId]: true }));
  }

  const allDecided = suggestions.every((s) => decided[s.productId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} />
      <div className="relative w-full max-w-md rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Update selling prices?
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          Based on the new cost, here's what each price would need to be to keep the same margin.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {suggestions.map((s) => (
            <div key={s.productId} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {s.productName}
              </p>
              <p className="mt-0.5 text-sm data-num" style={{ color: 'var(--color-ink-600)' }}>
                Currently KSh {s.currentPrice.toLocaleString()} · Suggested KSh {s.suggestedPrice.toLocaleString()}
              </p>
              {decided[s.productId] ? (
                <p className="mt-2 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>
                  Done
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => apply(s, false)}
                    className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    Keep KSh {s.currentPrice.toLocaleString()}
                  </button>
                  <button
                    type="button"
                    onClick={() => apply(s, true)}
                    className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Update to KSh {s.suggestedPrice.toLocaleString()}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!allDecided || saving}
          onClick={onClose}
          className="mt-4 w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}