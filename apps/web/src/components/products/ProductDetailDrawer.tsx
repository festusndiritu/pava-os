'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { inventoryApi, productsApi, type InventoryBatch, type InventoryMovement, type Product, type ProductPriceHistoryEntry } from '../../lib/products-api';
import { thicknessLabel } from '../../lib/shape-config';
import { ApiError } from '../../lib/api';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
      style={{ borderColor: active ? 'var(--color-accent)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
    >
      {label}
    </button>
  );
}

export function ProductDetailDrawer({
  productId,
  onClose,
  onEdit,
  onChanged,
}: {
  productId: string | null;
  onClose: () => void;
  onEdit: (p: Product) => void;
  onChanged: () => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [tab, setTab] = useState<'batches' | 'history' | 'ledger'>('batches');
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    Promise.all([productsApi.get(productId), inventoryApi.batches(productId), productsApi.priceHistory(productId), inventoryApi.movements(productId)])
      .then(([p, b, h, m]) => {
        setProduct(p);
        setBatches(b);
        setHistory(h);
        setMovements(m);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (!productId) return null;

  const gauge = product ? thicknessLabel(product.shape, product.thicknessMm) : null;
  const totalRemaining = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
  const inventoryValue = batches.reduce((sum, b) => sum + b.remainingQuantity * b.unitCost, 0);

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={product?.displayName ?? product?.name ?? 'Product'}
        subtitle={product?.name}
        footer={
          product && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
              >
                Edit product
              </button>
              <button
                type="button"
                onClick={() => setAdjustOpen(true)}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                Adjust stock
              </button>
            </div>
          )
        }
      >
        {loading && (
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Loading…
          </p>
        )}

        {product && !loading && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                  Stock
                </p>
                <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {product.stockQuantity} {product.unit.symbol}
                </p>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                  Selling price
                </p>
                <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {money(product.basePrice)}
                </p>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                  Inventory value
                </p>
                <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {money(inventoryValue)}
                </p>
              </div>
            </div>

            {(gauge || product.nominalSize) && (
              <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {[product.nominalSize, gauge].filter(Boolean).join(' · ')}
                {product.widthMm && product.heightMm ? ` · ${product.widthMm}x${product.heightMm}mm` : ''}
              </p>
            )}

            {product.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.aliases.map((a) => (
                  <span key={a.id} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                    {a.term}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <Tab label="Batches" active={tab === 'batches'} onClick={() => setTab('batches')} />
              <Tab label="Price history" active={tab === 'history'} onClick={() => setTab('history')} />
              <Tab label="Ledger" active={tab === 'ledger'} onClick={() => setTab('ledger')} />
            </div>

            {tab === 'batches' && (
              <div className="flex flex-col gap-2">
                {batches.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    No inventory receipts yet for this product.
                  </p>
                )}
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {b.receipt.supplier}
                        {b.receipt.reference ? ` · ${b.receipt.reference}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        Received {fmtDate(b.createdAt)} · {money(b.unitCost)}/unit
                      </p>
                    </div>
                    <p className="text-sm font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {b.remainingQuantity} / {b.quantityReceived}
                    </p>
                  </div>
                ))}
                {batches.length > 0 && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                    Remaining / received, oldest batch first — consumed FIFO.
                  </p>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="flex flex-col gap-2">
                {history.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Price hasn't changed since this product was created.
                  </p>
                )}
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-ink-900)' }}>
                        {money(h.oldPrice)} <span style={{ color: 'var(--color-ink-600)' }}>→</span> {money(h.newPrice)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {fmtDate(h.changedAt)} · {h.changedBy.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'ledger' && (
              <div className="flex flex-col gap-2">
                {movements.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    No stock movements recorded yet.
                  </p>
                )}
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {m.type}
                        {m.note ? ` · ${m.note}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {fmtDate(m.createdAt)} · {m.createdBy.name}
                      </p>
                    </div>
                    <p className="text-sm font-medium data-num" style={{ color: m.quantity >= 0 ? 'var(--color-status-ok)' : 'var(--color-status-bad)' }}>
                      {m.quantity >= 0 ? '+' : ''}
                      {m.quantity}
                    </p>
                  </div>
                ))}
                {totalRemaining !== product.stockQuantity && batches.length > 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-status-warn)' }}>
                    Batch total ({totalRemaining}) differs from cached stock ({product.stockQuantity}) — likely a manual adjustment outside FIFO batches.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {adjustOpen && product && (
        <AdjustStockDialog
          product={product}
          onClose={() => setAdjustOpen(false)}
          onDone={() => {
            setAdjustOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function AdjustStockDialog({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<'ADJUSTMENT' | 'CORRECTION' | 'RETURN'>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(allowNegative = false) {
    const qty = Number(quantity);
    if (!qty) return;
    setSaving(true);
    setError(null);
    try {
      await inventoryApi.adjust({ productId: product.id, quantity: qty, type, note: note || undefined, allowNegative });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not adjust stock.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Adjust stock — {product.displayName ?? product.name}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          Current: {product.stockQuantity} {product.unit.symbol}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          >
            <option value="ADJUSTMENT">Stocktake adjustment</option>
            <option value="CORRECTION">Correction</option>
            <option value="RETURN">Customer return</option>
          </select>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity (use a negative number to reduce)"
            className="w-full rounded-md border px-3 py-2 text-sm data-num"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (recommended)"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />

          {error && (
            <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
              {error.toLowerCase().includes('negative') && (
                <button type="button" onClick={() => submit(true)} className="ml-2 font-semibold underline">
                  Proceed anyway
                </button>
              )}
            </div>
          )}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={saving || !quantity}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}