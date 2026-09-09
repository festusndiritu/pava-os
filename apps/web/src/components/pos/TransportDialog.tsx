'use client';

import { useState } from 'react';
import type { TransportAllocation } from '../../lib/pos-api';

export interface CartLine {
  product: { id: string; name: string; displayName: string | null };
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface TransportSettings {
  amount: number;
  allocation: TransportAllocation;
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
  const [allocation, setAllocation] = useState<TransportAllocation>(initial?.allocation ?? 'QUANTITY');
  const [applyTo, setApplyTo] = useState<Set<string>>(new Set(initial?.applyTo ?? lines.map((l) => l.product.id)));
  const [manual, setManual] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.product.id, String(initial?.manualAllocations?.[l.product.id] ?? '')])),
  );
  const [fold, setFold] = useState(initial?.fold ?? true);

  const manualSum = Object.values(manual).reduce((s, v) => s + (Number(v) || 0), 0);

  function apply() {
    const amt = Number(amount) || 0;
    onApply({
      amount: amt,
      allocation,
      applyTo: [...applyTo],
      manualAllocations: Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, Number(v) || 0])),
      fold,
    });
    onClose();
  }

  function remove() {
    onApply({ amount: 0, allocation: 'QUANTITY', applyTo: [], manualAllocations: {}, fold: true });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Transport
        </h3>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Amount (KSh)
            </label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm data-num"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Apply to
            </label>
            <div className="flex flex-col gap-1.5">
              {lines.map((l) => (
                <label key={l.product.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
                  <input
                    type="checkbox"
                    checked={applyTo.has(l.product.id)}
                    onChange={(e) =>
                      setApplyTo((prev) => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(l.product.id) : next.delete(l.product.id);
                        return next;
                      })
                    }
                  />
                  {l.product.displayName ?? l.product.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Allocation
            </label>
            <div className="flex flex-col gap-1.5">
              {(['QUANTITY', 'VALUE', 'MANUAL'] as TransportAllocation[]).map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
                  <input type="radio" name="alloc" checked={allocation === a} onChange={() => setAllocation(a)} />
                  {a === 'QUANTITY' ? 'By quantity' : a === 'VALUE' ? 'By line value' : 'Manual'}
                </label>
              ))}
            </div>
          </div>

          {allocation === 'MANUAL' && (
            <div className="flex flex-col gap-1.5">
              {lines
                .filter((l) => applyTo.has(l.product.id))
                .map((l) => (
                  <div key={l.product.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm" style={{ color: 'var(--color-ink-900)' }}>
                      {l.product.displayName ?? l.product.name}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={manual[l.product.id] ?? ''}
                      onChange={(e) => setManual((prev) => ({ ...prev, [l.product.id]: e.target.value }))}
                      className="w-24 rounded-md border px-2 py-1 text-sm data-num"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
                    />
                  </div>
                ))}
              <p className="text-xs" style={{ color: manualSum === Number(amount) ? 'var(--color-ink-600)' : 'var(--color-status-bad)' }}>
                Allocated: KSh {manualSum.toLocaleString()} of KSh {Number(amount || 0).toLocaleString()}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
            <input type="checkbox" checked={fold} onChange={(e) => setFold(e.target.checked)} />
            Include delivery in item prices (customer sees "Delivery included")
          </label>

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={remove} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
              Remove transport
            </button>
            <button type="button" onClick={apply} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}