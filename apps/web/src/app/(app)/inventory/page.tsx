'use client';

import { useEffect, useState, Fragment } from 'react';
import { Boxes, Plus } from 'lucide-react';
import { inventoryApi, type InventoryReceipt } from '../../../lib/products-api';
import { ReceiveInventoryDrawer } from '../../../components/inventory/ReceiveInventoryDrawer';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function InventoryPage() {
  const [receipts, setReceipts] = useState<InventoryReceipt[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setReceipts(await inventoryApi.receipts());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Inventory
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Stock receipts and acquisition cost — feeds FIFO costing automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Receive inventory
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Date
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Supplier
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Reference
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Received by
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Total value
              </th>
            </tr>
          </thead>
          <tbody>
            {receipts === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {receipts?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Boxes size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No inventory receipts yet
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Receive your first stock delivery to start tracking quantities and acquisition costs.
                  </p>
                </td>
              </tr>
            )}

            {receipts?.map((r) => {
              const total = r.batches.reduce((sum, b) => sum + b.quantityReceived * b.unitCost, 0);
              const isOpen = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="cursor-pointer border-b transition-colors hover:bg-[var(--color-bg)]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--color-ink-900)' }}>
                      {fmtDate(r.receivedAt)}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {r.supplier}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                      {r.receivedBy.name}
                    </td>
                    <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                      KSh {total.toLocaleString()}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {r.batches.map((b) => (
                            <div key={b.id} className="flex items-center justify-between text-xs">
                              <span style={{ color: 'var(--color-ink-900)' }}>{b.product.displayName ?? b.product.name}</span>
                              <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                                {b.quantityReceived} × KSh {b.unitCost.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Mobile: stacked cards, tap to expand line items (brief §63) */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {receipts === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {receipts?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Boxes size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No inventory receipts yet
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                Receive your first stock delivery to start tracking quantities and acquisition costs.
              </p>
            </div>
          )}

          {receipts?.map((r) => {
            const total = r.batches.reduce((sum, b) => sum + b.quantityReceived * b.unitCost, 0);
            const isOpen = expanded === r.id;
            return (
              <div key={r.id}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)} className="flex w-full flex-col gap-1 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {r.supplier}
                    </p>
                    <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                      KSh {total.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    {fmtDate(r.receivedAt)} {r.reference ? `· ${r.reference}` : ''} · {r.receivedBy.name}
                  </p>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-1.5 px-4 pb-4" style={{ backgroundColor: 'var(--color-bg)' }}>
                    {r.batches.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-xs pt-2">
                        <span style={{ color: 'var(--color-ink-900)' }}>{b.product.displayName ?? b.product.name}</span>
                        <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                          {b.quantityReceived} × KSh {b.unitCost.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ReceiveInventoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onDone={() => {
          setDrawerOpen(false);
          load();
        }}
      />
    </div>
  );
}