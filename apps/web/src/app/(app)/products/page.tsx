'use client';

import { useEffect, useState } from 'react';
import { Archive, Copy, Download, Eye, Package, PackagePlus, Pencil, Plus, RotateCcw, Search, Truck, X } from 'lucide-react';
import { productsApi, type Brand, type CatalogueStatus, type Category, type Product, type ProductFamily, type StockFilter, type Unit } from '../../../lib/products-api';
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
import { downloadCsv } from '../../../lib/csv';
import { availability, stockLevel, useLowStockThreshold } from '../../../lib/stock';
import { useDebounced } from '../../../lib/use-debounced';
import { useRowSelection, useServerTable } from '../../../lib/use-data-table';
import { bulkSummary, runBulk } from '../../../lib/bulk';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Select } from '../../../components/ui/inputs';
import type { RowAction } from '../../../components/ui/ActionMenu';
import { toast } from '../../../components/ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

const STOCK_CHIPS: { value: StockFilter | ''; label: string }[] = [
  { value: '', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out' },
];

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
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [receiving, setReceiving] = useState<Product | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Product | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<'archive' | 'restore' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [receivingMany, setReceivingMany] = useState<Product[] | null>(null);

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
    status,
  } as const;

  const table = useServerTable<Product>({
    // While searching, the server ranks by relevance; that only changes once a column header is clicked.
    fetcher: async (q) => productsApi.listPage({ ...filters, sort: q.sortIsDefault && debouncedSearch ? undefined : q.sort, offset: q.offset, limit: q.limit }),
    deps: [debouncedSearch, brandId, categoryId, stock, status],
    defaultSort: { id: 'name', dir: 'asc' },
  });
  const { rows: products, reload: loadProducts } = table;

  // Ticked rows are forgotten when the filters change: a selection should never quietly include rows that are no longer on screen.
  const selection = useRowSelection<Product>((p) => p.id, [debouncedSearch, brandId, categoryId, stock, status]);

  const filtersActive = !!(search || brandId || categoryId || stock);
  function clearFilters() {
    setSearch('');
    setBrandId('');
    setCategoryId('');
    setStock('');
  }

  async function archiveProduct(p: Product) {
    setArchiveBusy(true);
    try {
      await productsApi.archive(p.id);
      setConfirmArchive(null);
      toast.success('Product archived');
      loadProducts();
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
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this product.');
    }
  }

  // Everything the current filters match, not just the pages loaded so far:
  // the point is a stocktake sheet or a price list that is actually complete.
  function exportRows(rows: Product[], name: string) {
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
    downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
    toast.success(`Exported ${rows.length} product${rows.length === 1 ? '' : 's'}`);
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      exportRows(await productsApi.list(filters), 'products');
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

  const productName = (p: Product) => p.displayName ?? p.name;

  const columns: Column<Product>[] = [
    {
      id: 'name',
      header: 'Product',
      sortable: true,
      cell: (p) => {
        const sub = [p.displayName ? p.name : null, p.brand?.name].filter(Boolean).join(' · ');
        return (
          <>
            <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {productName(p)}
            </p>
            {sub && (
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {sub}
              </p>
            )}
          </>
        );
      },
    },
    { id: 'category', header: 'Category', sortable: true, hideBelow: 'lg', cell: (p) => <span style={{ color: 'var(--color-ink-600)' }}>{p.category?.name ?? '—'}</span> },
    {
      id: 'size',
      label: 'Size',
      header: 'Gauge / thickness',
      cell: (p) => <span style={{ color: 'var(--color-ink-600)' }}>{[p.nominalSize, thicknessLabel(p.shape, p.thicknessMm)].filter(Boolean).join(' · ') || '—'}</span>,
    },
    { id: 'price', header: 'Price', sortable: true, align: 'right', cell: (p) => <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>KSh {fmtNumber(p.basePrice)}</span> },
    { id: 'stock', header: 'Stock', sortable: true, align: 'right', cell: stockText },
    ...(showCost
      ? [
          {
            id: 'cost',
            header: 'Last cost',
            sortable: true,
            align: 'right' as const,
            hideBelow: 'xl' as const,
            cell: (p: Product) => <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>{p.lastCost ? `KSh ${fmtNumber(p.lastCost)}` : '—'}</span>,
          },
        ]
      : []),
    { id: 'status', header: 'Status', cell: (p) => <StockBadge level={availability(p, threshold ?? 0)} /> },
  ];

  function renderCard(p: Product) {
    const sub = [p.displayName ? p.name : null, p.category?.name, p.brand?.name].filter(Boolean).join(' · ');
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {productName(p)}
            </p>
            {sub && (
              <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {sub}
              </p>
            )}
          </div>
          <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
            KSh {fmtNumber(p.basePrice)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span style={{ color: 'var(--color-ink-600)' }}>
            {[p.nominalSize, thicknessLabel(p.shape, p.thicknessMm)].filter(Boolean).join(' · ') || '—'} · {stockText(p)}
          </span>
          <StockBadge level={availability(p, threshold ?? 0)} />
        </div>
      </div>
    );
  }

  const actions = (p: Product): (RowAction | false)[] => [
    { label: 'View details', icon: Eye, onClick: () => setDetailId(p.id) },
    isAdmin && { label: 'Edit product', icon: Pencil, onClick: () => openEdit(p) },
    isAdmin && { label: 'Duplicate', icon: Copy, onClick: () => openCreate(p) },
    canAdjust && { label: 'Adjust stock', icon: PackagePlus, onClick: () => setAdjusting(p) },
    canAdjust && { label: 'Receive stock', icon: Truck, onClick: () => setReceiving(p) },
    isAdmin && (p.active ? { label: 'Archive', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => setConfirmArchive(p) } : { label: 'Restore', icon: RotateCcw, tone: 'accent', separatorBefore: true, onClick: () => restoreProduct(p) }),
  ];

  async function runBulkArchive(action: 'archive' | 'restore') {
    const targets = selection.items;
    setBulkBusy(true);
    setError(null);
    try {
      const result = await runBulk(targets, (p) => (action === 'archive' ? productsApi.archive(p.id) : productsApi.restore(p.id)));
      const text = bulkSummary(action === 'archive' ? 'Archived' : 'Restored', 'product', result);
      if (result.failed.length === 0) toast.success(text);
      else setError(text);
      // Whatever failed stays ticked, so it can be tried again.
      selection.replace(result.failed.map((f) => f.item));
      setBulkConfirm(null);
      loadProducts();
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkActions = (
    <>
      <button type="button" onClick={() => exportRows(selection.items, 'products-selected')} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}>
        <Download size={14} strokeWidth={2} />
        Export selected
      </button>
      {canAdjust && (
        <button type="button" onClick={() => setReceivingMany(selection.items)} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}>
          <Truck size={14} strokeWidth={2} />
          Receive stock
        </button>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setBulkConfirm(status === 'active' ? 'archive' : 'restore')}
          className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
          style={{ borderColor: 'var(--color-border)', color: status === 'active' ? 'var(--color-status-bad)' : 'var(--color-accent)', backgroundColor: 'var(--color-surface)' }}
        >
          {status === 'active' ? <Archive size={14} strokeWidth={2} /> : <RotateCcw size={14} strokeWidth={2} />}
          {status === 'active' ? 'Archive selected' : 'Restore selected'}
        </button>
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
            disabled={exporting || !products || products.length === 0}
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
        <Select inline aria-label="Filter by brand" value={brandId} onChange={setBrandId} options={[{ value: '', label: 'All brands' }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} style={inputStyle} />
        <Select inline aria-label="Filter by category" value={categoryId} onChange={setCategoryId} options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} style={inputStyle} />
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
      </div>

      <div className="mt-5">
        <DataTable<Product>
          {...table.tableProps}
          caption="Products"
          columns={columns}
          rowKey={(p) => p.id}
          rowLabel={productName}
          onRowClick={(p) => setDetailId(p.id)}
          actions={actions}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={() => productsApi.list(filters)}
          bulkActions={bulkActions}
          empty={emptyState}
        />
      </div>

      <ProductFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => loadProducts()}
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
        onChanged={() => loadProducts()}
      />

      <ReceiveInventoryDrawer
        open={!!receiving || !!receivingMany}
        initialProducts={receivingMany ?? (receiving ? [receiving] : null)}
        onClose={() => {
          setReceiving(null);
          setReceivingMany(null);
        }}
        onDone={() => {
          setReceiving(null);
          setReceivingMany(null);
          selection.clear();
          setDetailRefresh((k) => k + 1);
          loadProducts();
        }}
      />

      {bulkConfirm && (
        <ConfirmDialog
          title={bulkConfirm === 'archive' ? `Archive ${selection.count} product${selection.count === 1 ? '' : 's'}?` : `Restore ${selection.count} product${selection.count === 1 ? '' : 's'}?`}
          description={
            bulkConfirm === 'archive'
              ? 'They will drop out of the catalogue and POS search. Past documents and price history are unaffected, and they can be restored any time.'
              : 'They will return to the catalogue and POS search.'
          }
          confirmLabel={bulkConfirm === 'archive' ? 'Archive' : 'Restore'}
          busy={bulkBusy}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => runBulkArchive(bulkConfirm)}
        />
      )}

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            setDetailRefresh((k) => k + 1);
            loadProducts();
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
