'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { inventoryApi } from '../../lib/products-api';
import type { AdjustType, Product } from '../../lib/products-api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { fmtNumber } from '../../lib/format';
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

type Mode = 'add' | 'remove' | 'count';

const MODES: { value: Mode; label: string }[] = [
  { value: 'add', label: 'Add stock' },
  { value: 'remove', label: 'Remove stock' },
  { value: 'count', label: 'Set count' },
];

// Direction decides which reasons make sense: damage and loss only ever take
// stock off, a customer return only ever puts it back.
const REASONS: Record<'add' | 'remove', { value: AdjustType; label: string }[]> = {
  add: [
    { value: 'ADJUSTMENT', label: 'Stocktake — found more than recorded' },
    { value: 'CORRECTION', label: 'Correction — entry error' },
    { value: 'RETURN', label: 'Customer return' },
  ],
  remove: [
    { value: 'ADJUSTMENT', label: 'Stocktake — found less than recorded' },
    { value: 'CORRECTION', label: 'Correction — entry error' },
    { value: 'DAMAGE', label: 'Damaged' },
    { value: 'LOSS', label: 'Lost or stolen' },
  ],
};

const fieldStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

/**
 * The one place a manual stock change gets made, shared by the Products
 * detail drawer, the Products table and the Inventory stock-levels tab.
 *
 * Three ways in, because they are three different jobs at the counter: add
 * what turned up, remove what is gone (with a reason that says why), or just
 * type the number you counted and let the difference work itself out. Stock
 * that is being added can carry what it cost, so it is valued properly
 * instead of entering the books as free. A change that would take stock below
 * zero still gets the same structured confirmation as an insufficient-stock
 * sale elsewhere.
 */
export function AdjustStockDialog({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { canViewCost } = useAuth();
  const showCost = canViewCost();
  const hasLastCost = product.lastCost != null && product.lastCost > 0;

  const [mode, setMode] = useState<Mode>('add');
  const [reason, setReason] = useState<AdjustType>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(hasLastCost ? String(product.lastCost) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [negative, setNegative] = useState<NegativeStock | null>(null);
  const [saving, setSaving] = useState(false);

  const name = product.displayName ?? product.name;
  const symbol = product.unit.symbol;
  const entered = toNumber(quantity);

  // The signed change this form describes, or null until it describes one.
  const change = entered === null ? null : mode === 'add' ? entered : mode === 'remove' ? -entered : entered - product.stockQuantity;
  const resulting = change === null ? null : product.stockQuantity + change;
  const adding = change !== null && change > 0;
  const reducing = change !== null && change < 0;

  function switchMode(next: Mode) {
    setMode(next);
    setQuantity('');
    setError(null);
    // The reasons on offer depend on direction; fall back to stocktake.
    setReason('ADJUSTMENT');
  }

  async function submit(allowNegative = false) {
    setError(null);
    if (change === null) {
      setError(mode === 'count' ? 'Enter the quantity you counted.' : 'Enter a quantity.');
      return;
    }
    if (change === 0) {
      setError(mode === 'count' ? 'That matches what is already recorded, so there is nothing to adjust.' : 'Enter a quantity above zero.');
      return;
    }
    if (reducing && !note.trim()) {
      setError('Say why stock is being taken off. It goes in the audit trail.');
      return;
    }
    const cost = toNumber(unitCost);
    if (adding && showCost && !hasLastCost && !cost) {
      setError('Enter what this stock cost per unit. Without a cost it can’t be valued.');
      return;
    }

    setSaving(true);
    try {
      await inventoryApi.adjust({
        productId: product.id,
        quantity: change,
        type: mode === 'count' ? 'ADJUSTMENT' : reason,
        note: note.trim() || undefined,
        allowNegative,
        // Only meaningful for added stock, and only for people allowed to see cost.
        unitCost: adding && showCost && cost ? cost : undefined,
      });
      toast.success(`${name}: now ${fmtNumber(Math.max(0, product.stockQuantity + change))} ${symbol}`);
      onDone();
    } catch (err) {
      const detected = err instanceof ApiError ? readNegativeStock(err.details) : null;
      if (detected) setNegative(detected);
      else setError(err instanceof ApiError ? err.message : 'Could not adjust stock.');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(false);
  }

  return (
    <Modal onClose={onClose} dismissOnBackdrop={false} label={`Adjust stock — ${name}`} className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-md">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Adjust stock — {name}
      </h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
        On record now: <span className="data-num font-medium">{fmtNumber(product.stockQuantity)}</span> {symbol}
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
            <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Recorded stock never goes below zero. Proceeding removes only what is actually on record.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setNegative(null)} className="min-h-11 flex-1 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="min-h-11 flex-1 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-status-warn)' }}
            >
              {saving ? 'Saving…' : 'Proceed anyway'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
          <div role="group" aria-label="What are you doing?" className="grid grid-cols-3 gap-1.5">
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => switchMode(m.value)}
                  className="min-h-10 rounded-md border px-2 text-sm font-medium"
                  style={{
                    borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: selected ? 'var(--color-accent-soft)' : 'transparent',
                    color: selected ? 'var(--color-accent)' : 'var(--color-ink-600)',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="adjust-quantity" className={labelClass} style={labelStyle}>
              {mode === 'count' ? `Counted (${symbol})` : mode === 'add' ? `Quantity to add (${symbol})` : `Quantity to remove (${symbol})`}
            </label>
            <NumericInput
              id="adjust-quantity"
              data-autofocus
              value={quantity}
              onChange={setQuantity}
              className="w-full rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]"
              style={fieldStyle}
            />
            {resulting !== null && change !== 0 && (
              <p className="mt-1.5 text-xs data-num" style={{ color: resulting < 0 ? 'var(--color-status-bad)' : 'var(--color-ink-600)' }} aria-live="polite">
                {fmtNumber(product.stockQuantity)} → {fmtNumber(resulting)} {symbol} ({change! > 0 ? '+' : ''}
                {fmtNumber(change!)})
                {resulting < 0 ? ' · below zero' : ''}
              </p>
            )}
          </div>

          {mode !== 'count' && (
            <div>
              <label htmlFor="adjust-reason" className={labelClass} style={labelStyle}>
                Reason
              </label>
              <select id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustType)} className="w-full rounded-md border px-3 py-2 text-sm" style={fieldStyle}>
                {REASONS[mode].map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {adding && showCost && (
            <div>
              <label htmlFor="adjust-cost" className={labelClass} style={labelStyle}>
                Unit cost (KSh){hasLastCost ? '' : ' — required'}
              </label>
              <NumericInput id="adjust-cost" value={unitCost} onChange={setUnitCost} className="w-full rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]" style={fieldStyle} />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {hasLastCost ? 'Defaults to the last cost. Change it if these units cost something different.' : 'This product has no cost on record yet. Stock without one is valued at zero.'}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="adjust-note" className={labelClass} style={labelStyle}>
              Note{reducing ? ' — required' : ' (optional)'}
            </label>
            <input
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={reducing ? 'e.g. rusted in the yard, 3 lengths cut short' : 'e.g. found in the back store'}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={fieldStyle}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || quantity === ''} className="min-h-11 flex-1 rounded-md px-4 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
