'use client';

import type { DocumentViewModel } from '../../lib/document-view-model';
import { fmtNumber, money } from '../../lib/format';

function qty(n: number) {
  return fmtNumber(n);
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

// A receipt is paper. It is black on white at every step — on screen, in the
// print dialog and in the exported PDF — no matter which theme the app is
// running in, so none of these values may be a theme variable.
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '1px dashed #9ca3af';

/**
 * Direction B from the Phase 2 mark review: a hollow square-tube
 * cross-section. Solid black geometry only, no gradients or fine detail, so
 * it survives a 203dpi thermal head and a monochrome print driver.
 */
function ThermalBrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" role="img" aria-label="PAVA" style={{ display: 'block', margin: '0 auto' }}>
      <rect x="6" y="6" width="28" height="28" fill="none" stroke={INK} strokeWidth="3" />
      <rect x="14" y="14" width="12" height="12" fill="none" stroke={INK} strokeWidth="3" />
    </svg>
  );
}

/**
 * One component for all four document types, parameterized entirely by
 * `DocumentViewModel` — the thermal-side counterpart to the PDF templates in
 * `lib/pdf/`. A delivery note is the structural exception, same as
 * everywhere else in this system: `DeliveryNoteBody` below is a genuinely
 * thermal-native compact packing-slip, not a shrunk copy of the money
 * layout — items and quantities only, the delivery location, and a single
 * signature line rather than the PDF's two-column block.
 */
export function ThermalDocument({
  vm,
  variant,
}: {
  vm: DocumentViewModel;
  /** `print` renders the off-screen capture/print source carrying #print-area. */
  variant: 'preview' | 'print';
}) {
  const rootProps =
    variant === 'print'
      ? { id: 'print-area', className: 'print-thermal printable-doc pdf-capture-offscreen' }
      : { className: 'printable-doc' };

  return (
    <div
      {...rootProps}
      style={{
        width: variant === 'print' ? '80mm' : '100%',
        padding: variant === 'print' ? '5mm' : '16px',
        backgroundColor: '#ffffff',
        color: INK,
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <ThermalBrandMark />
        <p style={{ marginTop: '4px', fontWeight: 700, letterSpacing: '0.06em' }}>{vm.letterhead.businessName.toUpperCase()}</p>
        {vm.letterhead.address && <p style={{ color: MUTED }}>{vm.letterhead.address}</p>}
        {vm.letterhead.phone && <p style={{ color: MUTED }}>{vm.letterhead.phone}</p>}
        <p style={{ marginTop: '6px', fontWeight: 700, letterSpacing: '0.12em' }}>{vm.title.toUpperCase()}</p>
        <p style={{ fontWeight: 600 }}>{vm.number}</p>
        <p style={{ color: MUTED }}>{fmtDateTime(vm.createdAt)}</p>
        <p style={{ color: MUTED }}>{vm.isDeliveryNote ? `Deliver to: ${vm.customerName}` : vm.customerName}</p>
      </div>

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      {vm.isDeliveryNote ? <DeliveryNoteBody vm={vm} /> : <PricedBody vm={vm} />}

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      <p style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>{vm.letterhead.footerText}</p>
    </div>
  );
}

/** Quote, Invoice, Receipt — items with prices, a totals block, payment status. */
function PricedBody({ vm }: { vm: DocumentViewModel }) {
  return (
    <>
      {/* qty × unit price = line total. The unit price already IS the price
          agreed for this document — there is no separate discount figure. */}
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

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(vm.subtotal)}</span>
      </div>
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

      <p style={{ marginTop: '8px', textAlign: 'center', fontWeight: vm.paymentLabel ? 400 : 700 }}>
        {vm.type === 'RECEIPT' || vm.paymentLabel ? `Paid by ${vm.paymentLabel ?? 'cash'}` : 'UNPAID — SETTLE TODAY'}
      </p>
      {vm.issuedByName && <p style={{ textAlign: 'center', color: MUTED }}>Served by {vm.issuedByName}</p>}
    </>
  );
}

/**
 * Delivery note — the thermal-native packing slip. Quantities only, no
 * pricing of any kind, the delivery location, and one signature line rather
 * than the PDF's two-column released-by/received-by block: a driver signing
 * for a compact slip at the door doesn't need two labeled boxes to know
 * where to sign.
 */
function DeliveryNoteBody({ vm }: { vm: DocumentViewModel }) {
  return (
    <>
      {vm.customerAddress && (
        <p style={{ textAlign: 'center', color: MUTED, marginBottom: '8px' }}>{vm.customerAddress}</p>
      )}
      {vm.customerPhone && (
        <p style={{ textAlign: 'center', color: MUTED, marginBottom: '8px' }}>{vm.customerPhone}</p>
      )}
      {vm.sourceReference && (
        <p style={{ textAlign: 'center', color: MUTED, marginBottom: '8px' }}>Order ref {vm.sourceReference}</p>
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