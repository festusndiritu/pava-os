'use client';

import { useEffect, useState } from 'react';
import { Archive, Eye, Package, PackagePlus, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { productsApi, type Brand, type CatalogueStatus, type Category, type Product, type ProductFamily, type Unit } from '../../../lib/products-api';
import { AdjustStockDialog } from '../../../components/inventory/AdjustStockDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ApiError } from '../../../lib/api';
import { thicknessLabel } from '../../../lib/shape-config';
import { ProductFormDrawer } from '../../../components/products/ProductFormDrawer';
import { ProductDetailDrawer } from '../../../components/products/ProductDetailDrawer';
import { fmtNumber } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function StatusBadge({ status }: { status: Product['stockStatus'] }) {
  const map = {
    IN_STOCK: { label: 'In stock', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
    SUPPLIER_ONLY: { label: 'Supplier only', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
    OUT_OF_STOCK: { label: 'Out of stock', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
  } as const;
  const s = map[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [families, setFamilies] = useState<ProductFamily[]>([]);

  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<CatalogueStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Product | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Lets global search (Ctrl/Cmd+K) land straight on a product's detail
  // drawer via `/products?open=<id>`, the same drawer a row click opens.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setDetailId(id);
  }, []);

  async function loadLookups() {
    const [b, c, u, f] = await Promise.all([productsApi.brands(), productsApi.categories(), productsApi.units(), productsApi.families()]);
    setBrands(b);
    setCategories(c);
    setUnits(u);
    setFamilies(f);
  }

  async function loadProducts() {
    const list = await productsApi.list({ search: search || undefined, brandId: brandId || undefined, categoryId: categoryId || undefined, status });
    setProducts(list);
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, brandId, categoryId, status]);

  async function archiveProduct(p: Product) {
    setArchiveBusy(true);
    try {
      await productsApi.archive(p.id);
      setConfirmArchive(null);
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
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this product.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Products
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Search by trade terms, dimensions, or technical name.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Add product
        </button>
      </div>

      <div className="mt-4 flex gap-1.5">
        {(['active', 'archived'] as const).map((s) => (
          <button
            key={s}
            type="button"
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
        <button type="button" onClick={() => setError(null)} className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Try "1.5 inch square pipe" or "16 gauge"'
            className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={inputStyle}
          />
        </div>
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-md border px-3 py-2 text-sm" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet: full comparison table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Product
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Gauge / thickness
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Price
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Stock
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Actions
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
                  <Package size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {status === 'archived' ? 'No archived products' : 'No products match your search'}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    {status === 'archived' ? 'Products you archive will show up here.' : 'Try a different term, or add this product to the catalogue.'}
                  </p>
                </td>
              </tr>
            )}

            {products?.map((p) => {
              const gauge = thicknessLabel(p.shape, p.thicknessMm);
              return (
                <tr
                  key={p.id}
                  onClick={() => setDetailId(p.id)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    {p.displayName && (
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {p.name}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                    {[p.nominalSize, gauge].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {fmtNumber(p.basePrice)}
                  </td>
                  <td className="px-4 py-3 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {p.stockQuantity} {p.unit.symbol}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.stockStatus} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="View" aria-label="View" onClick={() => setDetailId(p.id)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                        <Eye size={15} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        title="Edit product"
                        aria-label="Edit product"
                        onClick={() => {
                          setEditingProduct(p);
                          setFormOpen(true);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-md border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                      <button type="button" title="Adjust stock" aria-label="Adjust stock" onClick={() => setAdjusting(p)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                        <PackagePlus size={15} strokeWidth={2} />
                      </button>
                      {p.active ? (
                        <button type="button" title="Archive product" aria-label="Archive product" onClick={() => setConfirmArchive(p)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                          <Archive size={15} strokeWidth={2} />
                        </button>
                      ) : (
                        <button type="button" title="Restore product" aria-label="Restore product" onClick={() => restoreProduct(p)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                          <RotateCcw size={15} strokeWidth={2} />
                        </button>
                      )}
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

          {products?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Package size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {status === 'archived' ? 'No archived products' : 'No products match your search'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {status === 'archived' ? 'Products you archive will show up here.' : 'Try a different term, or add this product to the catalogue.'}
              </p>
            </div>
          )}

          {products?.map((p) => {
            const gauge = thicknessLabel(p.shape, p.thicknessMm);
            return (
              <div key={p.id} onClick={() => setDetailId(p.id)} onKeyDown={activateOnKey(() => setDetailId(p.id))} tabIndex={0} role="button" className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    {p.displayName && (
                      <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {p.name}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {fmtNumber(p.basePrice)}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>
                    {[p.nominalSize, gauge].filter(Boolean).join(' · ') || '—'} · {p.stockQuantity} {p.unit.symbol}
                  </span>
                  <StatusBadge status={p.stockStatus} />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(p);
                      setFormOpen(true);
                    }}
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    <Pencil size={13} strokeWidth={2} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjusting(p)}
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                  >
                    <PackagePlus size={13} strokeWidth={2} />
                    Stock
                  </button>
                  {p.active ? (
                    <button type="button" onClick={() => setConfirmArchive(p)} aria-label="Archive product" title="Archive product" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                      <Archive size={14} strokeWidth={2} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => restoreProduct(p)} aria-label="Restore product" title="Restore product" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                      <RotateCcw size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ProductFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={loadProducts}
        product={editingProduct}
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
        onClose={() => setDetailId(null)}
        onEdit={(p) => {
          setDetailId(null);
          setEditingProduct(p);
          setFormOpen(true);
        }}
        onChanged={loadProducts}
      />

      {adjusting && (
        <AdjustStockDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
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