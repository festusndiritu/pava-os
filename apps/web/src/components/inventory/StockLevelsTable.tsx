'use client';

import { useEffect, useState } from 'react';
import { PackagePlus, Search, TruckIcon, X } from 'lucide-react';
import { productsApi, type Category, type Product, type ProductSort, type StockFilter } from '../../lib/products-api';
import { ProductIcon } from '../pos/ProductIcon';
import { AdjustStockDialog } from './AdjustStockDialog';
import { StockBadge } from './StockBadge';
import { ListFooter } from '../ui/ListFooter';
import { activateOnKey } from '../../lib/a11y';
import { useAuth } from '../../lib/auth-context';
import { fmtNumber } from '../../lib/format';
import { availability, stockLevel, useLowStockThreshold } from '../../lib/stock';
import { usePagedList, useDebounced } from '../../lib/use-paged-list';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

export const STOCK_VIEWS: { value: StockFilter | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'restock', label: 'Needs restock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'in', label: 'In stock' },
];

// '' is the default: lowest stock first when browsing, best match first when searching.
const SORTS: { value: ProductSort | ''; label: string }[] = [
  { value: '', label: 'Lowest stock first' },
  { value: 'stock_desc', label: 'Highest stock first' },
  { value: 'name', label: 'Name A–Z' },
];

/**
 * What is actually on the shelf right now. The receipts log records what came
 * in; this is what there is, filtered and paged on the server like the
 * catalogue (a yard with thousands of SKUs shouldn't download them all to find
 * the ten that are about to run out), with the same low-stock threshold the
 * dashboard uses. Each row can correct a count or start a restock.
 */
export function StockLevelsTable({
  onOpenProduct,
  onReceive,
  stock,
  onStockChange,
  refreshKey = 0,
  onChanged,
}: {
  onOpenProduct: (id: string) => void;
  /** Starts a receipt with this product on it. Omit if the person can't receive stock. */
  onReceive?: (p: Product) => void;
  stock: StockFilter | '';
  onStockChange: (next: StockFilter | '') => void;
  /** Bump to refresh the rows on screen after stock changed elsewhere. */
  refreshKey?: number;
  /** Called after a count is corrected here, so the page's summary can refresh too. */
  onChanged?: () => void;
}) {
  const { canViewCost } = useAuth();
  const showCost = canViewCost();
  const threshold = useLowStockThreshold();

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<ProductSort | ''>('');
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  useEffect(() => {
    productsApi.categories().then(setCategories).catch(() => {});
  }, []);

  const debouncedSearch = useDebounced(search);
  const {
    items: products,
    hasMore,
    loadingMore,
    error: listError,
    loadMore,
    reload,
  } = usePagedList(
    (offset, limit) =>
      productsApi.list({
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        stock: stock || undefined,
        sort: sort || (debouncedSearch ? undefined : 'stock_asc'),
        status: 'active',
        offset,
        limit,
      }),
    [debouncedSearch, categoryId, stock, sort],
  );

  useEffect(() => {
    if (refreshKey > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtersActive = !!(search || categoryId || stock || sort);
  function clearFilters() {
    setSearch('');
    setCategoryId('');
    onStockChange('');
    setSort('');
  }

  const cols = showCost ? 6 : 5;

  const emptyState = (
    <>
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {stock === 'restock' && !search && !categoryId ? 'Nothing is running low' : stock === 'out' && !search && !categoryId ? 'Nothing is out of stock' : 'No products match'}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {stock === 'restock' && !search && !categoryId ? 'Every product is above the reorder threshold.' : filtersActive ? 'Try a different search, or clear the filters.' : 'Add products in the Products screen.'}
      </p>
      {filtersActive && (
        <button type="button" onClick={clearFilters} className="mt-3 min-h-10 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Clear filters
        </button>
      )}
    </>
  );

  const rowActions = (p: Product) => (
    <>
      {onReceive && (
        <button
          type="button"
          title="Receive stock"
          aria-label={`Receive stock for ${p.displayName ?? p.name}`}
          onClick={() => onReceive(p)}
          className="flex h-9 w-9 items-center justify-center rounded-md border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
        >
          <TruckIcon size={15} strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        title="Adjust stock"
        aria-label={`Adjust stock for ${p.displayName ?? p.name}`}
        onClick={() => setAdjusting(p)}
        className="flex h-9 w-9 items-center justify-center rounded-md border"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
      >
        <PackagePlus size={15} strokeWidth={2} />
      </button>
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            type="search"
            aria-label="Search stock"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
            style={inputStyle}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category" className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as ProductSort | '')} aria-label="Sort stock" className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by stock level">
        {STOCK_VIEWS.map((c) => (
          <button
            key={c.value || 'all'}
            type="button"
            aria-pressed={stock === c.value}
            onClick={() => onStockChange(c.value)}
            className="min-h-8 rounded-full border px-3 text-xs font-medium"
            style={{
              borderColor: stock === c.value ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: stock === c.value ? 'var(--color-accent-soft)' : 'transparent',
              color: stock === c.value ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            {c.label}
          </button>
        ))}
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="ml-1 flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
            <X size={13} strokeWidth={2} />
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs" style={{ color: 'var(--color-ink-600)' }} aria-live="polite">
          {threshold !== null && `Low at ${fmtNumber(threshold)} or fewer`}
          {products && products.length > 0 && ` · Showing ${products.length}${hasMore ? '+' : ''}`}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Product</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>On hand</th>
              {showCost && (
                <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Last cost</th>
              )}
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={cols - 1}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {products?.length === 0 && (
              <tr>
                <td colSpan={cols - 1} className="px-4 py-12 text-center">
                  {emptyState}
                </td>
              </tr>
            )}

            {products?.map((p) => {
              const level = availability(p, threshold ?? 0);
              const lvl = stockLevel(p.stockQuantity, threshold ?? 0);
              return (
                <tr key={p.id} onClick={() => onOpenProduct(p.id)} onKeyDown={activateOnKey(() => onOpenProduct(p.id))} tabIndex={0} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)] focus-visible:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProductIcon product={p} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>{p.displayName ?? p.name}</p>
                        {p.category && <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{p.category.name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right data-num font-medium" style={{ color: lvl === 'out' ? 'var(--color-status-bad)' : lvl === 'low' ? 'var(--color-status-warn)' : 'var(--color-ink-900)' }}>
                    {fmtNumber(p.stockQuantity)} {p.unit.symbol}
                  </td>
                  {showCost && (
                    <td className="px-4 py-3 text-right data-num" style={{ color: 'var(--color-ink-600)' }}>
                      {p.lastCost ? `KSh ${fmtNumber(p.lastCost)}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <StockBadge level={level} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {rowActions(p)}
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

          {products?.length === 0 && <div className="px-4 py-12 text-center">{emptyState}</div>}

          {products?.map((p) => {
            const level = availability(p, threshold ?? 0);
            return (
              <div key={p.id} onClick={() => onOpenProduct(p.id)} onKeyDown={activateOnKey(() => onOpenProduct(p.id))} tabIndex={0} role="button" className="flex w-full flex-col gap-2 p-4 text-left active:bg-[var(--color-bg)]">
                <div className="flex items-center gap-2.5">
                  <ProductIcon product={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>{p.displayName ?? p.name}</p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{p.category?.name ?? '—'}</p>
                  </div>
                  <p className="shrink-0 data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {fmtNumber(p.stockQuantity)} {p.unit.symbol}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <StockBadge level={level} />
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onReceive && (
                      <button type="button" onClick={() => onReceive(p)} className="flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                        <TruckIcon size={13} strokeWidth={2} />
                        Receive
                      </button>
                    )}
                    <button type="button" onClick={() => setAdjusting(p)} className="flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                      <PackagePlus size={13} strokeWidth={2} />
                      Adjust
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <ListFooter hasMore={hasMore} loadingMore={loadingMore} error={listError} onMore={loadMore} onRetry={reload} />
      </div>

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            void reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
