'use client';

import { useEffect, useState } from 'react';
import { settingsApi, type BusinessSettings } from '../../lib/settings-api';
import type { SaleDocument } from '../../lib/documents-api';

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}

const DOC_LABEL: Record<string, string> = { QUOTE: 'Quotation', INVOICE: 'Invoice', RECEIPT: 'Receipt' };

// Full-page, letterhead-style layout — for anything a customer will actually
// receive (a quote, an invoice, a delivery note) as opposed to the plain
// 80mm thermal strip. Rendered off-screen (fixed position, way off the left
// edge) rather than display:none, so it's still laid out and can be
// captured by html2canvas for PDF export; the `#print-area.print-a4` rule
// in globals.css repositions and reveals it when the page is actually
// printed.
export function DocumentLetterhead({ doc }: { doc: SaleDocument }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const number = doc.invoiceNumber ?? doc.quoteNumber ?? doc.receiptNumber ?? doc.id.slice(0, 8).toUpperCase();
  const showDeliveryIncluded = doc.transportMode === 'DISTRIBUTED' && doc.transportAmount > 0;
  const showDeliveryLine = doc.transportMode === 'ITEMIZED' && doc.transportAmount > 0;

  return (
    <div id="print-area" className="print-a4 pdf-capture-offscreen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '10mm' }}>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700 }}>{settings?.businessName ?? 'Pava Steel Hardware'}</p>
          {settings?.address && <p style={{ color: '#4b5563' }}>{settings.address}</p>}
          <p style={{ color: '#4b5563' }}>
            {[settings?.phone, settings?.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '16px', fontWeight: 700 }}>{DOC_LABEL[doc.type] ?? doc.type}</p>
          <p style={{ color: '#4b5563' }}>{number}</p>
          <p style={{ color: '#4b5563' }}>{fmtDate(doc.createdAt)}</p>
        </div>
      </div>

      <div style={{ marginTop: '8mm' }}>
        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Billed to</p>
        <p style={{ fontWeight: 600 }}>{doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer'}</p>
        {doc.customer?.phone && <p style={{ color: '#4b5563' }}>{doc.customer.phone}</p>}
      </div>

      <table style={{ width: '100%', marginTop: '8mm', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #111827', textAlign: 'left' }}>
            <th style={{ padding: '2mm 0', fontSize: '11px', textTransform: 'uppercase', color: '#6b7280' }}>Item</th>
            <th style={{ padding: '2mm 0', fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', textAlign: 'right' }}>Qty × Price</th>
            <th style={{ padding: '2mm 0', fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Every line: qty × unit price = line total. The unit price already
              IS whatever was negotiated — no separate "discount" column. */}
          {doc.items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '2mm 0' }}>{item.description}</td>
              <td style={{ padding: '2mm 0', textAlign: 'right' }}>
                {item.qty} × {money(item.unitPrice)}
              </td>
              <td style={{ padding: '2mm 0', textAlign: 'right', fontWeight: 600 }}>{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '6mm', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '65mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
            <span style={{ color: '#4b5563' }}>Subtotal</span>
            <span>{money(doc.subtotal)}</span>
          </div>
          {showDeliveryLine && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
              <span style={{ color: '#4b5563' }}>Delivery</span>
              <span>{money(doc.transportAmount)}</span>
            </div>
          )}
          {showDeliveryIncluded && (
            <p style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280' }}>Delivery included</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', borderTop: '2px solid #111827', marginTop: '1mm', fontWeight: 700, fontSize: '13px' }}>
            <span>Total</span>
            <span>{money(doc.total)}</span>
          </div>
        </div>
      </div>

      {doc.notes && (
        <div style={{ marginTop: '8mm' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Notes</p>
          <p>{doc.notes}</p>
        </div>
      )}

      {settings?.paymentDetails && (
        <div style={{ marginTop: '8mm', padding: '4mm', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Payment details</p>
          <p style={{ whiteSpace: 'pre-line' }}>{settings.paymentDetails}</p>
        </div>
      )}

      {settings?.documentFooter && (
        <p style={{ marginTop: '10mm', textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>{settings.documentFooter}</p>
      )}
    </div>
  );
}