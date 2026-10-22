'use client';

import { useState } from 'react';
import { Ban, Eye, FileCheck2, Pencil, Trash2, Truck } from 'lucide-react';
import { canEditQuote, documentsApi, type SaleDocument } from './documents-api';
import { ApiError } from './api';
import type { RowAction } from '../components/ui/ActionMenu';
import { toast } from '../components/ui/Toast';

/** The same action set on every document table, so a row behaves identically whether it is listed under Quotes or under Invoices. */
export function useDocumentActions({
  onOpen,
  onEdit,
  onChanged,
}: {
  onOpen: (id: string) => void;
  // Only the Quotes screen passes this: it's what opens the quote form.
  onEdit?: (id: string) => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(doc: SaleDocument, fn: () => Promise<unknown>, done: string) {
    setBusyId(doc.id);
    try {
      await fn();
      toast.success(done);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't complete action");
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
    const canDelete = doc.type === 'QUOTE' && doc.status === 'CANCELLED';
    return [
      { label: 'Open document', icon: Eye, onClick: () => onOpen(doc.id) },
      canEdit && { label: 'Edit quote', icon: Pencil, disabled: busy, onClick: () => onEdit!(doc.id) },
      canConvert && {
        label: 'Convert to invoice',
        icon: FileCheck2,
        disabled: busy,
        onClick: () => onOpen(doc.id),
      },
      canDeliveryNote && { label: 'Delivery note', icon: Truck, disabled: busy, onClick: () => onOpen(doc.id) },
      canDelete && { label: 'Delete quote…', icon: Trash2, tone: 'danger', disabled: busy, separatorBefore: true, onClick: () => onOpen(doc.id) },
      canCancel && { label: 'Cancel', icon: Ban, tone: 'danger', disabled: busy, separatorBefore: true, onClick: () => run(doc, () => documentsApi.cancel(doc.id), 'Document cancelled') },
    ];
  };
}
