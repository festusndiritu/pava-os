'use client';

import { useState } from 'react';
import { Printer, Share2, Truck, X } from 'lucide-react';
import type { PosSaleResult } from '../../lib/pos-api';
import { shareElementAsPdf } from '../../lib/pdf';
import { ThermalReceipt, type ReceiptData } from '../documents/ThermalReceipt';

function toReceiptData(sale: PosSaleResult): ReceiptData {
  return {
    number: sale.receiptNumber ?? sale.invoiceNumber,
    createdAt: sale.createdAt,
    customerLabel: sale.customer?.businessName || sale.customer?.name || sale.customerName || 'Walk-in customer',
    items: sale.items.map((i) => ({ id: i.id, description: i.description, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: sale.subtotal,
    total: sale.total,
    transportMode: sale.transportMode,
    transportAmount: sale.transportAmount,
    paymentMethod: sale.paymentMethod,
  };
}

export function ReceiptDialog({
  sale,
  onClose,
  onCreateDeliveryNote,
  deliveryNoteBusy,
}: {
  sale: PosSaleResult;
  onClose: () => void;
  onCreateDeliveryNote?: () => void;
  deliveryNoteBusy?: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const data = toReceiptData(sale);
  // A settle-later sale leaves the counter as an unpaid invoice, not a receipt.
  const unpaid = sale.status === 'INVOICED';

  async function handleShare() {
    setSharing(true);
    setNotice(null);
    try {
      const number = data.number ?? sale.id.slice(0, 8);
      const result = await shareElementAsPdf('print-area', `${number}.pdf`, `Receipt ${number}`);
      setNotice(result === 'shared' ? 'Shared.' : 'Downloaded.');
    } catch {
      setNotice('Could not generate the PDF.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      {/* The print/PDF source lives outside the dialog on purpose: printing
          from inside a fixed, scrolling modal is what produced blank pages.
          This node is laid out off-screen, so html2canvas can capture it and
          the print stylesheet can reveal it in place. */}
      <ThermalReceipt data={data} variant="print" title={unpaid ? 'INVOICE' : 'RECEIPT'} />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4 print:hidden">
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
        <div
          className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border sm:max-w-sm sm:rounded-lg"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {unpaid ? 'Goods released — unpaid' : 'Sale complete'}
              </p>
              {data.number && (
                <p className="data-num truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  {data.number}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }} aria-label="Close">
              <X size={17} strokeWidth={2} />
            </button>
          </div>

          {notice && (
            <p className="px-4 pt-3 text-center text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {notice}
            </p>
          )}

          {/* Paper-styled preview: white with dark ink in either theme, so what
              the operator sees is what the printer produces. */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[320px] rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <ThermalReceipt data={data} variant="preview" title={unpaid ? 'INVOICE' : 'RECEIPT'} />
            </div>
          </div>

          <div
            className="grid gap-2 border-t px-4 py-3"
            style={{ borderColor: 'var(--color-border)', gridTemplateColumns: onCreateDeliveryNote ? '1fr 1fr 1fr' : '1fr 1fr', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={() => window.print()}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              <Printer size={15} strokeWidth={2} />
              Print
            </button>
            <button
              type="button"
              disabled={sharing}
              onClick={handleShare}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
            >
              <Share2 size={15} strokeWidth={2} />
              {sharing ? '…' : 'Share'}
            </button>
            {onCreateDeliveryNote && (
              <button
                type="button"
                disabled={deliveryNoteBusy}
                onClick={onCreateDeliveryNote}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
              >
                <Truck size={15} strokeWidth={2} />
                {deliveryNoteBusy ? '…' : 'Delivery note'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}