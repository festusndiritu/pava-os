'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { PhoneInput } from '../ui/inputs';
import { Modal } from '../ui/Modal';

/**
 * Captures the delivery/site address before a delivery note is created.
 * Deliberately optional (a driver may already know the drop-off, or the
 * customer's stored address already covers it) — the note falls back to
 * the customer's stored address at render time when this is left blank.
 */
export function DeliveryLocationDialog({
  customerAddress,
  customerPhone,
  busy,
  onCancel,
  onConfirm,
}: {
  /** The customer's stored address, shown as a hint for what's used if left blank. */
  customerAddress?: string | null;
  /** The customer's stored phone, shown as a hint for what's used if left blank. */
  customerPhone?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (deliveryLocation: string, deliveryPhone: string) => void;
}) {
  const [value, setValue] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <Modal onClose={onCancel} dismissOnBackdrop={false} label="Delivery location" className="flex flex-col overflow-hidden sm:max-w-sm">
        <div className="flex items-start gap-3 px-5 pt-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
          >
            <Truck size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              Delivery location
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Where is this being delivered? Leave blank to use{' '}
              {customerAddress ? 'the customer\'s stored address.' : 'no fixed address.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 pt-4">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={customerAddress ?? 'e.g. Site name, road, town'}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          <div>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder={customerPhone ?? 'e.g. site contact number'}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Leave blank to use {customerPhone ? "the customer's stored number." : 'no contact number.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value.trim(), phone.trim())}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {busy ? 'Creating…' : 'Create delivery note'}
          </button>
        </div>
    </Modal>
  );
}
