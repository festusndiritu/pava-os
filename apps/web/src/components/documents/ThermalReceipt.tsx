'use client';

import { useEffect, useState } from 'react';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';

export interface ReceiptItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  number: string | null;
  createdAt: string;
  customerLabel: string;
  items: ReceiptItem[];
  subtotal: number;
  total: number;
  transportMode: string;
  transportAmount: number;
  paymentMethod: string | null;
  servedBy?: string | null;
}

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

const PAYMENT_LABEL: Record<string, string> = {
  MPESA: 'Paid by M-Pesa Paybill',
  CASH: 'Paid in cash',
  CREDIT: 'On account',
  CARD: 'Paid by card',
};

// A receipt is paper. It is black on white at every step — on screen, in the
// print dialog and in the exported PDF — no matter which theme the app is
// running in, so none of these values may be a theme variable.
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '1px dashed #9ca3af';

/**
 * Compact brand mark: solid black geometry only, no gradients or fine detail,
 * so it survives a 203dpi thermal head and a monochrome print driver.
 */
function ThermalBrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" role="img" aria-label="PAVA" style={{ display: 'block', margin: '0 auto' }}>
      <rect x="1" y="1" width="32" height="32" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M8 25V9h8a5 5 0 0 1 0 10h-4" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="square" />
      <path d="M19 25l5-9 5 9" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function ThermalReceipt({
  data,
  variant,
  title = 'RECEIPT',
}: {
  data: ReceiptData;
  /** `print` renders the off-screen capture/print source carrying #print-area. */
  variant: 'preview' | 'print';
  title?: string;
}) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const showDeliveryLine = data.transportMode === 'ITEMIZED' && data.transportAmount > 0;
  const showDeliveryIncluded = data.transportMode === 'DISTRIBUTED' && data.transportAmount > 0;
  const thankYou = settings?.documentFooter?.trim() || 'Thank you for your business.';

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
        <p style={{ marginTop: '4px', fontWeight: 700, letterSpacing: '0.06em' }}>
          {(settings?.businessName ?? 'PAVA STEEL HARDWARE').toUpperCase()}
        </p>
        {settings?.address && <p style={{ color: MUTED }}>{settings.address}</p>}
        {settings?.phone && <p style={{ color: MUTED }}>{settings.phone}</p>}
        <p style={{ marginTop: '6px', fontWeight: 700, letterSpacing: '0.12em' }}>{title}</p>
        {data.number && <p style={{ fontWeight: 600 }}>{data.number}</p>}
        <p style={{ color: MUTED }}>{fmtDateTime(data.createdAt)}</p>
        <p style={{ color: MUTED }}>{data.customerLabel}</p>
      </div>

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      {/* qty × unit price = line total. The unit price already IS the price
          agreed for this sale — there is no separate discount figure. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.items.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ minWidth: 0 }}>
              {item.description}
              <br />
              <span style={{ color: MUTED }}>
                {item.qty} × {money(item.unitPrice)}
              </span>
            </span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(data.subtotal)}</span>
      </div>
      {showDeliveryLine && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Delivery</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(data.transportAmount)}</span>
        </div>
      )}
      {showDeliveryIncluded && <p style={{ textAlign: 'center', color: MUTED }}>Delivery included</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(data.total)}</span>
      </div>

      <p style={{ marginTop: '8px', textAlign: 'center', fontWeight: data.paymentMethod ? 400 : 700 }}>
        {data.paymentMethod ? (PAYMENT_LABEL[data.paymentMethod] ?? 'Paid') : 'UNPAID — SETTLE TODAY'}
      </p>
      {data.servedBy && <p style={{ textAlign: 'center', color: MUTED }}>Served by {data.servedBy}</p>}

      <div style={{ borderTop: RULE, margin: '10px 0' }} />

      <p style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>{thankYou}</p>
    </div>
  );
}