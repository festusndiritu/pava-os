'use client';

import { useState } from 'react';
import { Ban, Eye, FileCheck2, Pencil, Truck } from 'lucide-react';
import { canEditQuote, documentsApi, type SaleDocument } from './documents-api';
import { ApiError } from './api';
import { readStockShortfalls } from './pos-api';
import type { RowAction } from '../components/ui/ActionMenu';
import { toast } from '../components/ui/Toast';

/**
 * The same action set on every document table, so a row behaves identically
 * whether it is listed under Quotes or under Invoices. Anything that needs a
 * decision (which way an invoice was settled, whether to sell short stock)
 * still happens in the detail drawer or its own dialog; these are only the
 * one-tap moves.
 *
 * Returns a function that lists the actions for one document. A move that
 * calls the server is disabled for that document while it runs, and says what
 * happened when it finishes, because the menu it was started from has closed.
 */
export function useDocumentActions({
  onOpen,
  onEdit,
  onChanged,
  onError,
}: {
  onOpen: (id: string) => void;
  // Only the Quotes screen passes this: it's what opens the quote form.
  onEdit?: (id: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(doc: SaleDocument, fn: () => Promise<unknown>, done: string, opts?: { detectStockShortfall?: boolean }) {
    setBusyId(doc.id);
    try {
      await fn();
      toast.success(done);
      onChanged();
    } catch (err) {
      // Short stock needs the full confirmation (numbers, and the backorder
      // decision), so the row hands off to the document itself rather than
      // asking for that judgement from a menu.
      const detected = opts?.detectStockShortfall && err instanceof ApiError ? readStockShortfalls(err.details) : null;
      if (detected) {
        onError('Not enough stock for this quote — opening it so you can review the shortfall.');
        onOpen(doc.id);
      } else {
        onError(err instanceof ApiError ? err.message : 'Could not complete that action.');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (doc: SaleDocument): (RowAction | false)[] => {
    const busy = busyId === doc.id;
    const canConvert = doc.status === 'QUOTED';
    const canDeliveryNote = doc.type !== 'DELIVERY_NOTE' && (doc.status === 'QUOTED' || doc.status === 'INVOICED' || doc.status === 'PAID');
    const canCancel = doc.status === 'QUOTED' || doc.status === 'INVOICED';
    const canEdit = !!onEdit && canEditQuote(doc);
    return [
      { label: 'Open document', icon: Eye, onClick: () => onOpen(doc.id) },
      canEdit && { label: 'Edit quote', icon: Pencil, disabled: busy, onClick: () => onEdit!(doc.id) },
      canConvert && {
        label: 'Convert to invoice',
        icon: FileCheck2,
        disabled: busy,
        onClick: () => run(doc, () => documentsApi.convertToInvoice(doc.id), 'Quote converted to an invoice', { detectStockShortfall: true }),
      },
      // Capturing the delivery location is a small judgement call (site vs.
      // the customer's stored address), so this hands off to the detail
      // drawer's dialog rather than firing straight from the row.
      canDeliveryNote && { label: 'Create delivery note', icon: Truck, disabled: busy, onClick: () => onOpen(doc.id) },
      canCancel && { label: 'Cancel', icon: Ban, tone: 'danger', disabled: busy, separatorBefore: true, onClick: () => run(doc, () => documentsApi.cancel(doc.id), 'Document cancelled') },
    ];
  };
}
