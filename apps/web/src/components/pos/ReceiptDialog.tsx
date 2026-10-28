'use client';

import { useEffect, useRef, useState } from 'react';
import { Printer, Share2, Truck, X } from 'lucide-react';
import type { PosSaleResult } from '../../lib/pos-api';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import { buildPosReceiptViewModel } from '../../lib/document-view-model';
import { shareNotice } from '../../lib/pdf';
import { getAutoPrint, getPrintMode, printReceipt } from '../../lib/print-receipt';
import { ThermalDocument } from '../documents/ThermalDocument';
import { Modal } from '../ui/Modal';
import { useMediaQuery } from '../../lib/use-media-query';
import { toast } from '../ui/Toast';

export function ReceiptDialog({
  sale,
  onClose,
  onCreateDeliveryNote,
  deliveryNoteBusy,
  suspended,
}: {
  sale: PosSaleResult;
  onClose: () => void;
  onCreateDeliveryNote?: () => void;
  deliveryNoteBusy?: boolean;
  suspended?: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const autoPrinted = useRef(false);
  const mobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    settingsApi
      .get()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setSettingsReady(true));
  }, []);

  const vm = buildPosReceiptViewModel(sale, settings);

  // Direct-print tills: the receipt prints the moment the sale completes.
  useEffect(() => {
    if (!settingsReady || autoPrinted.current) return;
    autoPrinted.current = true;
    if (getAutoPrint() && getPrintMode() !== 'browser') void printReceipt(vm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady]);
  // A settle-later sale leaves the counter as an unpaid invoice, not a receipt.
  const unpaid = sale.status === 'INVOICED';

  async function handleShare() {
    setSharing(true);
    try {
      // Loaded on demand — the PDF renderer is heavy and most receipts are never exported.
      const { shareViewModelAsPdf } = await import('../../lib/pdf/document-pdf');
      const result = await shareViewModelAsPdf(vm);
      toast.success(shareNotice(result, vm.number));
    } catch {
      toast.error("Couldn't share");
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      {/* The print source lives outside the dialog on purpose: printing from inside a fixed, scrolling modal is what produced blank pages. */}
      {!suspended && <ThermalDocument vm={vm} variant="print" />}

      <div className="print:hidden" hidden={suspended}>
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

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-[320px] rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <ThermalDocument vm={vm} variant="preview" />
            </div>
          </div>

          <div
            className="grid gap-2 border-t px-4 py-3"
            style={{ borderColor: 'var(--color-border)', gridTemplateColumns: `repeat(${(mobile ? 0 : 1) + 1 + (onCreateDeliveryNote ? 1 : 0)}, 1fr)`, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {!mobile && (
              <button
                type="button"
                onClick={() => printReceipt(vm)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <Printer size={15} strokeWidth={2} />
                Print
              </button>
            )}
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
