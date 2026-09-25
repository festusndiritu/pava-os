'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { inventoryApi } from '../../lib/products-api';
import type { Product } from '../../lib/products-api';
import { ApiError } from '../../lib/api';
import { NumericInput, toNumber } from '../ui/inputs';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';

interface NegativeStock {
  current: number;
  change: number;
  resulting: number;
}

function readNegativeStock(details: Record<string, unknown> | null | undefined): NegativeStock | null {
  if (!details || details.code !== 'NEGATIVE_STOCK') return null;
  const { current, change, resulting } = details as Record<string, unknown>;
  if (typeof current !== 'number' || typeof change !== 'number' || typeof resulting !== 'number') return null;
  return { current, change, resulting };
}

/**
 * The one place a manual stock count gets corrected, shared by the Products
 * detail drawer and the Inventory stock-levels tab. A correction that would
 * take stock below zero gets the same structured confirmation as an
 * insufficient-stock sale elsewhere — the numbers, not a raw error string.
 */
export function AdjustStockDialog({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<'ADJUSTMENT' | 'CORRECTION' | 'RETURN'>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [negative, setNegative] = useState<NegativeStock | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(allowNegative = false) {
    const qty = toNumber(quantity);
    if (!qty) {
      setError('Enter a quantity — use a negative number to reduce stock.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await inventoryApi.adjust({ productId: product.id, quantity: qty, type, note: note || undefined, allowNegative });
      toast.success('Stock adjusted');
      onDone();
    } catch (err) {
      const detected = err instanceof ApiError ? readNegativeStock(err.details) : null;
      if (detected) setNegative(detected);
      else setError(err instanceof ApiError ? err.message : 'Could not adjust stock.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} dismissOnBackdrop={false} label={`Adjust stock — ${product.displayName ?? product.name}`} className="p-5 sm:max-w-sm">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Adjust stock — {product.displayName ?? product.name}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          Current: {product.stockQuantity} {product.unit.symbol}
        </p>

        {negative ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-status-warn)', backgroundColor: 'var(--color-status-warnSoft)' }}>
              <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-status-warn)' }}>
                <AlertTriangle size={14} strokeWidth={2} />
                This takes stock below zero
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>Current</dt>
                  <dd className="data-num text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>{negative.current}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>Change</dt>
                  <dd className="data-num text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>{negative.change > 0 ? '+' : ''}{negative.change}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>Resulting</dt>
                  <dd className="data-num text-sm font-semibold" style={{ color: 'var(--color-status-bad)' }}>{negative.resulting}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setNegative(null)} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(true)}
                className="flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-status-warn)' }}
              >
                {saving ? 'Saving…' : 'Proceed anyway'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
            >
              <option value="ADJUSTMENT">Stocktake adjustment</option>
              <option value="CORRECTION">Correction</option>
              <option value="RETURN">Customer return</option>
            </select>
            <NumericInput
              allowNegative
              value={quantity}
              onChange={setQuantity}
              placeholder="Quantity (use a negative number to reduce)"
              className="w-full rounded-md border px-3 py-2 text-sm data-num"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason (recommended)"
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
            />

            {error && (
              <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
                {error}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={saving || !quantity}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {saving ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
    </Modal>
  );
}