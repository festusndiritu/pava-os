'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, PackagePlus, Search } from 'lucide-react';
import { productsApi, type Category, type Product } from '../../lib/products-api';
import { settingsApi } from '../../lib/settings-api';
import { ProductIcon } from '../pos/ProductIcon';
import { AdjustStockDialog } from './AdjustStockDialog';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function stockTone(qty: number, threshold: number): { label: string; bg: string; fg: string } {
  if (qty <= 0) return { label: 'Out of stock', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' };
  if (qty <= threshold) return { label: 'Low stock', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' };
  return { label: 'In stock', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' };
}

/**
 * What "Inventory" was missing: a live view of what's actually on the shelf.
 * The receipts log records what came in; this is what there is right now,
 * with the same low-stock threshold the dashboard uses, and the one place
 * (shared with Products) to correct a count.
 */
export function StockLevelsTable({ onOpenProduct }: { onOpenProduct: (id: string) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  async function load() {
    const list = await productsApi.list({ search: search || undefined, categoryId: categoryId || undefined });
    setProducts(list);
  }

  useEffect(() => {
    productsApi.categories().then(setCategories);
    settingsApi.get().then((s) => setThreshold(s.lowStockThreshold));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId]);

  const sorted = [...(products ?? [])].sort((a, b) => a.stockQuantity - threshold - (b.stockQuantity - threshold));
  const visible = sorted.filter((p) => !lowOnly || p.stockQuantity <= threshold);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={inputStyle}
          />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          className="flex min-h-[38px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
          style={{
            borderColor: lowOnly ? 'var(--color-status-warn)' : 'var(--color-border)',
            backgroundColor: lowOnly ? 'var(--color-status-warnSoft)' : 'transparent',
            color: lowOnly ? 'var(--color-status-warn)' : 'var(--color-ink-600)',
          }}
        >
          <AlertTriangle size={14} strokeWidth={2} />
          Low stock only
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Product</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>On hand</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Status</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {products !== null && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {lowOnly ? 'Nothing is running low' : 'No products match'}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    {lowOnly ? 'Every product is above the reorder threshold.' : 'Try a different search or category.'}
                  </p>
                </td>
              </tr>
            )}

            {visible.map((p) => {
              const tone = stockTone(p.stockQuantity, threshold);
              return (
                <tr key={p.id} onClick={() => onOpenProduct(p.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProductIcon product={p} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>{p.displayName ?? p.name}</p>
                        {p.category && (
                          <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{p.category.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {p.stockQuantity} {p.unit.symbol}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
                      {tone.label}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Adjust stock"
                        aria-label="Adjust stock"
                        onClick={() => setAdjusting(p)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
                      >
                        <PackagePlus size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {products === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {products !== null && visible.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {lowOnly ? 'Nothing is running low' : 'No products match'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {lowOnly ? 'Every product is above the reorder threshold.' : 'Try a different search or category.'}
              </p>
            </div>
          )}

          {visible.map((p) => {
            const tone = stockTone(p.stockQuantity, threshold);
            return (
              <div key={p.id} onClick={() => onOpenProduct(p.id)} className="flex w-full flex-col gap-2 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-center gap-2.5">
                  <ProductIcon product={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>{p.displayName ?? p.name}</p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{p.category?.name ?? '—'}</p>
                  </div>
                  <p className="shrink-0 data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {p.stockQuantity} {p.unit.symbol}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
                    {tone.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdjusting(p);
                    }}
                    className="flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    <PackagePlus size={13} strokeWidth={2} />
                    Adjust
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            load();
          }}
        />
      )}
    </div>
  );
}