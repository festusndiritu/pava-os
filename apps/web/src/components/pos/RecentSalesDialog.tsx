'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { documentsApi, type SaleDocument } from '../../lib/documents-api';
import { money } from '../../lib/format';
import { Modal } from '../ui/Modal';

const time = (iso: string) => new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The latest sales, so a receipt can be found and reprinted without leaving the till. */
export function RecentSalesDialog({ onClose, onPick }: { onClose: () => void; onPick: (documentId: string) => void }) {
  const [rows, setRows] = useState<SaleDocument[] | null>(null);

  useEffect(() => {
    Promise.all([documentsApi.list({ status: 'PAID', limit: 15 }), documentsApi.list({ status: 'INVOICED', limit: 15 })])
      .then(([paid, invoiced]) =>
        setRows(
          [...paid, ...invoiced]
            .filter((d) => d.type !== 'DELIVERY_NOTE')
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, 15),
        ),
      )
      .catch(() => setRows([]));
  }, []);

  return (
    <Modal onClose={onClose} label="Recent sales" className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Recent sales
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
          <X size={17} strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows === null && (
          <p className="p-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Loading…
          </p>
        )}
        {rows?.length === 0 && (
          <p className="p-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            No sales yet.
          </p>
        )}
        {rows?.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick(d.id)}
            className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left hover:bg-[var(--color-bg)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {d.receiptNumber || d.invoiceNumber || d.quoteNumber}
                {' · '}
                {d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in'}
              </span>
              <span className="block text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {time(d.createdAt)} · {d.status === 'PAID' ? 'Paid' : 'Not paid yet'}
              </span>
            </span>
            <span className="data-num shrink-0 text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {money(d.total)}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
