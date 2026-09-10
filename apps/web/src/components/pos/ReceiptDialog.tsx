'use client';

import { Printer, X } from 'lucide-react';
import type { PosSaleResult } from '../../lib/pos-api';

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function ReceiptDialog({ sale, onClose }: { sale: PosSaleResult; onClose: () => void }) {
  const showDeliveryLine = sale.transportMode === 'ITEMIZED' && sale.transportAmount > 0;
  const showDeliveryIncluded = sale.transportMode === 'DISTRIBUTED' && sale.transportAmount > 0;
  const discountedItems = sale.items.filter((i) => i.discount > 0);
  const totalDiscount = discountedItems.reduce((s, i) => s + i.discount, 0);
  // What the sale would have totaled at normal prices, before any discount — for the "you saved" framing.
  const normalTotal = sale.items.reduce((s, i) => s + i.qty * i.basePrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 print:static print:block print:bg-white">
      <div className="absolute inset-0 print:hidden" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div
        className="relative flex max-h-[85vh] w-full max-w-sm flex-col rounded-lg border print:max-h-none print:w-full print:max-w-none print:border-0"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 print:hidden" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            Sale complete
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => window.print()} className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }} aria-label="Print">
              <Printer size={16} strokeWidth={2} />
            </button>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }} aria-label="Close">
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 font-mono text-sm" style={{ color: 'var(--color-ink-900)' }}>
          <div className="text-center">
            <p className="font-semibold">PAVA STEEL HARDWARE</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {fmtDateTime(sale.createdAt)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {sale.customer?.businessName || sale.customer?.name || sale.customerName || 'Walk-in customer'}
            </p>
          </div>

          <div className="my-3 border-t border-dashed" style={{ borderColor: 'var(--color-border)' }} />

          {/* Line items at normal (pre-discount) price */}
          <div className="flex flex-col gap-2">
            {sale.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.description}
                  <br />
                  <span style={{ color: 'var(--color-ink-600)' }}>
                    {item.qty} × {money(item.basePrice)}
                  </span>
                </span>
                <span className="shrink-0 data-num">{money(item.qty * item.basePrice)}</span>
              </div>
            ))}
          </div>

          {discountedItems.length > 0 && (
            <>
              <div className="my-3 border-t border-dashed" style={{ borderColor: 'var(--color-border)' }} />
              <p className="mb-1 text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.04em' }}>
                Discounts
              </p>
              <div className="flex flex-col gap-1">
                {discountedItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-xs">
                    <span style={{ color: 'var(--color-ink-600)' }}>{item.description}</span>
                    <span className="data-num" style={{ color: 'var(--color-status-bad)' }}>
                      -{money(item.discount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="my-3 border-t border-dashed" style={{ borderColor: 'var(--color-border)' }} />

          <div className="flex flex-col gap-1">
            {totalDiscount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-ink-600)' }}>Subtotal (before discount)</span>
                <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                  {money(normalTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="data-num">{money(sale.subtotal)}</span>
            </div>
            {showDeliveryIncluded && (
              <p className="text-center text-xs" style={{ color: 'var(--color-ink-600)' }}>
                Delivery included
              </p>
            )}
            {showDeliveryLine && (
              <div className="flex justify-between">
                <span>Delivery</span>
                <span className="data-num">{money(sale.transportAmount)}</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-between text-base font-semibold">
            <span>TOTAL</span>
            <span className="data-num">{money(sale.total)}</span>
          </div>

          <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {sale.paymentMethod === 'CREDIT' ? 'On account' : `Paid via ${sale.paymentMethod}`}
          </p>
        </div>
      </div>
    </div>
  );
}