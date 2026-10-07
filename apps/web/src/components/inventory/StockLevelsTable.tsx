'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, PackagePlus, Search, Truck, X } from 'lucide-react';
import { productsApi, type Category, type Product, type StockFilter } from '../../lib/products-api';
import { ProductIcon } from '../pos/ProductIcon';
import { AdjustStockDialog } from './AdjustStockDialog';
import { StockBadge } from './StockBadge';
import { DataTable, type Column } from '../ui/DataTable';
import type { RowAction } from '../ui/ActionMenu';
import { useAuth } from '../../lib/auth-context';
import { fmtNumber } from '../../lib/format';
import { availability, stockLevel, useLowStockThreshold } from '../../lib/stock';
import { useDebounced } from '../../lib/use-debounced';
import { useRowSelection, useServerTable } from '../../lib/use-data-table';
import { downloadCsv } from '../../lib/csv';
import { toast } from '../ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

export const STOCK_VIEWS: { value: StockFilter | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'restock', label: 'Needs restock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'in', label: 'In stock' },
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
  onReceiveMany,
  stock,
  onStockChange,
  refreshKey = 0,
  onChanged,
}: {
  onOpenProduct: (id: string) => void;
  /** Starts a receipt with this product on it. Omit if the person can't receive stock. */
  onReceive?: (p: Product) => void;
  /** Starts a receipt with several products on it (the ticked rows). */
  onReceiveMany?: (products: Product[]) => void;
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
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  useEffect(() => {
    productsApi.categories().then(setCategories).catch(() => {});
  }, []);

  const debouncedSearch = useDebounced(search);
  const filters = {
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    stock: stock || undefined,
    status: 'active',
  } as const;

  const table = useServerTable<Product>({
    // Lowest stock first is the default, so what needs ordering is at the top.
    // While searching, the server's relevance order wins until a header is clicked.
    fetcher: (q) => productsApi.listPage({ ...filters, sort: q.sortIsDefault && debouncedSearch ? undefined : q.sort, offset: q.offset, limit: q.limit }),
    deps: [debouncedSearch, categoryId, stock],
    defaultSort: { id: 'stock', dir: 'asc' },
  });
  const { reload } = table;
  const selection = useRowSelection<Product>((p) => p.id, [debouncedSearch, categoryId, stock]);

  useEffect(() => {
    if (refreshKey > 0) {
      reload();
      selection.clear(); // quantities just changed; ticked rows would be stale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtersActive = !!(search || categoryId || stock);
  function clearFilters() {
    setSearch('');
    setCategoryId('');
    onStockChange('');
  }

  const name = (p: Product) => p.displayName ?? p.name;

  const columns: Column<Product>[] = [
    {
      id: 'name',
      header: 'Product',
      sortable: true,
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <ProductIcon product={p} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {name(p)}
            </p>
            {p.category && (
              <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {p.category.name}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'stock',
      header: 'On hand',
      sortable: true,
      align: 'right',
      cell: (p) => {
        const lvl = stockLevel(p.stockQuantity, threshold ?? 0);
        return (
          <span className="data-num font-medium" style={{ color: lvl === 'out' ? 'var(--color-status-bad)' : lvl === 'low' ? 'var(--color-status-warn)' : 'var(--color-ink-900)' }}>
            {fmtNumber(p.stockQuantity)} {p.unit.symbol}
          </span>
        );
      },
    },
    ...(showCost
      ? [
          {
            id: 'cost',
            header: 'Last cost',
            sortable: true,
            align: 'right' as const,
            cell: (p: Product) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{p.lastCost ? `KSh ${fmtNumber(p.lastCost)}` : '—'}</span>,
          },
        ]
      : []),
    { id: 'status', header: 'Status', cell: (p) => <StockBadge level={availability(p, threshold ?? 0)} /> },
  ];

  // A count sheet: what the system thinks is on the shelf, with a blank column to write what is actually there.
  function exportSheet(rows: Product[]) {
    const head = ['Product', 'Category', 'Unit', 'On hand (system)', 'Counted', ...(showCost ? ['Last cost (KSh)'] : [])];
    const body = rows.map((p) => [name(p), p.category?.name, p.unit.symbol, p.stockQuantity, '', ...(showCost ? [p.lastCost ?? ''] : [])]);
    downloadCsv(`stock-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
    toast.success(`Exported ${rows.length} product${rows.length === 1 ? '' : 's'}`);
  }

  const actions = (p: Product): (RowAction | false)[] => [
    { label: 'View product', icon: Eye, onClick: () => onOpenProduct(p.id) },
    !!onReceive && { label: 'Receive stock', icon: Truck, onClick: () => onReceive(p) },
    { label: 'Adjust stock', icon: PackagePlus, onClick: () => setAdjusting(p) },
  ];

  const renderCard = (p: Product) => (
    <div className="flex items-center gap-2.5">
      <ProductIcon product={p} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {name(p)}
        </p>
        <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {p.category?.name ?? '—'}
        </p>
        <div className="mt-1">
          <StockBadge level={availability(p, threshold ?? 0)} />
        </div>
      </div>
      <p className="shrink-0 data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {fmtNumber(p.stockQuantity)} {p.unit.symbol}
      </p>
    </div>
  );

  const bulkActions = (
    <>
      <button type="button" onClick={() => exportSheet(selection.items)} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}>
        <Download size={14} strokeWidth={2} />
        Export count sheet
      </button>
      {onReceiveMany && (
        <button type="button" onClick={() => onReceiveMany(selection.items)} className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Truck size={14} strokeWidth={2} />
          Receive stock
        </button>
      )}
    </>
  );

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
        </span>
      </div>

      <div className="mt-4">
        <DataTable<Product>
          {...table.tableProps}
          caption="Stock levels"
          columns={columns}
          rowKey={(p) => p.id}
          rowLabel={name}
          onRowClick={(p) => onOpenProduct(p.id)}
          actions={actions}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={() => productsApi.list(filters)}
          bulkActions={bulkActions}
          empty={emptyState}
        />
      </div>

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
