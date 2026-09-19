'use client';

import { useEffect, useState } from 'react';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import type { SaleDocument } from '../../lib/documents-api';

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(iso));
}

// Every colour here is literal. These sheets are printed and captured to PDF
// by html2canvas, which reads computed styles — a theme variable would export
// as pale text on white the moment PAVA is in dark mode.
const INK = '#111827';
const MUTED = '#4b5563';
const LABEL = '#6b7280';
const LINE = '#d1d5db';
const HAIRLINE = '#e5e7eb';
const ACCENT = '#0559C9';

type Variant = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'DELIVERY_NOTE';

const TITLES: Record<Variant, string> = {
  QUOTE: 'Quotation',
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  DELIVERY_NOTE: 'Delivery Note',
};

function BrandMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 34 34" role="img" aria-label="PAVA">
      <rect x="1" y="1" width="32" height="32" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M8 25V9h8a5 5 0 0 1 0 10h-4" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="square" />
      <path d="M19 25l5-9 5 9" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: LABEL, marginBottom: '1mm' }}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

/**
 * One layout for every customer-facing document, so a quote, the invoice it
 * becomes and the receipt that closes it all read as the same stationery —
 * only the title, the meta fields and the money blocks differ.
 *
 * A delivery note is the one structural exception: it is a dispatch document
 * and shows quantities and signature blocks, never prices of any kind.
 */
export function DocumentSheet({ doc }: { doc: SaleDocument }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const variant = (doc.type as Variant) ?? 'INVOICE';
  const isDeliveryNote = variant === 'DELIVERY_NOTE';
  const number =
    doc.deliveryNoteNumber ?? doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.id.slice(0, 8).toUpperCase();
  const customerName = doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer';
  const deliverTo = doc.customer?.address || doc.customer?.location || null;
  const sourceRef = doc.sourceDocument?.receiptNumber ?? doc.sourceDocument?.invoiceNumber ?? doc.sourceDocument?.quoteNumber ?? null;
  const showDeliveryLine = doc.transportMode === 'ITEMIZED' && doc.transportAmount > 0;
  const showDeliveryIncluded = doc.transportMode === 'DISTRIBUTED' && doc.transportAmount > 0;
  const unpaid = doc.status === 'INVOICED';

  return (
    <div
      id="print-area"
      className="print-a4 printable-doc pdf-capture-offscreen"
      style={{ backgroundColor: '#ffffff', color: INK, fontSize: '13px', lineHeight: 1.55 }}
    >
      {/* Letterhead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10mm' }}>
        <div style={{ display: 'flex', gap: '4mm', alignItems: 'flex-start' }}>
          <BrandMark />
          <div>
            <p style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.01em' }}>{settings?.businessName ?? 'Pava Steel Hardware'}</p>
            {settings?.address && <p style={{ color: MUTED }}>{settings.address}</p>}
            <p style={{ color: MUTED }}>{[settings?.phone, settings?.email].filter(Boolean).join('  ·  ')}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '23px', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{TITLES[variant]}</p>
          <p style={{ fontSize: '14px', fontWeight: 600, color: ACCENT }}>{number}</p>
          {!isDeliveryNote && unpaid && (
            <p style={{ marginTop: '1mm', display: 'inline-block', border: `1px solid ${INK}`, padding: '0.5mm 2.5mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Unpaid
            </p>
          )}
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${INK}`, marginTop: '5mm' }} />

      {/* Parties and references */}
      <div style={{ display: 'flex', gap: '8mm', marginTop: '6mm' }}>
        <div style={{ flex: 1.4 }}>
          <Field label={isDeliveryNote ? 'Deliver to' : 'Billed to'}>
            <p style={{ fontWeight: 600, fontSize: '14px' }}>{customerName}</p>
            {deliverTo && <p style={{ color: MUTED }}>{deliverTo}</p>}
            {doc.customer?.phone && <p style={{ color: MUTED }}>{doc.customer.phone}</p>}
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Date">
            <p>{fmtDate(doc.createdAt)}</p>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={isDeliveryNote ? 'Order reference' : 'Issued by'}>
            <p>{isDeliveryNote ? (sourceRef ?? '—') : doc.createdBy?.name ?? '—'}</p>
          </Field>
        </div>
      </div>

      {/* Items. Percentage widths with table-layout:fixed, not fixed mm
          values — mm widths that happened to add up fine for an invoice's
          six columns ran past the page edge on the delivery note's wider
          four-column layout. Percentages always sum to the page width,
          whichever variant is showing. */}
      <table style={{ width: '100%', marginTop: '7mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          {isDeliveryNote ? (
            <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '7%' }}>#</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '55%' }}>Description</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, textAlign: 'right', width: '19%' }}>Qty</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '19%' }}>Unit</th>
            </tr>
          ) : (
            <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '6%' }}>#</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '34%' }}>Description</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, textAlign: 'right', width: '12%' }}>Qty</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, width: '10%' }}>Unit</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, textAlign: 'right', width: '17%' }}>Price</th>
              <th style={{ padding: '2.5mm 2mm', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: LABEL, textAlign: 'right', width: '21%' }}>Amount</th>
            </tr>
          )}
        </thead>
        <tbody>
          {/* qty × unit price = amount. The unit price already is the price
              agreed for this document — there is no separate discount column. */}
          {doc.items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <td style={{ padding: '2.8mm 2mm', fontSize: '12px', color: LABEL }}>{i + 1}</td>
              <td style={{ padding: '2.8mm 2mm', fontSize: '13px', wordBreak: 'break-word' }}>{item.description}</td>
              <td style={{ padding: '2.8mm 2mm', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{qty(item.qty)}</td>
              <td style={{ padding: '2.8mm 2mm', fontSize: '13px', color: MUTED }}>{item.product?.unit?.symbol ?? ''}</td>
              {!isDeliveryNote && (
                <>
                  <td style={{ padding: '2.8mm 2mm', fontSize: '13px', textAlign: 'right' }}>{money(item.unitPrice)}</td>
                  <td style={{ padding: '2.8mm 2mm', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{money(item.lineTotal)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Money, or signatures on a delivery note */}
      {isDeliveryNote ? (
        <div style={{ display: 'flex', gap: '10mm', marginTop: '16mm' }}>
          <div style={{ flex: 1, borderTop: `1px solid ${INK}`, paddingTop: '2mm', fontSize: '11px', color: LABEL }}>
            Dispatched by — name &amp; signature
          </div>
          <div style={{ flex: 1, borderTop: `1px solid ${INK}`, paddingTop: '2mm', fontSize: '11px', color: LABEL }}>
            Received by — name, signature &amp; date
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5mm' }}>
          <div style={{ width: '78mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
              <span style={{ color: MUTED }}>Subtotal</span>
              <span>KSh {money(doc.subtotal)}</span>
            </div>
            {showDeliveryLine && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
                <span style={{ color: MUTED }}>Delivery</span>
                <span>KSh {money(doc.transportAmount)}</span>
              </div>
            )}
            {showDeliveryIncluded && <p style={{ textAlign: 'right', fontSize: '11px', color: LABEL }}>Delivery included in prices</p>}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2.5mm 0',
                marginTop: '1mm',
                borderTop: `2px solid ${INK}`,
                borderBottom: `2px solid ${INK}`,
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              <span>Total</span>
              <span>KSh {money(doc.total)}</span>
            </div>
            {variant === 'RECEIPT' && doc.paymentMethod && (
              <p style={{ marginTop: '2mm', textAlign: 'right', fontSize: '11px', color: MUTED }}>
                Paid by {doc.paymentMethod === 'MPESA' ? 'M-Pesa Paybill' : 'cash'}
              </p>
            )}
            {unpaid && (
              <p style={{ marginTop: '2mm', textAlign: 'right', fontSize: '11px', color: MUTED }}>
                Payable on collection.
              </p>
            )}
          </div>
        </div>
      )}

      {doc.notes && (
        <div style={{ marginTop: '8mm' }}>
          <Field label="Notes">
            <p style={{ whiteSpace: 'pre-line' }}>{doc.notes}</p>
          </Field>
        </div>
      )}

      {/* Payment details belong on documents the customer still has to act on. */}
      {!isDeliveryNote && variant !== 'RECEIPT' && settings?.paymentDetails && (
        <div style={{ marginTop: '8mm', border: `1px solid ${LINE}`, padding: '4mm' }}>
          <Field label="How to pay">
            <p style={{ whiteSpace: 'pre-line' }}>{settings.paymentDetails}</p>
          </Field>
        </div>
      )}

      <div style={{ marginTop: '12mm', borderTop: `1px solid ${HAIRLINE}`, paddingTop: '3mm', display: 'flex', justifyContent: 'space-between', gap: '6mm', fontSize: '10px', color: LABEL }}>
        <span>{settings?.documentFooter?.trim() || (isDeliveryNote ? 'Goods received in good order unless noted above.' : 'Thank you for your business.')}</span>
        <span>
          {TITLES[variant]} {number}
        </span>
      </div>
    </div>
  );
}