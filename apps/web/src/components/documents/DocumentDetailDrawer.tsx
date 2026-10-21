'use client';

import { useEffect, useState } from 'react';
import { Pencil, Receipt, Share2, Truck } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { canEditQuote, documentsApi, type SaleDocument } from '../../lib/documents-api';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import { buildDocumentViewModel } from '../../lib/document-view-model';
import { ThermalDocument } from './ThermalDocument';
import { shareNotice } from '../../lib/pdf';
import { printReceipt } from '../../lib/print-receipt';
import { ApiError } from '../../lib/api';
import { shareDocumentAsPdf } from '../../lib/pdf/document-pdf';
import { FulfilmentDialog, defaultStockQty, type FulfilmentLine } from './FulfilmentDialog';
import { DeliveryLocationDialog } from './DeliveryLocationDialog';
import { readStockShortfalls } from '../../lib/pos-api';
import { money } from '../../lib/format';
import { toast } from '../ui/Toast';

function docTypeLabel(type: string) {
  return type === 'QUOTE' ? 'Quote' : type === 'INVOICE' ? 'Invoice' : type === 'DELIVERY_NOTE' ? 'Delivery note' : 'Receipt';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--color-bg)', fg: 'var(--color-ink-600)' },
  QUOTED: { label: 'Quote', bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  INVOICED: { label: 'Invoiced', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  PAID: { label: 'Paid', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
};

export function DocumentDetailDrawer({
  documentId,
  onClose,
  onChanged,
  onNavigate,
  onEdit,
}: {
  documentId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onNavigate?: (id: string) => void;
  // Only the Quotes screen passes this; without it no Edit button is shown.
  onEdit?: (id: string) => void;
}) {
  const [doc, setDoc] = useState<SaleDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Where the goods come from is settled when a quote becomes an invoice. The
  // key remounts the dialog with fresh numbers if the shelf moved meanwhile.
  const [fulfilmentOpen, setFulfilmentOpen] = useState(false);
  const [fulfilmentKey, setFulfilmentKey] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [askingDeliveryLocation, setAskingDeliveryLocation] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  // Thermal is the only print format here now — the A4 off-screen sheet and
  // its Print button were dropped. printTick is what actually fires the
  // print, so clicking the button twice in a row still re-prints even
  // though there's only one format to switch to.
  const [printTick, setPrintTick] = useState(0);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  // Waits for the print-source node to actually be in the DOM before
  // printing — this only matters on the very first click, since after that
  // it's already mounted, but requestAnimationFrame costs nothing either way.
  useEffect(() => {
    if (printTick === 0 || !doc) return;
    const id = requestAnimationFrame(() => printReceipt(buildDocumentViewModel(doc, settings)));
    return () => cancelAnimationFrame(id);
  }, [printTick]);

  async function load() {
    if (!documentId) return;
    setLoading(true);
    setDoc(await documentsApi.get(documentId));
    setLoading(false);
  }

  useEffect(() => {
    load();
    setFulfilmentOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (!documentId) return null;

  async function runAction(fn: () => Promise<SaleDocument>) {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't complete action");
    } finally {
      setBusy(false);
    }
  }

  // Splits each line between the shop's stock and goods supplied from
  // elsewhere, then raises the invoice. Only the shop's part leaves inventory.
  async function convertToInvoice(rows: FulfilmentLine[]) {
    if (!doc) return;
    setBusy(true);
    try {
      await documentsApi.convertToInvoice(doc.id, {
        fulfilment: rows.map((r) => ({ itemId: r.key, stockQty: r.stockQty, supplierSource: r.stockQty < r.qty ? r.supplierSource.trim() || undefined : undefined })),
      });
      setFulfilmentOpen(false);
      await load();
      onChanged();
    } catch (err) {
      // The shelf moved since the dialog opened: show the new numbers.
      if (err instanceof ApiError && readStockShortfalls(err.details)) {
        toast.error('Stock changed — check where each item comes from');
        await load();
        setFulfilmentKey((k) => k + 1);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Couldn't convert to invoice");
      }
    } finally {
      setBusy(false);
    }
  }

  // Lines of a quote as the fulfilment dialog sees them. Two lines of the same
  // product share one shelf, so each is offered only what the earlier ones left.
  function fulfilmentLines(d: SaleDocument): FulfilmentLine[] {
    const shelf = new Map<string, number>();
    return d.items
      .filter((i) => i.productId)
      .map((i) => {
        const available = shelf.get(i.productId!) ?? Math.max(0, i.product?.stockQuantity ?? 0);
        const stockQty = defaultStockQty(i.qty, available);
        shelf.set(i.productId!, available - stockQty);
        return { key: i.id, name: i.description, unit: i.product?.unit?.symbol ?? '', qty: i.qty, available, stockQty, supplierSource: '' };
      });
  }

  async function handleShare() {
    if (!doc) return;
    setSharing(true);
    try {
      const result = await shareDocumentAsPdf(doc, settings);
      toast.success(shareNotice(result, docNumber ?? docTypeLabel(doc.type)));
    } catch {
      toast.error("Couldn't generate PDF");
    } finally {
      setSharing(false);
    }
  }

  async function handleCreateDeliveryNote(deliveryLocation: string, deliveryPhone: string) {
    if (!doc) return;
    setBusy(true);
    try {
      const note = await documentsApi.createDeliveryNote(doc.id, deliveryLocation || undefined, deliveryPhone || undefined);
      setAskingDeliveryLocation(false);
      onChanged();
      toast.success(note.deliveryNoteNumber ? `Delivery note ${note.deliveryNoteNumber} created` : 'Delivery note created');
      onNavigate?.(note.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create delivery note");
    } finally {
      setBusy(false);
    }
  }

  const status = doc ? STATUS_LABEL[doc.status] : null;
  const isDeliveryNote = doc?.type === 'DELIVERY_NOTE';
  const docNumber = doc?.receiptNumber ?? doc?.invoiceNumber ?? doc?.quoteNumber ?? doc?.deliveryNoteNumber;

  return (
    <>
      {/* Rendered as a sibling of the Drawer, not inside it — the Drawer's
          panel sits inside a fixed, absolutely-positioned overlay, and
          printing from inside that positioned ancestor is what offsets the
          thermal output (see ReceiptDialog.tsx for the same fix). */}
      {doc && <ThermalDocument vm={buildDocumentViewModel(doc, settings)} variant="print" />}
      <Drawer
        open
        onClose={onClose}
        title={doc?.customer?.businessName || doc?.customer?.name || doc?.customerName || 'Walk-in customer'}
        subtitle={doc ? `${docNumber ? `${docNumber} · ` : ''}${docTypeLabel(doc.type)} · ${fmtDate(doc.createdAt)}` : undefined}
        footer={
          doc && (
            <div className="flex flex-col gap-2">
              {/* An unpaid invoice is settled here, and how it was settled is
                  recorded on the receipt rather than guessed at later. */}
              {doc.status === 'INVOICED' && (
                <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
                    Settle this invoice
                  </p>
                  <div className="mt-2 flex gap-2">
                    {(['MPESA', 'CASH'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => documentsApi.markPaid(doc.id, m))}
                        className="min-h-10 flex-1 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      >
                        Paid · {m === 'MPESA' ? 'M-Pesa' : 'Cash'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {doc.status === 'QUOTED' && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.cancel(doc.id))} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                      Cancel quote
                    </button>
                    <button type="button" disabled={busy} onClick={() => setFulfilmentOpen(true)} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
                      Convert to invoice
                    </button>
                  </>
                )}
                {doc.status === 'INVOICED' && (
                  <button type="button" disabled={busy} onClick={() => runAction(() => documentsApi.cancel(doc.id))} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                    Cancel invoice
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {onEdit && canEditQuote(doc) && (
                  <button type="button" disabled={busy} onClick={() => onEdit(doc.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    <Pencil size={14} strokeWidth={2} />
                    Edit quote
                  </button>
                )}
                {doc.type !== 'DELIVERY_NOTE' && (doc.status === 'QUOTED' || doc.status === 'INVOICED' || doc.status === 'PAID') && (
                  <button type="button" disabled={busy} onClick={() => setAskingDeliveryLocation(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    <Truck size={14} strokeWidth={2} />
                    Delivery note
                  </button>
                )}
                <button type="button" onClick={() => setPrintTick((t) => t + 1)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                  <Receipt size={14} strokeWidth={2} />
                  Print thermal
                </button>
                <button type="button" disabled={sharing} onClick={handleShare} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                  <Share2 size={14} strokeWidth={2} />
                  {sharing ? 'Preparing…' : 'Share PDF'}
                </button>
              </div>
            </div>
          )
        }
      >

      {doc && fulfilmentOpen && (
        <FulfilmentDialog
          key={fulfilmentKey}
          title="Where does this order come from?"
          lines={fulfilmentLines(doc)}
          confirmLabel="Create invoice"
          busy={busy}
          onCancel={() => setFulfilmentOpen(false)}
          onConfirm={convertToInvoice}
        />
      )}

      {doc && askingDeliveryLocation && (
        <DeliveryLocationDialog
          customerAddress={doc.customer?.address || doc.customer?.location}
          customerPhone={doc.customer?.phone}
          busy={busy}
          onCancel={() => setAskingDeliveryLocation(false)}
          onConfirm={handleCreateDeliveryNote}
        />
      )}

      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Loading…
        </p>
      )}

      {doc && !loading && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            {doc.type === 'DELIVERY_NOTE' ? (
              <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                Delivery note
              </span>
            ) : (
              status && (
                <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: status.bg, color: status.fg }}>
                  {status.label}
                </span>
              )
            )}
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              By {doc.createdBy.name}
            </p>
          </div>

          {isDeliveryNote && (doc.deliveryLocation || doc.deliveryPhone) && (
            <div className="flex flex-col gap-0.5 text-sm">
              {doc.deliveryLocation && <p style={{ color: 'var(--color-ink-900)' }}>{doc.deliveryLocation}</p>}
              {doc.deliveryPhone && <p style={{ color: 'var(--color-ink-600)' }}>{doc.deliveryPhone}</p>}
            </div>
          )}

          {/* A delivery note is a dispatch document — quantities only, never
              prices, in the drawer as well as on the printed sheet. */}
          <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-ink-600)' }}>Item</th>
                  {isDeliveryNote ? (
                    <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Quantity</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Qty × Price</th>
                      <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--color-ink-900)' }}>
                      {item.description}
                      {item.stockQty !== null && item.stockQty < item.qty && (
                        <p className="data-num mt-0.5 text-xs" style={{ color: 'var(--color-status-warn)' }}>
                          {isDeliveryNote
                            ? `Collect ${item.qty - item.stockQty} ${item.product?.unit?.symbol ?? ''} from ${item.supplierSource || 'elsewhere'}`
                            : `${item.stockQty} from shop · ${item.qty - item.stockQty} from ${item.supplierSource || 'elsewhere'}`}
                        </p>
                      )}
                    </td>
                    {isDeliveryNote ? (
                      <td className="px-3 py-2 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                        {item.qty} {item.product?.unit?.symbol ?? ''}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right data-num" style={{ color: 'var(--color-ink-600)' }}>
                          {item.qty} × {money(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                          {money(item.lineTotal)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={isDeliveryNote ? 'hidden' : 'flex flex-col gap-1 text-sm'}>
            {doc.transportMode !== 'DISTRIBUTED' && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-ink-600)' }}>Subtotal</span>
                <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.subtotal)}</span>
              </div>
            )}
            {doc.transportAmount > 0 && doc.transportMode !== 'DISTRIBUTED' && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-ink-600)' }}>Transport</span>
                <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.transportAmount)}</span>
              </div>
            )}
            {doc.transportMode === 'DISTRIBUTED' && (
              <p className="text-right text-xs" style={{ color: 'var(--color-ink-600)' }}>Delivery included in prices</p>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span style={{ color: 'var(--color-ink-900)' }}>Total</span>
              <span className="data-num" style={{ color: 'var(--color-ink-900)' }}>{money(doc.total)}</span>
            </div>
          </div>

          {doc.notes && (
            <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Notes: {doc.notes}
            </p>
          )}

          <div className="flex flex-col gap-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {doc.invoicedAt && <p>Invoiced: {fmtDate(doc.invoicedAt)}</p>}
            {doc.paidAt && <p>Paid: {fmtDate(doc.paidAt)}</p>}
          </div>
        </div>
      )}
    </Drawer>
    </>
  );
}