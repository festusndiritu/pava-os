'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Drawer } from '../ui/Drawer';
import { inventoryApi, productsApi, type InventoryBatch, type InventoryMovement, type Product, type ProductPriceHistoryEntry } from '../../lib/products-api';
import { AdjustStockDialog } from '../inventory/AdjustStockDialog';
import { StockBadge } from '../inventory/StockBadge';
import { thicknessLabel } from '../../lib/shape-config';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { availability, useLowStockThreshold } from '../../lib/stock';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { fmtNumber, money } from '../../lib/format';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

type TabKey = 'batches' | 'history' | 'ledger';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'batches', label: 'Batches' },
  { key: 'history', label: 'Price history' },
  { key: 'ledger', label: 'Ledger' },
];

// The raw movement enum is database vocabulary; this is what the counter says.
const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: 'Received',
  SALE: 'Sold',
  ADJUSTMENT: 'Stocktake adjustment',
  RETURN: 'Customer return',
  DAMAGE: 'Damaged',
  LOSS: 'Lost or stolen',
  CORRECTION: 'Correction',
  OPENING: 'Opening balance',
};

function Tabs({ value, onChange }: { value: TabKey; onChange: (k: TabKey) => void }) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === value);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    onChange(next.key);
    document.getElementById(`product-tab-${next.key}`)?.focus();
  }
  return (
    <div role="tablist" aria-label="Product history" onKeyDown={onKeyDown} className="flex gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            id={`product-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`product-panel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            className="min-h-10 border-b-2 px-1 text-sm font-medium transition-colors"
            style={{ borderColor: active ? 'var(--color-accent)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm" title={value} style={{ color: 'var(--color-ink-900)' }}>
        {value}
      </dd>
    </div>
  );
}

function SectionNote({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--color-status-bad)' : tone === 'warn' ? 'var(--color-status-warn)' : 'var(--color-ink-600)';
  return (
    <p className="text-sm" style={{ color }}>
      {children}
    </p>
  );
}

const sectionMessage = (err: unknown, what: string) => (err instanceof ApiError && err.status === 403 ? `You don’t have access to ${what}.` : `Couldn’t load ${what}. Close and reopen to try again.`);

export function ProductDetailDrawer({
  productId,
  onClose,
  onEdit,
  onReceive,
  onChanged,
  refreshKey = 0,
}: {
  productId: string | null;
  onClose: () => void;
  /** Omit for people who can't edit products (the API allows admins only). */
  onEdit?: (p: Product) => void;
  /** Omit for people without inventory access. Opens the receive-stock drawer for this product. */
  onReceive?: (p: Product) => void;
  onChanged: () => void;
  /** Bump to reload what the drawer shows after something outside it changed stock. */
  refreshKey?: number;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [tab, setTab] = useState<TabKey>('batches');
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [problems, setProblems] = useState<Partial<Record<TabKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [deletingForever, setDeletingForever] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { canViewCost, hasPermission, user } = useAuth();
  const showCost = canViewCost();
  const isAdmin = user?.role === 'ADMIN';
  const canAdjust = hasPermission('INVENTORY');
  const threshold = useLowStockThreshold();

  // A different product starts from a clean slate, not the last one's data.
  useEffect(() => {
    setProduct(null);
    setTab('batches');
    setError(null);
    setLoadError(null);
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    let stale = false;
    setLoading(true);
    (async () => {
      // Each part loads on its own: batches, history and the ledger sit behind
      // module permissions the product itself doesn't, and one refusal should
      // not blank the whole drawer.
      const [p, b, h, m] = await Promise.allSettled([
        productsApi.get(productId),
        inventoryApi.batches(productId),
        productsApi.priceHistory(productId),
        inventoryApi.movements(productId),
      ]);
      if (stale) return;
      if (p.status === 'fulfilled') {
        setProduct(p.value);
        setLoadError(null);
      } else {
        setProduct(null);
        setLoadError(p.reason instanceof ApiError ? p.reason.message : 'Could not load this product.');
      }
      setBatches(b.status === 'fulfilled' ? b.value : []);
      setHistory(h.status === 'fulfilled' ? h.value : []);
      setMovements(m.status === 'fulfilled' ? m.value : []);
      setProblems({
        batches: b.status === 'rejected' ? sectionMessage(b.reason, 'batches') : undefined,
        history: h.status === 'rejected' ? sectionMessage(h.reason, 'price history') : undefined,
        ledger: m.status === 'rejected' ? sectionMessage(m.reason, 'the stock ledger') : undefined,
      });
      setLoading(false);
    })();
    return () => {
      stale = true;
    };
  }, [productId, reloadTick, refreshKey]);

  async function archive() {
    if (!product) return;
    setArchiving(true);
    setError(null);
    try {
      await productsApi.archive(product.id);
      setConfirmArchive(false);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not archive this product.');
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  async function restore() {
    if (!product) return;
    setArchiving(true);
    setError(null);
    try {
      const updated = await productsApi.restore(product.id);
      setProduct(updated);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this product.');
    } finally {
      setArchiving(false);
    }
  }

  async function hardDelete() {
    if (!product) return;
    setDeletingForever(true);
    setError(null);
    try {
      await productsApi.hardDelete(product.id);
      setConfirmHardDelete(false);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not permanently delete this product.');
      setConfirmHardDelete(false);
    } finally {
      setDeletingForever(false);
    }
  }

  if (!productId) return null;

  const gauge = product ? thicknessLabel(product.shape, product.thicknessMm) : null;
  const totalRemaining = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);

  // Value of what's on the shelf now. Stock added by an adjustment on a product
  // that never had a cost sits in a zero-cost batch, and stock can exist with no
  // batch at all, so both fall back to the product's last known cost. Whatever
  // still has no cost is called out instead of reading as KSh 0.
  const lastCost = product?.lastCost ?? 0;
  const liveBatches = batches.filter((b) => b.remainingQuantity > 0);
  const costOf = (b: InventoryBatch) => (b.unitCost > 0 ? b.unitCost : lastCost);
  const unbatched = Math.max(0, (product?.stockQuantity ?? 0) - totalRemaining);
  const inventoryValue = liveBatches.reduce((sum, b) => sum + b.remainingQuantity * costOf(b), 0) + unbatched * lastCost;
  const uncostedUnits = liveBatches.filter((b) => costOf(b) === 0).reduce((sum, b) => sum + b.remainingQuantity, 0) + (lastCost === 0 ? unbatched : 0);
  const margin = product && lastCost > 0 && product.basePrice > 0 ? Math.round(((product.basePrice - lastCost) / product.basePrice) * 100) : null;
  const size = product ? [product.nominalSize, gauge].filter(Boolean).join(' · ') + (product.widthMm && product.heightMm ? ` · ${product.widthMm}x${product.heightMm}mm` : '') : '';

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={product?.displayName ?? product?.name ?? 'Product'}
        subtitle={product?.displayName ? product.name : undefined}
        footer={
          product && (
            <div className="flex flex-col gap-2">
              {error && (
                <p role="alert" className="rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    className="min-h-11 flex-1 rounded-md border px-3 text-sm font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    Edit product
                  </button>
                )}
                {canAdjust && (
                  <button
                    type="button"
                    onClick={() => setAdjustOpen(true)}
                    className="min-h-11 flex-1 rounded-md border px-3 text-sm font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    Adjust stock
                  </button>
                )}
                {canAdjust && onReceive && (
                  <button type="button" onClick={() => onReceive(product)} className="min-h-11 flex-1 rounded-md px-3 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
                    Receive stock
                  </button>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => (product.active ? setConfirmArchive(true) : restore())}
                  disabled={archiving}
                  className="min-h-11 rounded-md border px-4 text-sm font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--color-border)', color: product.active ? 'var(--color-status-bad)' : 'var(--color-accent)' }}
                >
                  {archiving ? 'Working…' : product.active ? 'Archive product' : 'Restore product'}
                </button>
              )}
              {isAdmin && !product.active && (
                <button
                  type="button"
                  onClick={() => setConfirmHardDelete(true)}
                  disabled={deletingForever}
                  className="min-h-11 rounded-md border px-4 text-sm font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--color-status-bad)', color: 'var(--color-status-bad)' }}
                >
                  Delete permanently
                </button>
              )}
            </div>
          )
        }
      >
        {loading && !product && <SectionNote>Loading…</SectionNote>}

        {!loading && !product && loadError && (
          <div className="flex flex-col items-start gap-3" role="alert">
            <SectionNote tone="bad">{loadError}</SectionNote>
            <button type="button" onClick={() => setReloadTick((t) => t + 1)} className="min-h-10 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Try again
            </button>
          </div>
        )}

        {product && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                  Stock
                </p>
                <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {fmtNumber(product.stockQuantity)} {product.unit.symbol}
                </p>
                <div className="mt-1">
                  <StockBadge level={availability(product, threshold ?? 0)} />
                </div>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                  Selling price
                </p>
                <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {money(product.basePrice)}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  per {product.unit.name.toLowerCase()}
                </p>
              </div>
              {showCost && (
                <>
                  <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Inventory value
                    </p>
                    <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {inventoryValue > 0 || uncostedUnits === 0 ? money(inventoryValue) : '—'}
                    </p>
                    {uncostedUnits > 0 && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-status-warn)' }}>
                        {fmtNumber(uncostedUnits)} {product.unit.symbol} with no cost on record
                      </p>
                    )}
                  </div>
                  <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                      Last cost
                    </p>
                    <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                      {lastCost > 0 ? money(lastCost) : '—'}
                    </p>
                    {margin !== null && (
                      <p className="mt-1 text-xs data-num" style={{ color: margin < 0 ? 'var(--color-status-bad)' : 'var(--color-ink-600)' }}>
                        {margin}% margin{margin < 0 ? ' · selling below cost' : ''}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {product.category && <Detail label="Category" value={product.category.name} />}
              {product.brand && <Detail label="Brand" value={product.brand.name} />}
              {size && <Detail label="Size" value={size} />}
              {product.material && <Detail label="Material" value={product.material} />}
              {product.family && <Detail label="Family" value={product.family.name} />}
              {product.spec && <Detail label="Spec" value={product.spec} />}
            </dl>

            {product.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Search aliases">
                {product.aliases.map((a) => (
                  <span key={a.id} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                    {a.term}
                  </span>
                ))}
              </div>
            )}

            <Tabs value={tab} onChange={setTab} />

            <div role="tabpanel" id={`product-panel-${tab}`} aria-labelledby={`product-tab-${tab}`} className="flex flex-col gap-2">
              {tab === 'batches' && (
                <>
                  {problems.batches && <SectionNote tone="warn">{problems.batches}</SectionNote>}
                  {!problems.batches && batches.length === 0 && <SectionNote>No inventory receipts yet for this product.</SectionNote>}
                  {batches.map((b) => {
                    const usedUp = b.remainingQuantity === 0;
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)', opacity: usedUp ? 0.6 : 1 }}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                            {b.receipt.supplier}
                            {b.receipt.reference ? ` · ${b.receipt.reference}` : ''}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                            Received {fmtDate(b.createdAt)}
                            {showCost ? (b.unitCost > 0 ? ` · ${money(b.unitCost)}/unit` : ' · no cost recorded') : ''}
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-sm font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                          {b.remainingQuantity} / {b.quantityReceived}
                          {usedUp && (
                            <span className="block text-xs font-normal" style={{ color: 'var(--color-ink-600)' }}>
                              used up
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                  {batches.length > 0 && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      Remaining / received, oldest batch first. Sales draw from the oldest batch (FIFO).
                    </p>
                  )}
                </>
              )}

              {tab === 'history' && (
                <>
                  {problems.history && <SectionNote tone="warn">{problems.history}</SectionNote>}
                  {!problems.history && history.length === 0 && <SectionNote>Price hasn’t changed since this product was created.</SectionNote>}
                  {history.map((h) => {
                    const pct = h.oldPrice > 0 ? Math.round(((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : null;
                    return (
                      <div key={h.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                        <div>
                          <p className="text-sm data-num" style={{ color: 'var(--color-ink-900)' }}>
                            {money(h.oldPrice)} <span style={{ color: 'var(--color-ink-600)' }}>→</span> {money(h.newPrice)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                            {fmtDate(h.changedAt)} · {h.changedBy.name}
                          </p>
                        </div>
                        {pct !== null && pct !== 0 && (
                          <span className="shrink-0 text-xs font-medium data-num" style={{ color: pct > 0 ? 'var(--color-status-ok)' : 'var(--color-status-bad)' }}>
                            {pct > 0 ? '+' : ''}
                            {pct}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {tab === 'ledger' && (
                <>
                  {problems.ledger && <SectionNote tone="warn">{problems.ledger}</SectionNote>}
                  {!problems.ledger && movements.length === 0 && <SectionNote>No stock movements recorded yet.</SectionNote>}
                  {movements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                          {MOVEMENT_LABEL[m.type] ?? m.type}
                          {m.note ? ` · ${m.note}` : ''}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                          {fmtDate(m.createdAt)} · {m.createdBy.name}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium data-num" style={{ color: m.quantity >= 0 ? 'var(--color-status-ok)' : 'var(--color-status-bad)' }}>
                        {m.quantity >= 0 ? '+' : ''}
                        {m.quantity}
                      </p>
                    </div>
                  ))}
                  {movements.length >= 200 && (
                    <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      Showing the latest 200 movements.
                    </p>
                  )}
                  {totalRemaining !== product.stockQuantity && batches.length > 0 && (
                    <p className="text-xs" style={{ color: 'var(--color-status-warn)' }}>
                      Batch total ({totalRemaining}) differs from recorded stock ({product.stockQuantity}), likely a stock change made outside the batches.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {adjustOpen && product && (
        <AdjustStockDialog
          product={product}
          onClose={() => setAdjustOpen(false)}
          onDone={() => {
            setAdjustOpen(false);
            // The drawer shows stock, value, batches and the ledger, all of which just changed.
            setReloadTick((t) => t + 1);
            onChanged();
          }}
        />
      )}

      {confirmArchive && product && (
        <ConfirmDialog
          title="Archive this product?"
          description={`${product.displayName ?? product.name} will drop out of the catalogue and POS search. Past documents and price history are unaffected, and it can be restored any time.`}
          confirmLabel="Archive"
          busy={archiving}
          onCancel={() => setConfirmArchive(false)}
          onConfirm={archive}
        />
      )}

      {confirmHardDelete && product && (
        <ConfirmDialog
          title="Delete this product forever?"
          description={`${product.displayName ?? product.name} will be permanently removed. This cannot be undone. It only succeeds if the product has no sales, stock, or price history; if it does, delete will be refused and you’ll see why.`}
          confirmLabel="Delete permanently"
          busy={deletingForever}
          onCancel={() => setConfirmHardDelete(false)}
          onConfirm={hardDelete}
        />
      )}
    </>
  );
}
