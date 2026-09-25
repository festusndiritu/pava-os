'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { productsApi, type ProductFamily } from '../../../lib/products-api';
import { ApiError } from '../../../lib/api';
import { NumericInput, toNumber } from '../../ui/inputs';
import { toast } from '../../ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const inputClass = 'min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

function FamilyRow({ family, onSaved }: { family: ProductFamily; onSaved: (f: ProductFamily) => void }) {
  const [aggregate, setAggregate] = useState(family.aggregateLowStock);
  const [threshold, setThreshold] = useState(family.lowStockThreshold?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = aggregate !== family.aggregateLowStock || threshold !== (family.lowStockThreshold?.toString() ?? '');
  const fieldId = `family-${family.id}-threshold`;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await productsApi.updateFamily(family.id, { aggregateLowStock: aggregate, lowStockThreshold: toNumber(threshold) });
      toast.success('Family saved');
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this family.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {family.name}
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
        <input type="checkbox" checked={aggregate} onChange={(e) => setAggregate(e.target.checked)} />
        Aggregate low-stock across variants in this family
      </label>
      {aggregate && (
        <div className="mt-2 max-w-xs">
          <label htmlFor={fieldId} className={labelClass} style={labelStyle}>
            Family low-stock threshold (blank = use the global default)
          </label>
          <NumericInput id={fieldId} value={threshold} onChange={setThreshold} className={`${inputClass} data-num`} style={inputStyle} />
        </div>
      )}
      {dirty && (
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error && (
            <span className="text-xs" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Product families — grouping variants (e.g. Square Pipe 1.5" across gauges)
 * for search, marketing and shared low-stock alerts. Assigning a product to a
 * family still happens on the product form; this is just where families
 * themselves are created and tuned.
 */
export function FamiliesManager({ canEdit }: { canEdit: boolean }) {
  const [families, setFamilies] = useState<ProductFamily[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoadError(false);
    try {
      setFamilies(await productsApi.families());
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const family = await productsApi.createFamily({ name });
      toast.success('Family added');
      setFamilies((prev) => [...(prev ?? []), family]);
      setNewName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this family.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New family name — e.g. Square Pipe 1.5&quot;" aria-label="New family name" maxLength={80} className={inputClass} style={inputStyle} />
          <button type="submit" disabled={creating || !newName.trim()} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
            <Plus size={15} strokeWidth={2} />
            {creating ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        {loadError ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-ink-900)' }}>
              Couldn&apos;t load families.
            </p>
            <button type="button" onClick={() => void load()} className="mt-2 text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              Try again
            </button>
          </div>
        ) : families === null ? (
          <div className="flex flex-col gap-px p-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md" style={{ backgroundColor: 'var(--color-border)', opacity: 0.5 }} />
            ))}
          </div>
        ) : families.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              No product families yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Create one above, then assign variants to it from the product form — useful for comparing a size across gauges and for a shared low-stock alert.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {families.map((f) => (
              <FamilyRow key={f.id} family={f} onSaved={(updated) => setFamilies((prev) => (prev ?? []).map((existing) => (existing.id === updated.id ? updated : existing)))} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
