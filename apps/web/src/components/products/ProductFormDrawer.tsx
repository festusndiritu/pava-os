'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { InlineAddSelect } from '../ui/InlineAddSelect';
import { inventoryApi, productsApi, type Brand, type Category, type Product, type ProductFamily, type Unit } from '../../lib/products-api';
import { SHAPES, shapeConfig } from '../../lib/shape-config';
import { ApiError } from '../../lib/api';
import { NumericInput, toNumber } from '../ui/inputs';
import { toast } from '../ui/Toast';
import { useAuth } from '../../lib/auth-context';
import { useDebounced } from '../../lib/use-paged-list';

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
  duplicateFrom,
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
  /** When creating, start from this product's details (name and aliases are left for the person to fill in). */
  duplicateFrom?: Product | null;
  brands: Brand[];
  categories: Category[];
  units: Unit[];
  families: ProductFamily[];
  onCreateBrand: (name: string) => Promise<Brand>;
  onCreateCategory: (name: string) => Promise<Category>;
}) {
  const isEdit = !!product;
  const { hasPermission } = useAuth();
  const canOpenStock = hasPermission('INVENTORY');

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
  const [openingQty, setOpeningQty] = useState('');
  const [openingCost, setOpeningCost] = useState('');
  const [sameName, setSameName] = useState<Product | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOpeningQty('');
    setOpeningCost('');
    const source = product ?? duplicateFrom ?? null;
    if (source) {
      // A copy keeps the shape of the original so a run of similar sizes is quick
      // to enter, but not its name or aliases: those identify one specific product.
      setName(product ? source.name : '');
      setDisplayName(product ? (source.displayName ?? '') : '');
      setSpec(source.spec ?? '');
      setBrandId(source.brandId ?? '');
      setCategoryId(source.categoryId ?? '');
      setUnitId(source.unitId);
      setShape(source.shape ?? '');
      setNominalSize(source.nominalSize ?? '');
      setWidthMm(source.widthMm != null ? String(source.widthMm) : '');
      setHeightMm(source.heightMm != null ? String(source.heightMm) : '');
      setThicknessMm(source.thicknessMm ?? null);
      setMaterial(source.material ?? 'STEEL');
      setFamilyId(source.familyId ?? '');
      setAliases(product ? source.aliases.map((a) => a.term) : []);
      setBasePrice(String(source.basePrice));
      setStockStatus(product ? source.stockStatus : 'IN_STOCK');
      setActive(product ? source.active : true);
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
  }, [open, product, duplicateFrom, units]);

  // Two products with the same technical name are almost always a double entry.
  // Not blocked (a genuine repeat is possible), just pointed out before saving.
  const debouncedName = useDebounced(name.trim());
  useEffect(() => {
    setSameName(null);
    if (!open || isEdit || debouncedName.length < 3) return;
    let stale = false;
    productsApi
      .list({ search: debouncedName, status: 'all', limit: 20 })
      .then((rows) => {
        if (!stale) setSameName(rows.find((r) => r.name.trim().toLowerCase() === debouncedName.toLowerCase()) ?? null);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [debouncedName, open, isEdit]);

  const cfg = shapeConfig(shape);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(toNumber(basePrice) && toNumber(basePrice)! > 0)) {
      setError('Enter a selling price above zero.');
      return;
    }
    const qty = toNumber(openingQty);
    const cost = toNumber(openingCost);
    if (!isEdit && qty && !cost) {
      setError('Enter what the opening stock cost per unit, so it can be valued.');
      return;
    }
    setSaving(true);
    try {
      const gaugeOption = cfg?.thicknessOptions.find((o) => o.mm === thicknessMm);
      const payload = {
        name,
        displayName: displayName || undefined,
        spec: spec || undefined,
        brandId: brandId || undefined,
        categoryId: categoryId || undefined,
        unitId,
        basePrice: toNumber(basePrice) ?? 0,
        stockStatus,
        shape: shape || undefined,
        nominalSize: nominalSize || undefined,
        widthMm: toNumber(widthMm) ?? undefined,
        heightMm: toNumber(heightMm) ?? undefined,
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
        const created = await productsApi.create(payload);
        if (qty && cost) {
          try {
            await inventoryApi.openingBalance({ productId: created.id, quantity: qty, unitCost: cost });
          } catch (err) {
            // The product exists now; losing the whole form over the stock half would be worse.
            toast.error(`Product saved, but opening stock wasn’t added${err instanceof ApiError ? `: ${err.message}` : ''}. Add it with Adjust stock.`);
            onSaved();
            onClose();
            return;
          }
        }
      }
      toast.success('Product saved');
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
      guardUnsaved
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : duplicateFrom ? 'Duplicate product' : 'Add product'}
      subtitle={isEdit ? product?.name : duplicateFrom ? `Starting from ${duplicateFrom.name}. Give it its own name and price.` : 'Technical identity, dimensions, and customer-facing details'}
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
            <label htmlFor="productformdrawer-technical-name" className={labelClass} style={labelStyle}>
              Technical name
            </label>
            <input id="productformdrawer-technical-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. SHS 40x40x1.2mm'
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
            {sameName && (
              <p className="mt-1 text-xs" role="status" style={{ color: 'var(--color-status-warn)' }}>
                A product called “{sameName.name}” already exists{sameName.active ? '' : ' (archived)'}. Save only if this is a different item.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="productformdrawer-spec-grade-note" className={labelClass} style={labelStyle}>
              Spec / grade note
            </label>
            <input id="productformdrawer-spec-grade-note"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. Y12, 3mm x 6m"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InlineAddSelect label="Brand" noun="brand" items={brands} value={brandId} onChange={setBrandId} onCreate={onCreateBrand} labelClass={labelClass} labelStyle={labelStyle} />

            <InlineAddSelect label="Category" noun="category" items={categories} value={categoryId} onChange={setCategoryId} onCreate={onCreateCategory} labelClass={labelClass} labelStyle={labelStyle} />
          </div>

          <div>
            <label htmlFor="productformdrawer-unit" className={labelClass} style={labelStyle}>
              Unit
            </label>
            <select id="productformdrawer-unit"
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
            {units.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                No units exist yet.{' '}
                <Link href="/products/setup" className="font-medium underline" style={{ color: 'var(--color-accent)' }}>
                  Add some in Catalogue setup
                </Link>{' '}
                first.
              </p>
            )}
          </div>
        </Section>

        <Section title="Shape & dimensions">
          <div>
            <label htmlFor="productformdrawer-shape" className={labelClass} style={labelStyle}>
              Shape
            </label>
            <select id="productformdrawer-shape"
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
            <label htmlFor="productformdrawer-nominal-size" className={labelClass} style={labelStyle}>
              Nominal size
            </label>
            <input id="productformdrawer-nominal-size"
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
                <label htmlFor="productformdrawer-width-mm" className={labelClass} style={labelStyle}>
                  Width (mm)
                </label>
                <NumericInput id="productformdrawer-width-mm"
                  allowDecimal
                  step={0.1}
                  value={widthMm}
                  onChange={setWidthMm}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="productformdrawer-height-mm" className={labelClass} style={labelStyle}>
                  Height (mm)
                </label>
                <NumericInput id="productformdrawer-height-mm"
                  allowDecimal
                  step={0.1}
                  value={heightMm}
                  onChange={setHeightMm}
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
            <label htmlFor="productformdrawer-material" className={labelClass} style={labelStyle}>
              Material
            </label>
            <input id="productformdrawer-material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>

          {families.length > 0 && (
            <div>
              <label htmlFor="productformdrawer-product-family-optional" className={labelClass} style={labelStyle}>
                Product family (optional)
              </label>
              <select id="productformdrawer-product-family-optional"
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
            <label htmlFor="productformdrawer-display-name" className={labelClass} style={labelStyle}>
              Display name
            </label>
            <input id="productformdrawer-display-name"
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
              <label htmlFor="productformdrawer-base-selling-price-ksh" className={labelClass} style={labelStyle}>
                Base selling price (KSh)
              </label>
              <NumericInput id="productformdrawer-base-selling-price-ksh"
                required
                value={basePrice}
                onChange={setBasePrice}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="productformdrawer-stock-status" className={labelClass} style={labelStyle}>
                Availability
              </label>
              <select id="productformdrawer-stock-status"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as typeof stockStatus)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                style={inputStyle}
              >
                <option value="IN_STOCK">In stock</option>
                <option value="SUPPLIER_ONLY">Supplier only</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
              </select>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                “In stock” follows the real count. The other two override it.
              </p>
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (visible in search and the POS)
            </label>
          )}
        </Section>

        {!isEdit && canOpenStock && (
          <Section title="Opening stock (optional)">
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              Already have this on the shelf? Enter what you hold and what it cost per unit. Otherwise leave it blank and receive stock later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="productformdrawer-opening-qty" className={labelClass} style={labelStyle}>
                  Quantity on hand
                </label>
                <NumericInput id="productformdrawer-opening-qty" value={openingQty} onChange={setOpeningQty} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="productformdrawer-opening-cost" className={labelClass} style={labelStyle}>
                  Cost per unit (KSh)
                </label>
                <NumericInput id="productformdrawer-opening-cost" value={openingCost} onChange={setOpeningCost} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
              </div>
            </div>
          </Section>
        )}
      </form>
    </Drawer>
  );
}