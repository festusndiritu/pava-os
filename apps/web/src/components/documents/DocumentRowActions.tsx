'use client';

import { useState } from 'react';
import { Ban, Eye, FileCheck2, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { documentsApi, type SaleDocument } from '../../lib/documents-api';
import { ApiError } from '../../lib/api';
import { readStockShortfalls } from '../../lib/pos-api';

function ActionButton({ label, icon: Icon, onClick, disabled, tone }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; tone?: 'danger' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // The row itself opens the document; an action must not do both.
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-40"
      style={{ borderColor: 'var(--color-border)', color: tone === 'danger' ? 'var(--color-status-bad)' : 'var(--color-ink-600)' }}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

/**
 * The same action set on every document table, so a row behaves identically
 * whether it is listed under Quotes or under Invoices. Anything that needs a
 * decision (which way an invoice was settled, whether to sell short stock)
 * still happens in the detail drawer or its own dialog — these are only the
 * one-tap moves.
 */
export function DocumentRowActions({
  doc,
  onOpen,
  onChanged,
  onError,
}: {
  doc: SaleDocument;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const canConvert = doc.status === 'QUOTED';
  const canDeliveryNote = doc.type !== 'DELIVERY_NOTE' && (doc.status === 'QUOTED' || doc.status === 'INVOICED' || doc.status === 'PAID');
  const canCancel = doc.status === 'QUOTED' || doc.status === 'INVOICED';

  async function run(fn: () => Promise<unknown>, opts?: { detectStockShortfall?: boolean }) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      // Short stock needs the full confirmation — numbers, and the backorder
      // decision — so the row hands off to the document itself rather than
      // asking for that judgement from a table cell.
      const detected = opts?.detectStockShortfall && err instanceof ApiError ? readStockShortfalls(err.details) : null;
      if (detected) {
        onError('Not enough stock for this quote — opening it so you can review the shortfall.');
        onOpen(doc.id);
      } else {
        onError(err instanceof ApiError ? err.message : 'Could not complete that action.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <ActionButton label="Open document" icon={Eye} onClick={() => onOpen(doc.id)} />
        {canConvert && (
          <ActionButton
            label="Convert to invoice"
            icon={FileCheck2}
            disabled={busy}
            onClick={() => run(() => documentsApi.convertToInvoice(doc.id), { detectStockShortfall: true })}
          />
        )}
        {canDeliveryNote && (
          <ActionButton label="Create delivery note" icon={Truck} disabled={busy} onClick={() => run(() => documentsApi.createDeliveryNote(doc.id))} />
        )}
      {canCancel && <ActionButton label="Cancel" icon={Ban} tone="danger" disabled={busy} onClick={() => run(() => documentsApi.cancel(doc.id))} />}
    </div>
  );
}