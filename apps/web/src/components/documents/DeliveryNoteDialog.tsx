'use client';

import { useEffect, useState } from 'react';
import { Printer, Share2, X } from 'lucide-react';
import type { SaleDocument } from '../../lib/documents-api';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import { buildDeliveryNoteViewModel } from '../../lib/document-view-model';
import { shareNotice } from '../../lib/pdf';
import { printReceipt } from '../../lib/print-receipt';
import { useMediaQuery } from '../../lib/use-media-query';
import { PhoneInput } from '../ui/inputs';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { ThermalDocument } from './ThermalDocument';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

export function DeliveryNoteDialog({ doc, onClose }: { doc: SaleDocument; onClose: () => void }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [location, setLocation] = useState(doc.customer?.address || doc.customer?.location || '');
  const [phone, setPhone] = useState(doc.customer?.phone ?? '');
  const [sharing, setSharing] = useState(false);
  const mobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const vm = buildDeliveryNoteViewModel(doc, settings, { location, phone });

  async function handleShare() {
    setSharing(true);
    try {
      const { shareViewModelAsPdf } = await import('../../lib/pdf/document-pdf');
      const result = await shareViewModelAsPdf(vm);
      toast.success(shareNotice(result, 'delivery note'));
    } catch {
      toast.error("Couldn't share");
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <ThermalDocument vm={vm} variant="print" />

      <div className="print:hidden">
        <Modal onClose={onClose} label="Delivery note" className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-sm">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              Delivery note
            </p>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }} aria-label="Close">
              <X size={17} strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-col gap-2">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Delivery location" aria-label="Delivery location" className="min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
              <PhoneInput value={phone} onChange={setPhone} placeholder="Contact phone" aria-label="Contact phone" className="min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
            </div>
            <div className="mx-auto max-w-[320px] rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <ThermalDocument vm={vm} variant="preview" />
            </div>
          </div>

          <div
            className="grid gap-2 border-t px-4 py-3"
            style={{ borderColor: 'var(--color-border)', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {!mobile && (
              <button type="button" onClick={() => printReceipt(vm)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
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
          </div>
        </Modal>
      </div>
    </>
  );
}
