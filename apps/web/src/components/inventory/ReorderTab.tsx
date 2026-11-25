'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { reorderApi, type ReorderItem, type ReorderPlan } from '../../lib/reorder-api';
import { productsApi } from '../../lib/products-api';
import { ApiError } from '../../lib/api';
import { LEVEL_TONE } from '../../lib/stock';
import { fmtNumber } from '../../lib/format';
import { NumericInput, toNumber } from '../ui/inputs';
import { toast } from '../ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function daysLeftText(item: ReorderItem) {
  if (item.onHand <= 0) return 'out of stock';
  if (item.daysLeft == null) return null;
  if (item.daysLeft < 1) return 'less than a day left';
  return `about ${Math.round(item.daysLeft)} ${Math.round(item.daysLeft) === 1 ? 'day' : 'days'} left`;
}

function basisNote(item: ReorderItem) {
  if (item.basis === 'threshold') return 'New item with no sales yet — using the shop’s old fixed minimum';
  if (item.basis === 'slow') return 'Sells slowly, so only a minimal buffer is kept';
  return null;
}

/** "D8 welding rod: Kifaru 24, Palak 12" — what to say to the supplier. */
function orderLine(item: ReorderItem) {
  if (item.kind === 'family') {
    const parts = item.brands.filter((b) => b.suggestedQty > 0).map((b) => `${b.brand ?? b.name} ${b.suggestedQty}`);
    return `${item.name}: ${parts.join(', ') || item.suggestedQty} ${item.unit}`.trim();
  }
  return `${item.name}: ${item.suggestedQty} ${item.unit}`;
}

function LeadTime({ item, onSaved }: { item: ReorderItem; onSaved: () => void }) {
  const original = item.leadTimeOverridden ? String(item.leadTimeDays) : '';
  const [value, setValue] = useState(original);
  useEffect(() => setValue(original), [original]);

  async function save() {
    if (value === original) return;
    const days = toNumber(value);
    if (value.trim() !== '' && (days === null || days < 0 || days > 60)) {
      toast.error('Restock time must be between 0 and 60 days');
      setValue(original);
      return;
    }
    try {
      const leadTimeDays = value.trim() === '' ? null : days;
      if (item.kind === 'family') await productsApi.updateFamily(item.id, { leadTimeDays });
      else await productsApi.update(item.id, { leadTimeDays });
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save restock time");
      setValue(original);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
      Restock takes
      <NumericInput
        aria-label={`Days a restock of ${item.name} takes`}
        value={value}
        onChange={setValue}
        onBlur={save}
        placeholder={String(item.leadTimeDays)}
        className="w-14 rounded-md border px-2 py-1 text-xs data-num outline-none focus:border-[var(--color-accent)]"
        style={inputStyle}
      />
      days{!item.leadTimeOverridden && <span>(shop default)</span>}
    </label>
  );
}

function ItemCard({ item, onSaved }: { item: ReorderItem; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const tone = item.status === 'out' ? LEVEL_TONE.out : LEVEL_TONE.low;
  const left = daysLeftText(item);
  const note = basisNote(item);
  const showSplit = item.kind === 'family' && item.brands.length > 0;

  return (
    <li className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {item.name}
            {item.kind === 'family' && (
              <span className="text-xs font-normal" style={{ color: 'var(--color-ink-600)' }}>
                all brands
              </span>
            )}
            <span className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: tone.bg, color: tone.fg }}>
              {item.status === 'out' ? 'Out' : 'Reorder'}
            </span>
          </p>
          <p className="mt-0.5 text-xs data-num" style={{ color: 'var(--color-ink-600)' }}>
            {fmtNumber(item.onHand)} {item.unit} on hand
            {item.dailyRate > 0 && ` · selling ${fmtNumber(item.dailyRate)}/day`}
            {left && ` · ${left}`}
          </p>
        </div>
        {item.suggestedQty > 0 && (
          <p className="shrink-0 text-right">
            <span className="block text-xs uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.04em' }}>
              Order
            </span>
            <span className="text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
              {fmtNumber(item.suggestedQty)} <span className="text-xs font-normal">{item.unit}</span>
            </span>
          </p>
        )}
      </div>

      {showSplit && (
        <div className="mt-2">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            By brand
          </button>
          {open && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {item.brands.map((b) => (
                <li key={b.productId} className="flex items-center justify-between gap-3 text-xs">
                  <span style={{ color: 'var(--color-ink-900)' }}>{b.brand ? `${b.brand}` : b.name}</span>
                  <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                    {fmtNumber(b.onHand)} on hand · sold {fmtNumber(b.soldInWindow)} lately ·{' '}
                    <span className="font-semibold" style={{ color: b.suggestedQty > 0 ? 'var(--color-ink-900)' : undefined }}>
                      order {fmtNumber(b.suggestedQty)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <LeadTime item={item} onSaved={onSaved} />
        {note && (
          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {note}
          </p>
        )}
      </div>
    </li>
  );
}

export function ReorderTab() {
  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    setError(false);
    reorderApi
      .plan(showAll)
      .then(setPlan)
      .catch(() => setError(true));
  }, [showAll]);
  useEffect(load, [load]);

  const needing = plan?.items.filter((i) => i.status !== 'ok') ?? [];

  async function copyList() {
    const text = needing.filter((i) => i.suggestedQty > 0).map(orderLine).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Order list copied');
    } catch {
      toast.error("Couldn't copy — select and copy it manually");
    }
  }

  if (error) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
        Couldn’t work out what to reorder.{' '}
        <button type="button" onClick={load} className="underline">
          Try again
        </button>
      </p>
    );
  }
  if (!plan) return <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Working it out…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          {needing.length === 0 ? 'Nothing needs reordering right now.' : `${needing.length} ${needing.length === 1 ? 'item' : 'items'} to reorder`} · worked out from the last 90 days of sales, restock ~{plan.settings.leadTimeDays} days, orders cover {plan.settings.coverDays} days
        </p>
        <div className="flex items-center gap-2">
          <label className="flex min-h-10 pointer-coarse:min-h-11 items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show items that are fine
          </label>
          {needing.some((i) => i.suggestedQty > 0) && (
            <button type="button" onClick={copyList} className="flex min-h-10 pointer-coarse:min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              <Copy size={14} strokeWidth={2} />
              Copy order list
            </button>
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {plan.items.map((item) =>
          item.status === 'ok' ? (
            <li key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
              <span style={{ color: 'var(--color-ink-900)' }}>{item.name}</span>
              <span className="data-num">
                {fmtNumber(item.onHand)} {item.unit} · reorder at {fmtNumber(item.reorderPoint)}
              </span>
            </li>
          ) : (
            <ItemCard key={`${item.kind}:${item.id}`} item={item} onSaved={load} />
          ),
        )}
      </ul>
    </div>
  );
}
