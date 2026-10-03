'use client';

import { useEffect, useState } from 'react';
import { Archive, Copy, Download, Eye, Package, PackagePlus, Pencil, Plus, RotateCcw, Search, X } from 'lucide-react';
import { productsApi, type Brand, type CatalogueStatus, type Category, type Product, type ProductFamily, type ProductSort, type StockFilter, type Unit } from '../../../lib/products-api';
import { AdjustStockDialog } from '../../../components/inventory/AdjustStockDialog';
import { ReceiveInventoryDrawer } from '../../../components/inventory/ReceiveInventoryDrawer';
import { StockBadge } from '../../../components/inventory/StockBadge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { thicknessLabel } from '../../../lib/shape-config';
import { ProductFormDrawer } from '../../../components/products/ProductFormDrawer';
import { ProductDetailDrawer } from '../../../components/products/ProductDetailDrawer';
import { fmtNumber } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';
import { downloadCsv } from '../../../lib/csv';
import { availability, stockLevel, useLowStockThreshold } from '../../../lib/stock';
import { usePagedList, useDebounced } from '../../../lib/use-paged-list';
import { ListFooter } from '../../../components/ui/ListFooter';
import { toast } from '../../../components/ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

const STOCK_CHIPS: { value: StockFilter | ''; label: string }[] = [
  { value: '', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out' },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'stock_asc', label: 'Stock: low to high' },
  { value: 'stock_desc', label: 'Stock: high to low' },
];

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-md border';
const iconButtonStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' };

export default function ProductsPage() {
  const { user, hasPermission, canViewCost } = useAuth();
  // The API lets only admins create, edit, archive and restore products, so
  // anyone else would just get a refusal. Hide what they can't do.
  const isAdmin = user?.role === 'ADMIN';
  const canAdjust = hasPermission('INVENTORY');
  const showCost = canViewCost();
  const threshold = useLowStockThreshold();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [families, setFamilies] = useState<ProductFamily[]>([]);

  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<CatalogueStatus>('active');
  const [stock, setStock] = useState<StockFilter | ''>('');
  const [sort, setSort] = useState<ProductSort>('name');
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [receiving, setReceiving] = useState<Product | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Product | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Product | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);

  function openCreate(from: Product | null = null) {
    setEditingProduct(null);
    setDuplicateFrom(from);
    setFormOpen(true);
  }
  function openEdit(p: Product) {
    setDuplicateFrom(null);
    setEditingProduct(p);
    setFormOpen(true);
  }

  // Deep links: global search lands on a product's detail drawer via
  // `/products?open=<id>`, and "Edit" from the Inventory page via
  // `/products?edit=<id>`. Both are consumed once and removed from the URL so a
  // refresh doesn't reopen them.
  useEffect(() => {
    if (!user) return; // wait: whether ?edit= applies depends on who is signed in
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    const editId = params.get('edit');
    if (!openId && !editId) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (openId) setDetailId(openId);
    if (editId && isAdmin) {
      productsApi
        .get(editId)
        .then(openEdit)
        .catch(() => setError('Could not open that product for editing.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadLookups() {
    const [b, c, u, f] = await Promise.all([productsApi.brands(), productsApi.categories(), productsApi.units(), productsApi.families()]);
    setBrands(b);
    setCategories(c);
    setUnits(u);
    setFamilies(f);
  }

  useEffect(() => {
    loadLookups().catch(() => setError('Could not load brands, categories and units.'));
  }, []);

  const debouncedSearch = useDebounced(search);
  const filters = {
    search: debouncedSearch || undefined,
    brandId: brandId || undefined,
    categoryId: categoryId || undefined,
    stock: stock || undefined,
    // With a search term the server ranks by relevance; only send a sort
    // when the user picked something other than the default.
    sort: sort === 'name' ? undefined : sort,
    status,
  } as const;

  const {
    items: products,
    hasMore,
    loadingMore,
    error: listError,
    loadMore,
    reload: loadProducts,
  } = usePagedList((offset, limit) => productsApi.list({ ...filters, offset, limit }), [debouncedSearch, brandId, categoryId, stock, sort, status]);

  const filtersActive = !!(search || brandId || categoryId || stock || sort !== 'name');
  function clearFilters() {
    setSearch('');
    setBrandId('');
    setCategoryId('');
    setStock('');
    setSort('name');
  }

  async function archiveProduct(p: Product) {
    setArchiveBusy(true);
    try {
      await productsApi.archive(p.id);
      setConfirmArchive(null);
      toast.success('Product archived');
      void loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not archive this product.');
      setConfirmArchive(null);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function restoreProduct(p: Product) {
    setError(null);
    try {
      await productsApi.restore(p.id);
      toast.success('Product restored');
      void loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this product.');
    }
  }

  // Everything the current filters match, not just the pages loaded so far:
  // the point is a stocktake sheet or a price list that is actually complete.
  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const rows = await productsApi.list(filters);
      const head = ['Product', 'Display name', 'Category', 'Brand', 'Size', 'Unit', 'Selling price (KSh)', 'In stock', 'Status', ...(showCost ? ['Last cost (KSh)', 'Value at last cost (KSh)'] : [])];
      const body = rows.map((p) => [
        p.name,
        p.displayName,
        p.category?.name,
        p.brand?.name,
        [p.nominalSize, thicknessLabel(p.shape, p.thicknessMm)].filter(Boolean).join(' · '),
        p.unit.symbol,
        p.basePrice,
        p.stockQuantity,
        p.active ? availabilityLabel(p, threshold ?? 0) : 'Archived',
        ...(showCost ? [p.lastCost ?? '', p.lastCost ? p.lastCost * p.stockQuantity : ''] : []),
      ]);
      downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
      toast.success(`Exported ${rows.length} product${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export products.');
    } finally {
      setExporting(false);
    }
  }

  function stockText(p: Product) {
    const tone = threshold === null ? 'in' : stockLevel(p.stockQuantity, threshold);
    return (
      <span className="data-num" style={{ color: tone === 'out' ? 'var(--color-status-bad)' : tone === 'low' ? 'var(--color-status-warn)' : 'var(--color-ink-900)', fontWeight: tone === 'in' ? 400 : 600 }}>
        {fmtNumber(p.stockQuantity)} {p.unit.symbol}
      </span>
    );
  }

  const emptyState = (
    <>
      <Package size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {status === 'archived' && !filtersActive ? 'No archived products' : filtersActive ? 'No products match your filters' : 'No products yet'}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {filtersActive ? 'Try a different term, or clear the filters.' : status === 'archived' ? 'Products you archive will show up here.' : isAdmin ? 'Add your first product to the catalogue.' : 'Nothing has been added to the catalogue yet.'}
      </p>
      {filtersActive ? (
        <button type="button" onClick={clearFilters} className="mt-3 min-h-10 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Clear filters
        </button>
      ) : (
        isAdmin &&
        status === 'active' && (
          <button type="button" onClick={() => openCreate()} className="mt-3 min-h-10 rounded-md px-3 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
            Add product
          </button>
        )
      )}
    </>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Products
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Search by trade terms, dimensions, or technical name.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || products?.length === 0}
            className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
          >
            <Download size={15} strokeWidth={2} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {isAdmin && (
            <button type="button" onClick={() => openCreate()} className="flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              <Plus size={15} strokeWidth={2} />
              Add product
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-1.5" role="group" aria-label="Catalogue status">
        {(['active', 'archived'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className="min-h-9 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: status === s ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: status === s ? 'var(--color-accent-soft)' : 'transparent',
              color: status === s ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            {s === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} role="alert" className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error} <span className="underline">Dismiss</span>
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            type="search"
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Try "1.5 inch square pipe" or "16 gauge"'
            className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
            style={inputStyle}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Filter by brand" className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category" className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as ProductSort)} aria-label="Sort products" className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by stock level">
        {STOCK_CHIPS.map((c) => (
          <button
            key={c.value || 'all'}
            type="button"
            aria-pressed={stock === c.value}
            onClick={() => setStock(c.value)}
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
        {products && products.length > 0 && (
          <span className="ml-auto text-xs" aria-live="polite" style={{ color: 'var(--color-ink-600)' }}>
            Showing {products.length}
            {hasMore ? '+' : ''}
          </span>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet: full comparison table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Product
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Gauge / thickness
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Price
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Stock
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {products?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  {emptyState}
                </td>
              </tr>
            )}

            {products?.map((p) => {
              const gauge = thicknessLabel(p.shape, p.thicknessMm);
              const sub = [p.category?.name, p.brand?.name].filter(Boolean).join(' · ');
              return (
                <tr
                  key={p.id}
                  onClick={() => setDetailId(p.id)}
                  onKeyDown={activateOnKey(() => setDetailId(p.id))}
                  tabIndex={0}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)] focus-visible:bg-[var(--color-bg)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    {(p.displayName || sub) && (
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {[p.displayName ? p.name : null, sub].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                    {[p.nominalSize, gauge].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {fmtNumber(p.basePrice)}
                  </td>
                  <td className="px-4 py-3 text-right">{stockText(p)}</td>
                  <td className="px-4 py-3">
                    <StockBadge level={availability(p, threshold ?? 0)} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="View" aria-label={`View ${p.displayName ?? p.name}`} onClick={() => setDetailId(p.id)} className={iconButton} style={iconButtonStyle}>
                        <Eye size={15} strokeWidth={2} />
                      </button>
                      {isAdmin && (
                        <button type="button" title="Edit product" aria-label={`Edit ${p.displayName ?? p.name}`} onClick={() => openEdit(p)} className={iconButton} style={iconButtonStyle}>
                          <Pencil size={15} strokeWidth={2} />
                        </button>
                      )}
                      {isAdmin && (
                        <button type="button" title="Duplicate product" aria-label={`Duplicate ${p.displayName ?? p.name}`} onClick={() => openCreate(p)} className={iconButton} style={iconButtonStyle}>
                          <Copy size={15} strokeWidth={2} />
                        </button>
                      )}
                      {canAdjust && (
                        <button type="button" title="Adjust stock" aria-label={`Adjust stock for ${p.displayName ?? p.name}`} onClick={() => setAdjusting(p)} className={iconButton} style={iconButtonStyle}>
                          <PackagePlus size={15} strokeWidth={2} />
                        </button>
                      )}
                      {isAdmin &&
                        (p.active ? (
                          <button type="button" title="Archive product" aria-label={`Archive ${p.displayName ?? p.name}`} onClick={() => setConfirmArchive(p)} className={iconButton} style={{ ...iconButtonStyle, color: 'var(--color-status-bad)' }}>
                            <Archive size={15} strokeWidth={2} />
                          </button>
                        ) : (
                          <button type="button" title="Restore product" aria-label={`Restore ${p.displayName ?? p.name}`} onClick={() => restoreProduct(p)} className={iconButton} style={{ ...iconButtonStyle, color: 'var(--color-accent)' }}>
                            <RotateCcw size={15} strokeWidth={2} />
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile: stacked cards instead of a squeezed table (brief §63) */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {products === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {products?.length === 0 && <div className="px-4 py-12 text-center">{emptyState}</div>}

          {products?.map((p) => {
            const gauge = thicknessLabel(p.shape, p.thicknessMm);
            const sub = [p.category?.name, p.brand?.name].filter(Boolean).join(' · ');
            return (
              <div key={p.id} onClick={() => setDetailId(p.id)} onKeyDown={activateOnKey(() => setDetailId(p.id))} tabIndex={0} role="button" className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    {(p.displayName || sub) && (
                      <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {[p.displayName ? p.name : null, sub].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {fmtNumber(p.basePrice)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>
                    {[p.nominalSize, gauge].filter(Boolean).join(' · ') || '—'} · {stockText(p)}
                  </span>
                  <StockBadge level={availability(p, threshold ?? 0)} />
                </div>
                {(isAdmin || canAdjust) && (
                  <div className="mt-1.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <button type="button" onClick={() => openEdit(p)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                        <Pencil size={13} strokeWidth={2} />
                        Edit
                      </button>
                    )}
                    {canAdjust && (
                      <button type="button" onClick={() => setAdjusting(p)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                        <PackagePlus size={13} strokeWidth={2} />
                        Stock
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={() => openCreate(p)} aria-label={`Duplicate ${p.displayName ?? p.name}`} title="Duplicate product" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border" style={iconButtonStyle}>
                        <Copy size={14} strokeWidth={2} />
                      </button>
                    )}
                    {isAdmin &&
                      (p.active ? (
                        <button type="button" onClick={() => setConfirmArchive(p)} aria-label={`Archive ${p.displayName ?? p.name}`} title="Archive product" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border" style={{ ...iconButtonStyle, color: 'var(--color-status-bad)' }}>
                          <Archive size={14} strokeWidth={2} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => restoreProduct(p)} aria-label={`Restore ${p.displayName ?? p.name}`} title="Restore product" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border" style={{ ...iconButtonStyle, color: 'var(--color-accent)' }}>
                          <RotateCcw size={14} strokeWidth={2} />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ListFooter hasMore={hasMore} loadingMore={loadingMore} error={listError} onMore={loadMore} onRetry={loadProducts} />
      </div>

      <ProductFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void loadProducts()}
        product={editingProduct}
        duplicateFrom={duplicateFrom}
        brands={brands}
        categories={categories}
        units={units}
        families={families}
        onCreateBrand={async (name) => {
          const b = await productsApi.createBrand(name);
          setBrands((prev) => [...prev, b].sort((x, y) => x.name.localeCompare(y.name)));
          return b;
        }}
        onCreateCategory={async (name) => {
          const c = await productsApi.createCategory(name);
          setCategories((prev) => [...prev, c].sort((x, y) => x.name.localeCompare(y.name)));
          return c;
        }}
      />

      <ProductDetailDrawer
        productId={detailId}
        refreshKey={detailRefresh}
        onClose={() => setDetailId(null)}
        onEdit={
          isAdmin
            ? (p) => {
                setDetailId(null);
                openEdit(p);
              }
            : undefined
        }
        onReceive={canAdjust ? (p) => setReceiving(p) : undefined}
        onChanged={() => void loadProducts()}
      />

      <ReceiveInventoryDrawer
        open={!!receiving}
        initialProduct={receiving}
        onClose={() => setReceiving(null)}
        onDone={() => {
          setReceiving(null);
          setDetailRefresh((k) => k + 1);
          void loadProducts();
        }}
      />

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            setDetailRefresh((k) => k + 1);
            void loadProducts();
          }}
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          title="Archive this product?"
          description={`${confirmArchive.displayName ?? confirmArchive.name} will drop out of the catalogue and POS search. Past documents and price history are unaffected, and it can be restored any time.`}
          confirmLabel="Archive"
          busy={archiveBusy}
          onCancel={() => setConfirmArchive(null)}
          onConfirm={() => archiveProduct(confirmArchive)}
        />
      )}
    </div>
  );
}

function availabilityLabel(p: Product, threshold: number) {
  const level = availability(p, threshold);
  return level === 'supplier' ? 'Supplier only' : level === 'out' ? 'Out of stock' : level === 'low' ? 'Low stock' : 'In stock';
}
