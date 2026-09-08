'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { productsApi, type Brand, type Category, type Product, type ProductFamily, type Unit } from '../../lib/products-api';
import { SHAPES, shapeConfig } from '../../lib/shape-config';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-5 pt-5 first:pt-0" style={{ borderColor: 'var(--color-border)' }}>
      <h3 className="mb-3 text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-900)', letterSpacing: '0.04em' }}>
        {title}
      </h3>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function AliasInput({ aliases, onChange }: { aliases: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const term = draft.trim();
    if (term && !aliases.includes(term)) onChange([...aliases, term]);
    setDraft('');
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {aliases.map((a) => (
          <span
            key={a}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
          >
            {a}
            <button type="button" onClick={() => onChange(aliases.filter((x) => x !== a))} aria-label={`Remove ${a}`}>
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="Type a search term and press Enter (e.g. square pipe, box section, 40x40)"
        className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        style={inputStyle}
      />
    </div>
  );
}

export function ProductFormDrawer({
  open,
  onClose,
  onSaved,
  product,
  brands,
  categories,
  units,
  families,
  onCreateBrand,
  onCreateCategory,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null; // null = creating
  brands: Brand[];
  categories: Category[];
  units: Unit[];
  families: ProductFamily[];
  onCreateBrand: (name: string) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
}) {
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [spec, setSpec] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [shape, setShape] = useState('');
  const [nominalSize, setNominalSize] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [thicknessMm, setThicknessMm] = useState<number | null>(null);
  const [material, setMaterial] = useState('STEEL');
  const [familyId, setFamilyId] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [basePrice, setBasePrice] = useState('');
  const [stockStatus, setStockStatus] = useState<'IN_STOCK' | 'SUPPLIER_ONLY' | 'OUT_OF_STOCK'>('IN_STOCK');
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setDisplayName(product.displayName ?? '');
      setSpec(product.spec ?? '');
      setBrandId(product.brandId ?? '');
      setCategoryId(product.categoryId ?? '');
      setUnitId(product.unitId);
      setShape(product.shape ?? '');
      setNominalSize(product.nominalSize ?? '');
      setWidthMm(product.widthMm != null ? String(product.widthMm) : '');
      setHeightMm(product.heightMm != null ? String(product.heightMm) : '');
      setThicknessMm(product.thicknessMm ?? null);
      setMaterial(product.material ?? 'STEEL');
      setFamilyId(product.familyId ?? '');
      setAliases(product.aliases.map((a) => a.term));
      setBasePrice(String(product.basePrice));
      setStockStatus(product.stockStatus);
      setActive(product.active);
    } else {
      setName('');
      setDisplayName('');
      setSpec('');
      setBrandId('');
      setCategoryId('');
      setUnitId(units[0]?.id ?? '');
      setShape('');
      setNominalSize('');
      setWidthMm('');
      setHeightMm('');
      setThicknessMm(null);
      setMaterial('STEEL');
      setFamilyId('');
      setAliases([]);
      setBasePrice('');
      setStockStatus('IN_STOCK');
      setActive(true);
    }
    setError(null);
  }, [open, product, units]);

  const cfg = shapeConfig(shape);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const gaugeOption = cfg?.thicknessOptions.find((o) => o.mm === thicknessMm);
      const payload = {
        name,
        displayName: displayName || undefined,
        spec: spec || undefined,
        brandId: brandId || undefined,
        categoryId: categoryId || undefined,
        unitId,
        basePrice: Number(basePrice),
        stockStatus,
        shape: shape || undefined,
        nominalSize: nominalSize || undefined,
        widthMm: widthMm ? Number(widthMm) : undefined,
        heightMm: heightMm ? Number(heightMm) : undefined,
        thicknessMm: thicknessMm ?? undefined,
        gauge: gaugeOption?.gauge,
        material: material || undefined,
        familyId: familyId || undefined,
        aliases,
        ...(isEdit ? { active } : {}),
      };
      if (isEdit && product) {
        await productsApi.update(product.id, payload);
      } else {
        await productsApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : 'Add product'}
      subtitle={isEdit ? product?.name : 'Technical identity, dimensions, and customer-facing details'}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit}>
        <Section title="Technical identity">
          <div>
            <label className={labelClass} style={labelStyle}>
              Technical name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. SHS 40x40x1.2mm'
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Spec / grade note
            </label>
            <input
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. Y12, 3mm x 6m"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Brand
              </label>
              {newBrandName === null ? (
                <div className="flex gap-1.5">
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setNewBrandName('')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                    <Plus size={15} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="New brand name"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (newBrandName.trim()) await onCreateBrand(newBrandName.trim());
                      setNewBrandName(null);
                    }}
                    className="shrink-0 rounded-md px-2.5 text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>
                Category
              </label>
              {newCategoryName === null ? (
                <div className="flex gap-1.5">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setNewCategoryName('')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                    <Plus size={15} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (newCategoryName.trim()) await onCreateCategory(newCategoryName.trim());
                      setNewCategoryName(null);
                    }}
                    className="shrink-0 rounded-md px-2.5 text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Unit
            </label>
            <select
              required
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            >
              <option value="" disabled>
                Select a unit
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Shape & dimensions">
          <div>
            <label className={labelClass} style={labelStyle}>
              Shape
            </label>
            <select
              value={shape}
              onChange={(e) => {
                setShape(e.target.value);
                setThicknessMm(null);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            >
              <option value="">—</option>
              {SHAPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Nominal size
            </label>
            <input
              value={nominalSize}
              onChange={(e) => setNominalSize(e.target.value)}
              placeholder='e.g. 1.5 inch, Y12, R8'
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>

          {cfg?.hasWidthHeight && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>
                  Width (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>
                  Height (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={heightMm}
                  onChange={(e) => setHeightMm(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {cfg && cfg.thicknessOptions.length > 0 && (
            <div>
              <label className={labelClass} style={labelStyle}>
                {cfg.thicknessMode === 'inch_fraction' ? 'Thickness (gauge)' : 'Thickness'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {cfg.thicknessOptions.map((opt) => {
                  const selected = thicknessMm === opt.mm;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setThicknessMm(opt.mm)}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                        backgroundColor: selected ? 'var(--color-accent-soft)' : 'var(--color-bg)',
                        color: selected ? 'var(--color-accent)' : 'var(--color-ink-900)',
                      }}
                    >
                      {opt.label}
                      {opt.gauge ? ` (${opt.gauge}G)` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass} style={labelStyle}>
              Material
            </label>
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>

          {families.length > 0 && (
            <div>
              <label className={labelClass} style={labelStyle}>
                Product family (optional)
              </label>
              <select
                value={familyId}
                onChange={(e) => setFamilyId(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                style={inputStyle}
              >
                <option value="">—</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Section>

        <Section title="Customer-facing">
          <div>
            <label className={labelClass} style={labelStyle}>
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='e.g. Square Pipe 1.5" — 16G'
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Search aliases
            </label>
            <AliasInput aliases={aliases} onChange={setAliases} />
          </div>
        </Section>

        <Section title="Commercial">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Base selling price (KSh)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num"
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Stock status
              </label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as typeof stockStatus)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                style={inputStyle}
              >
                <option value="IN_STOCK">In stock</option>
                <option value="SUPPLIER_ONLY">Supplier only</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
              </select>
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (visible in search and the POS)
            </label>
          )}
        </Section>
      </form>
    </Drawer>
  );
}