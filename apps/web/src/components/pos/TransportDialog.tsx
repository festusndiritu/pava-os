'use client';

import { useState } from 'react';
import { NumericInput, toNumber } from '../ui/inputs';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';

export interface CartLine {
  product: { id: string; name: string; displayName: string | null };
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface TransportSettings {
  amount: number;
  allocation: 'QUANTITY';
  applyTo: string[]; // productIds
  manualAllocations: Record<string, number>;
  fold: boolean;
}

export function TransportDialog({
  lines,
  initial,
  onClose,
  onApply,
}: {
  lines: CartLine[];
  initial: TransportSettings | null;
  onClose: () => void;
  onApply: (settings: TransportSettings) => void;
}) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [fold, setFold] = useState(initial?.fold ?? true);
  const [applyTo, setApplyTo] = useState<Set<string>>(new Set(initial?.applyTo ?? lines.map((l) => l.product.id)));

  function apply() {
    const amt = toNumber(amount) ?? 0;
    onApply({
      amount: amt,
      allocation: 'QUANTITY',
      // A flat delivery line doesn't touch any item's price, so which items
      // it's "for" has no effect — send them all rather than ask.
      applyTo: fold ? [...applyTo] : lines.map((l) => l.product.id),
      manualAllocations: {},
      fold,
    });
    onClose();
  }

  function remove() {
    onApply({ amount: 0, allocation: 'QUANTITY', applyTo: [], manualAllocations: {}, fold: true });
    onClose();
  }

  return (
    <Modal onClose={onClose} placement="center" dismissOnBackdrop={false} label="Transport" className="max-w-sm p-5">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Transport
      </h3>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label htmlFor="transportdialog-amount-ksh" className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Amount (KSh)
          </label>
          <NumericInput id="transportdialog-amount-ksh"
            value={amount}
            onChange={setAmount}
            className="w-full rounded-md border px-3 py-2 text-sm data-num"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            How to apply it
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
              <input type="radio" name="transport-fold" checked={!fold} onChange={() => setFold(false)} />
              Add a delivery line with the amount
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
              <input type="radio" name="transport-fold" checked={fold} onChange={() => setFold(true)} />
              Split the amount into item prices
            </label>
          </div>
        </div>

        {fold && (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Which items absorb it
            </label>
            <div className="flex flex-col gap-1.5">
              {lines.map((l) => (
                <label key={l.product.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
                  <Checkbox
                    checked={applyTo.has(l.product.id)}
                    ariaLabel={l.product.displayName ?? l.product.name}
                    onChange={() =>
                      setApplyTo((prev) => {
                        const next = new Set(prev);
                        next.has(l.product.id) ? next.delete(l.product.id) : next.add(l.product.id);
                        return next;
                      })
                    }
                  />
                  {l.product.displayName ?? l.product.name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
              The customer sees "Delivery included" — not a separate line — and each selected item's price on the quote already reflects its share.
            </p>
          </div>
        )}

        <div className="mt-1 flex gap-2">
          <button type="button" onClick={remove} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
            Remove transport
          </button>
          <button type="button" onClick={apply} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
