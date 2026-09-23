'use client';

import { AlertTriangle } from 'lucide-react';
import type { StockShortfall } from '../../lib/pos-api';

function qty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Shown instead of a raw error when a sale or an invoice would take stock
 * below what the system has recorded. It states the position plainly —
 * product, requested, available, shortage — and, for an operator who is
 * authorized to do it, offers to continue as a backorder.
 *
 * Proceeding still records the shortfall on the backend audit trail; that is
 * an internal control, not something the operator is lectured about here.
 */
export function StockShortfallDialog({
  shortfalls,
  canProceed,
  busy,
  action,
  onCancel,
  onProceed,
}: {
  shortfalls: StockShortfall[];
  canProceed: boolean;
  busy?: boolean;
  /** What proceeding actually does, e.g. "Complete sale" or "Invoice". */
  action: 'sale' | 'invoice';
  onCancel: () => void;
  onProceed: () => void;
}) {
  const single = shortfalls.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Insufficient stock"
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border sm:max-w-md sm:rounded-lg"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: 'var(--color-status-warnSoft)', color: 'var(--color-status-warn)' }}
          >
            <AlertTriangle size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              Insufficient stock
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              {single ? 'One item is' : `${shortfalls.length} items are`} short of what the system has recorded.
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-5">
          <div className="flex flex-col gap-2">
            {shortfalls.map((s) => (
              <div key={s.productId} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                  {s.name}
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.05em' }}>
                      Requested
                    </dt>
                    <dd className="data-num text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {qty(s.requested)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.05em' }}>
                      Available
                    </dt>
                    <dd className="data-num text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {qty(s.available)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.05em' }}>
                      Short by
                    </dt>
                    <dd className="data-num text-sm font-semibold" style={{ color: 'var(--color-status-bad)' }}>
                      {qty(s.shortfall)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--color-ink-600)' }}>
            {canProceed
              ? `Continuing records the ${action === 'sale' ? 'sale' : 'invoice'} in full and leaves the shortfall owing as a backorder. Stock will read negative until the delivery arrives.`
              : 'You are not authorized to sell beyond recorded stock. Reduce the quantity, or ask a manager to complete it.'}
          </p>
        </div>

        <div
          className="mt-4 flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end"
          style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border px-4 text-sm font-medium"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
          >
            Cancel
          </button>
          {canProceed && (
            <button
              type="button"
              onClick={onProceed}
              disabled={busy}
              className="min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-status-warn)' }}
            >
              {busy ? 'Working…' : 'Proceed with backorder'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}