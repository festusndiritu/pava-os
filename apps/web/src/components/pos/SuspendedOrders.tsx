'use client';

import { useEffect, useState } from 'react';
import { Clock, PauseCircle, Trash2, X } from 'lucide-react';
import { posApi, type SuspendedOrder } from '../../lib/pos-api';
import { ApiError } from '../../lib/api';

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function since(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function Shell({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border sm:max-w-md sm:rounded-lg"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Names the order being parked so it can be picked out of the list later. */
export function SuspendOrderDialog({
  defaultLabel,
  itemCount,
  total,
  busy,
  onCancel,
  onConfirm,
}: {
  defaultLabel: string;
  itemCount: number;
  total: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (label: string) => void;
}) {
  const [label, setLabel] = useState(defaultLabel);

  return (
    <Shell title="Suspend this order" subtitle={`${itemCount} item${itemCount === 1 ? '' : 's'} · ${money(total)}`} onClose={onCancel}>
      <label className="text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
        Label (optional)
      </label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onConfirm(label.trim())}
        placeholder="e.g. blue pickup, Mwangi site"
        className="mt-1.5 min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
      />
      <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
        The cart is parked and the counter clears. No stock moves until the order is resumed and completed.
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Keep serving
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(label.trim())}
          className="min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {busy ? 'Suspending…' : 'Suspend order'}
        </button>
      </div>
    </Shell>
  );
}

/** The held-orders list: resume one, or discard it. */
export function SuspendedOrdersDialog({
  onClose,
  onResume,
  onChanged,
}: {
  onClose: () => void;
  onResume: (order: SuspendedOrder) => void;
  onChanged: () => void;
}) {
  const [orders, setOrders] = useState<SuspendedOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      setOrders(await posApi.suspended());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load suspended orders.');
      setOrders([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function discard(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await posApi.discardSuspended(id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not discard that order.');
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <Shell title="Suspended orders" subtitle="Parked carts waiting to be finished" onClose={onClose}>
      {error && (
        <p className="mb-3 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}

      {orders === null && (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
          ))}
        </div>
      )}

      {orders?.length === 0 && (
        <div className="py-10 text-center">
          <PauseCircle size={26} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
            Nothing on hold
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Suspend the current cart to serve someone else without losing it.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {orders?.map((order) => {
          const label = order.notes || order.customer?.businessName || order.customer?.name || order.customerName || 'Walk-in customer';
          return (
            <div key={order.id} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    <Clock size={12} strokeWidth={2} />
                    {since(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'} · {order.createdBy.name}
                  </p>
                </div>
                <span className="data-num shrink-0 text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                  {money(order.total)}
                </span>
              </div>

              <p className="mt-2 truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {order.items.map((i) => `${i.qty} × ${i.description}`).join(', ')}
              </p>

              {confirmId === order.id ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-status-bad)' }}>
                    Discard this order?
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmId(null)} className="min-h-9 rounded-md border px-3 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                      Keep
                    </button>
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => discard(order.id)}
                      className="min-h-9 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--color-status-bad)' }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onResume(order)}
                    className="min-h-10 flex-1 rounded-md px-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(order.id)}
                    aria-label="Discard order"
                    title="Discard order"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}