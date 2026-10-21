'use client';

import { useState } from 'react';
import { Minus, Plus, Truck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { CommittedNumberInput } from '../ui/inputs';
import { fmtNumber } from '../../lib/format';

/**
 * One line of an order as the fulfilment decision sees it. `stockQty` is how
 * much leaves the shop's own stock; whatever is left of `qty` is supplied from
 * elsewhere and never touches shop inventory.
 */
export interface FulfilmentLine {
  key: string;
  name: string;
  unit: string;
  qty: number;
  /** What the shop has on the shelf right now — the ceiling for `stockQty`. */
  available: number;
  stockQty: number;
  supplierSource: string;
}

/** The starting split: take what the shop has, and let the rest come from elsewhere. */
export function defaultStockQty(qty: number, available: number): number {
  return Math.max(0, Math.min(qty, available));
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const mutedLabel = { color: 'var(--color-ink-600)', letterSpacing: '0.05em' };

/**
 * Where does this order come from? Hardware rarely fulfils in one tidy way —
 * cement may go straight from the supplier even with some on the shelf, a
 * driver may split a line between here and there — so the operator says, per
 * line, how much leaves the shop. Only that part comes off inventory; the sale
 * is recorded in full either way.
 */
export function FulfilmentDialog({
  title = 'Where does this order come from?',
  lines,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title?: string;
  lines: FulfilmentLine[];
  /** What confirming does, e.g. "Complete sale" or "Create invoice". */
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (lines: FulfilmentLine[]) => void;
}) {
  const [rows, setRows] = useState<FulfilmentLine[]>(lines);

  function patch(key: string, change: Partial<FulfilmentLine>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  const elsewhere = rows.filter((r) => r.stockQty < r.qty).length;

  return (
    <Modal onClose={onCancel} label={title} dismissOnBackdrop={false} className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
          <Truck size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            {title}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Set how much of each item leaves the shop. Only that part comes off your stock; the sale is recorded in full.
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-5">
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const outside = r.qty - r.stockQty;
            const max = Math.min(r.qty, Math.max(0, r.available));
            return (
              <li key={r.key} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {r.name}
                  </p>
                  <p className="data-num shrink-0 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    Ordered {fmtNumber(r.qty)} {r.unit}
                  </p>
                </div>
                <p className="data-num mt-0.5 text-xs" style={{ color: r.available < r.qty ? 'var(--color-status-warn)' : 'var(--color-ink-600)' }}>
                  {fmtNumber(Math.max(0, r.available))} {r.unit} in shop now
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase" style={mutedLabel}>
                    From shop
                  </span>
                  <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <button type="button" aria-label={`Less ${r.name} from shop`} onClick={() => patch(r.key, { stockQty: Math.max(0, r.stockQty - 1) })} className="flex h-10 w-10 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                      <Minus size={14} strokeWidth={2} />
                    </button>
                    <CommittedNumberInput
                      aria-label={`${r.name} from shop`}
                      min={0}
                      max={max}
                      value={r.stockQty}
                      onCommit={(n) => patch(r.key, { stockQty: Math.min(max, Math.max(0, n)) })}
                      className="data-num w-14 border-0 bg-transparent text-center text-sm outline-none"
                      style={{ color: 'var(--color-ink-900)' }}
                    />
                    <button type="button" aria-label={`More ${r.name} from shop`} onClick={() => patch(r.key, { stockQty: Math.min(max, r.stockQty + 1) })} className="flex h-10 w-10 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                      <Plus size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <button type="button" onClick={() => patch(r.key, { stockQty: max })} className="min-h-10 rounded-md border px-3 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    {max >= r.qty ? 'All' : 'Max'}
                  </button>
                  <button type="button" onClick={() => patch(r.key, { stockQty: 0 })} className="min-h-10 rounded-md border px-3 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    None
                  </button>
                </div>

                {outside > 0 ? (
                  <div className="mt-2">
                    <p className="data-num text-xs font-medium" style={{ color: 'var(--color-status-warn)' }}>
                      {fmtNumber(outside)} {r.unit} from elsewhere — not taken off your stock
                    </p>
                    <input
                      aria-label={`Where ${r.name} is collected from`}
                      value={r.supplierSource}
                      maxLength={120}
                      onChange={(e) => patch(r.key, { supplierSource: e.target.value })}
                      placeholder="Collect from (optional), e.g. Bamburi depot"
                      className="mt-1.5 min-h-10 w-full rounded-md border px-3 text-sm"
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    All of it leaves the shop.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <p className="text-xs" style={{ color: elsewhere > 0 ? 'var(--color-status-warn)' : 'var(--color-ink-600)' }} aria-live="polite">
          {elsewhere === 0 ? 'Everything comes from the shop.' : `${elsewhere} ${elsewhere === 1 ? 'item is' : 'items are'} supplied partly or wholly from elsewhere.`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(rows)}
            disabled={busy}
            className="min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
