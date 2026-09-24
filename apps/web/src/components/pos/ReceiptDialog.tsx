'use client';

import { useEffect, useState } from 'react';
import { Printer, Share2, Truck, X } from 'lucide-react';
import type { PosSaleResult } from '../../lib/pos-api';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import { buildPosReceiptViewModel } from '../../lib/document-view-model';
import { shareViewModelAsPdf } from '../../lib/pdf/document-pdf';
import { ThermalDocument } from '../documents/ThermalDocument';
import { Modal } from '../ui/Modal';

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
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const vm = buildPosReceiptViewModel(sale, settings);
  // A settle-later sale leaves the counter as an unpaid invoice, not a receipt.
  const unpaid = sale.status === 'INVOICED';

  async function handleShare() {
    setSharing(true);
    setNotice(null);
    try {
      const result = await shareViewModelAsPdf(vm);
      setNotice(result === 'shared' ? 'Shared.' : 'Downloaded.');
    } catch {
      setNotice('Could not generate the PDF.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      {/* The print source lives outside the dialog on purpose: printing from
          inside a fixed, scrolling modal is what produced blank pages. This
          node is laid out off-screen and revealed in place by the print
          stylesheet. PDF sharing no longer captures this DOM node at all —
          it renders straight from `vm` via @react-pdf/renderer — but the
          browser Print button still uses it. */}
      <ThermalDocument vm={vm} variant="print" />

      <div className="print:hidden">
        <Modal onClose={onClose} label="Sale receipt" className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-sm">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {unpaid ? 'Goods released — unpaid' : 'Sale complete'}
              </p>
              <p className="data-num truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {vm.number}
              </p>
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
              <ThermalDocument vm={vm} variant="preview" />
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
        </Modal>
      </div>
    </>
  );
}
