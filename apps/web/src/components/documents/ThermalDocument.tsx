'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentViewModel } from '../../lib/document-view-model';
import { fmtNumber, money } from '../../lib/format';
import { THERMAL_PADDING_MM, THERMAL_WIDTH_MM } from '../../lib/thermal-config';

function qty(n: number) {
  return fmtNumber(n);
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

// A receipt is paper.
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '1px dashed #9ca3af';

function ThermalBrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/pava-logo.png" width={56} height={56} alt="PAVA" style={{ display: 'block', margin: '0 auto 8px', filter: 'grayscale(1) contrast(3)' }} />
  );
}

/** One component for all four document types, parameterized entirely by `DocumentViewModel` — the thermal-side counterpart to the PDF templates in `lib/pdf/`. */
export function ThermalDocument({
  vm,
  variant,
}: {
  vm: DocumentViewModel;
  variant: 'preview' | 'print';
}) {
  const rootProps =
    variant === 'print'
      ? { id: 'print-area', className: 'print-thermal printable-doc pdf-capture-offscreen' }
      : { className: 'printable-doc' };

  // The print source is portalled to <body> so that, at print time, it can be the only thing in the
  // document (see the @media print block in globals.css).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const doc = (
    <div
      {...rootProps}
      style={{
        width: variant === 'print' ? `${THERMAL_WIDTH_MM}mm` : '100%',
        padding: variant === 'print' ? `${THERMAL_PADDING_MM}mm` : '16px',
        ...(variant === 'print' ? ({ '--thermal-width': `${THERMAL_WIDTH_MM}mm` } as CSSProperties) : null),
        backgroundColor: '#ffffff',
        color: INK,
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {!vm.isDeliveryNote && <ThermalBrandMark />}
        <p style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.08em' }}>{vm.letterhead.businessName.toUpperCase()}</p>
        {!vm.isDeliveryNote && vm.letterhead.address && <p style={{ color: MUTED }}>{vm.letterhead.address}</p>}
        {!vm.isDeliveryNote && vm.letterhead.phone && <p style={{ color: MUTED }}>{vm.letterhead.phone}</p>}
        <p style={{ marginTop: '6px', fontWeight: 700, letterSpacing: '0.12em' }}>{vm.title.toUpperCase()}</p>
        <p style={{ fontWeight: 600 }}>{vm.number}</p>
        <p style={{ color: MUTED }}>{fmtDateTime(vm.createdAt)}</p>
        <p style={{ color: MUTED }}>{vm.isDeliveryNote ? `Deliver to: ${vm.customerName}` : vm.customerName}</p>
      </div>

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      {vm.isDeliveryNote ? <DeliveryNoteBody vm={vm} /> : <PricedBody vm={vm} />}

      {vm.letterhead.footerText && (
        <>
          <div style={{ borderTop: RULE, margin: '10px 0' }} />
          <p style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>{vm.letterhead.footerText}</p>
        </>
      )}
    </div>
  );

  if (variant === 'print') return mounted ? createPortal(doc, document.body) : null;
  return doc;
}

function PricedBody({ vm }: { vm: DocumentViewModel }) {
  return (
    <>
      {/* qty × unit price = line total. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {vm.items.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ minWidth: 0 }}>
              {item.description}
              <br />
              <span style={{ color: MUTED }}>
                {qty(item.qty)} × {money(item.unitPrice)}
              </span>
            </span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      {!vm.showTransportIncludedNote && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(vm.subtotal)}</span>
        </div>
      )}
      {vm.showTransportLine && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Delivery</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(vm.transportAmount)}</span>
        </div>
      )}
      {vm.showTransportIncludedNote && <p style={{ textAlign: 'center', color: MUTED }}>Delivery included</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(vm.total)}</span>
      </div>

      {vm.type === 'RECEIPT' && vm.paymentLabel && (
        <p style={{ marginTop: '8px', textAlign: 'center' }}>Paid by {vm.paymentLabel}</p>
      )}
      {vm.type === 'RECEIPT' && vm.changeNote && <p style={{ textAlign: 'center' }}>{vm.changeNote}</p>}
      {vm.type !== 'RECEIPT' && vm.letterhead.paymentDetails && (
        <p style={{ marginTop: '8px', textAlign: 'center', color: MUTED }}>How to pay: {vm.letterhead.paymentDetails}</p>
      )}
      {vm.issuedByName && <p style={{ textAlign: 'center', color: MUTED }}>Served by {vm.issuedByName}</p>}
    </>
  );
}

/** Delivery note — the thermal-native packing slip. */
function DeliveryNoteBody({ vm }: { vm: DocumentViewModel }) {
  return (
    <>
      {vm.customerAddress && (
        <p style={{ textAlign: 'center', color: MUTED, marginBottom: '8px' }}>{vm.customerAddress}</p>
      )}
      {vm.customerPhone && (
        <p style={{ textAlign: 'center', color: MUTED, marginBottom: '8px' }}>{vm.customerPhone}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {vm.items.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ minWidth: 0 }}>{item.description}</span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {qty(item.qty)} {item.unitSymbol}
            </span>
          </div>
        ))}
      </div>

      {vm.notes && (
        <p style={{ marginTop: '8px', color: MUTED, whiteSpace: 'pre-line' }}>{vm.notes}</p>
      )}

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      <p style={{ textAlign: 'center' }}>Received by: _____________________</p>
      <p style={{ textAlign: 'center', color: MUTED }}>Name, signature &amp; date</p>
    </>
  );
}