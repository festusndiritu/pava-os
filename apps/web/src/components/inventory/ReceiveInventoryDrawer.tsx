'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { ProductPicker } from '../products/ProductPicker';
import { inventoryApi, productsApi, type Product, type ReceiveLineResult } from '../../lib/products-api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Modal } from '../ui/Modal';
import { NumericInput, toNumber } from '../ui/inputs';
import { toast } from '../ui/Toast';
import { fmtNumber } from '../../lib/format';

interface Line {
  product: Product;
  quantity: string;
  unitCost: string;
}

function newLine(p: Product): Line {
  return { product: p, quantity: '', unitCost: p.lastCost != null && p.lastCost > 0 ? String(p.lastCost) : '' };
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

export function ReceiveInventoryDrawer({
  open,
  onClose,
  onDone,
  initialProduct,
  suppliers = [],
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** Start with this product already on the receipt (a restock launched from a product). */
  initialProduct?: Product | null;
  /** Suppliers used before, offered as suggestions while typing. */
  suppliers?: string[];
}) {
  const { user } = useAuth();
  // Changing a selling price is an admin action on the API; offering it to
  // anyone else would only end in a refusal.
  const canReprice = user?.role === 'ADMIN';
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<ReceiveLineResult[] | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Opening from a product starts the receipt with that product on it.
  useEffect(() => {
    if (!open || !initialProduct) return;
    setLines((prev) => (prev.some((l) => l.product.id === initialProduct.id) ? prev : [...prev, newLine(initialProduct)]));
    setLastAddedId(initialProduct.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProduct?.id]);

  function reset() {
    setSupplier('');
    setReference('');
    setNotes('');
    setLines([]);
    setLastAddedId(null);
    setError(null);
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    for (const l of lines) {
      const name = l.product.displayName ?? l.product.name;
      if (!(toNumber(l.quantity) && toNumber(l.quantity)! >= 1)) {
        setError(`Enter a quantity of 1 or more for ${name}.`);
        return;
      }
      // A zero-cost lot makes the stock look free: valuation, margins and
      // price suggestions all read it as "cost nothing".
      if (!(toNumber(l.unitCost) && toNumber(l.unitCost)! >= 1)) {
        setError(`Enter what ${name} cost per unit.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const result = await inventoryApi.receive({
        supplier,
        reference: reference || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({ productId: l.product.id, quantity: toNumber(l.quantity) ?? 0, unitCost: toNumber(l.unitCost) ?? 0 })),
      });
      toast.success('Stock received');
      // Only worth asking about products whose suggested price actually differs from the current one.
      const worthAsking = canReprice ? result.lines.filter((l) => l.suggestedPrice !== l.currentPrice) : [];
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
        guardUnsaved
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Receive inventory"
        subtitle="Records a delivery, creates cost lots, and increases stock"
        wide
        footer={
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {lines.length} line{lines.length === 1 ? '' : 's'} · Total: <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(total)}</span>
              </p>
              <button
                type="submit"
                form="receive-form"
                disabled={saving}
                className="min-h-11 rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
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
              <label htmlFor="receiveinventorydrawer-supplier" className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                Supplier
              </label>
              <input id="receiveinventorydrawer-supplier" required list="receive-suppliers" autoComplete="off" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <datalist id="receive-suppliers">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="receiveinventorydrawer-reference" className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                Reference
              </label>
              <input id="receiveinventorydrawer-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INV-10392" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
          </div>

          <div>
            <label htmlFor="receiveinventorydrawer-notes" className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Notes
            </label>
            <input id="receiveinventorydrawer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              Add product
            </label>
            <ProductPicker
              onSelect={(p) => {
                if (lines.some((l) => l.product.id === p.id)) {
                  toast.error(`${p.displayName ?? p.name} is already on this receipt`);
                  return;
                }
                setLines((prev) => [...prev, newLine(p)]);
                setLastAddedId(p.id);
              }}
            />
          </div>

          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full min-w-[460px] text-sm">
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
                    <th className="w-10">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.product.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>
                        {line.product.displayName ?? line.product.name}
                        <LastCostHint product={line.product} unitCost={line.unitCost} />
                      </td>
                      <td className="px-3 py-2">
                        <NumericInput
                          min={1}
                          required
                          autoFocus={line.product.id === lastAddedId}
                          aria-label={`Quantity for ${line.product.displayName ?? line.product.name}`}
                          value={line.quantity}
                          onChange={(v) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: v } : l)))}
                          className="w-20 rounded border px-2 py-1 text-sm data-num"
                          style={inputStyle}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumericInput
                          required
                          aria-label={`Unit cost for ${line.product.displayName ?? line.product.name}`}
                          value={line.unitCost}
                          onChange={(v) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitCost: v } : l)))}
                          className="w-24 rounded border px-2 py-1 text-sm data-num"
                          style={inputStyle}
                        />
                      </td>
                      <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                        KSh {fmtNumber((toNumber(line.quantity) ?? 0) * (toNumber(line.unitCost) ?? 0))}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          aria-label={`Remove ${line.product.displayName ?? line.product.name}`}
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                          className="flex h-9 w-9 items-center justify-center rounded-md"
                          style={{ color: 'var(--color-status-bad)' }}
                        >
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

// A cost far from the last one is usually a slipped digit, not a real price move.
function LastCostHint({ product, unitCost }: { product: Product; unitCost: string }) {
  const last = product.lastCost ?? 0;
  const cost = toNumber(unitCost) ?? 0;
  if (last <= 0) return <span className="block text-xs" style={{ color: 'var(--color-ink-600)' }}>No previous cost</span>;
  const change = cost > 0 ? Math.round(((cost - last) / last) * 100) : 0;
  const big = Math.abs(change) >= 30;
  return (
    <span className="block text-xs data-num" style={{ color: big ? 'var(--color-status-warn)' : 'var(--color-ink-600)' }}>
      Last cost KSh {fmtNumber(last)}
      {cost > 0 && change !== 0 ? ` · ${change > 0 ? '+' : ''}${change}%${big ? ' — check this' : ''}` : ''}
    </span>
  );
}

function PriceSuggestionDialog({ suggestions, onClose }: { suggestions: ReceiveLineResult[]; onClose: () => void }) {
  const [decided, setDecided] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(line: ReceiveLineResult, update: boolean) {
    setError(null);
    if (!update) {
      setDecided((prev) => ({ ...prev, [line.productId]: true }));
      return;
    }
    setBusyId(line.productId);
    try {
      await productsApi.update(line.productId, { basePrice: line.suggestedPrice });
      setDecided((prev) => ({ ...prev, [line.productId]: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not update the price for ${line.productName}.`);
    } finally {
      setBusyId(null);
    }
  }

  const allDecided = suggestions.every((s) => decided[s.productId]);

  return (
    // The stock is already received at this point, so leaving (Escape, Skip) just keeps current prices.
    <Modal onClose={onClose} dismissOnBackdrop={false} label="Update selling prices?" className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-md">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Update selling prices?
      </h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
        Stock is saved. Based on the new cost, here is what each price would need to be to keep the same margin.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {suggestions.map((s) => (
          <div key={s.productId} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {s.productName}
            </p>
            <p className="mt-0.5 text-sm data-num" style={{ color: 'var(--color-ink-600)' }}>
              Currently KSh {fmtNumber(s.currentPrice)} · Suggested KSh {fmtNumber(s.suggestedPrice)}
            </p>
            {decided[s.productId] ? (
              <p className="mt-2 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>
                Done
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => apply(s, false)}
                  className="min-h-10 flex-1 rounded-md border px-3 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                >
                  Keep KSh {fmtNumber(s.currentPrice)}
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => apply(s, true)}
                  className="min-h-10 flex-1 rounded-md px-3 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {busyId === s.productId ? 'Updating…' : `Update to KSh ${fmtNumber(s.suggestedPrice)}`}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        data-autofocus
        disabled={busyId !== null}
        onClick={onClose}
        className="mt-4 min-h-11 w-full rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: allDecided ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
      >
        {allDecided ? 'Done' : 'Skip — keep current prices'}
      </button>
    </Modal>
  );
}
