'use client';

import { useEffect, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { productsApi, type Brand, type Category, type Product, type ProductFamily, type Unit } from '../../../lib/products-api';
import { thicknessLabel } from '../../../lib/shape-config';
import { ProductFormDrawer } from '../../../components/products/ProductFormDrawer';
import { ProductDetailDrawer } from '../../../components/products/ProductDetailDrawer';

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

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function loadLookups() {
    const [b, c, u] = await Promise.all([productsApi.brands(), productsApi.categories(), productsApi.units()]);
    setBrands(b);
    setCategories(c);
    setUnits(u);
  }

  async function loadProducts() {
    const list = await productsApi.list({ search: search || undefined, brandId: brandId || undefined, categoryId: categoryId || undefined });
    setProducts(list);
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, brandId, categoryId]);

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

      <div className="mt-5 flex flex-wrap gap-2">
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
            </tr>
          </thead>
          <tbody>
            {products === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {products?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Package size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No products match your search
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Try a different term, or add this product to the catalogue.
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
                    KSh {p.basePrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {p.stockQuantity} {p.unit.symbol}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.stockStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile: stacked cards instead of a squeezed table (brief §63) */}
        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
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
                No products match your search
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                Try a different term, or add this product to the catalogue.
              </p>
            </div>
          )}

          {products?.map((p) => {
            const gauge = thicknessLabel(p.shape, p.thicknessMm);
            return (
              <button key={p.id} type="button" onClick={() => setDetailId(p.id)} className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
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
                    KSh {p.basePrice.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-600)' }}>
                    {[p.nominalSize, gauge].filter(Boolean).join(' · ') || '—'} · {p.stockQuantity} {p.unit.symbol}
                  </span>
                  <StatusBadge status={p.stockStatus} />
                </div>
              </button>
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
          setBrands((prev) => [...prev, b]);
        }}
        onCreateCategory={async (name) => {
          const c = await productsApi.createCategory(name);
          setCategories((prev) => [...prev, c]);
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
    </div>
  );
}