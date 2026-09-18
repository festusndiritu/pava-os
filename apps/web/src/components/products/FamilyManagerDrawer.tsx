'use client';

import { FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { productsApi, type ProductFamily } from '../../lib/products-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

function FamilyRow({ family, onSaved }: { family: ProductFamily; onSaved: (f: ProductFamily) => void }) {
  const [aggregate, setAggregate] = useState(family.aggregateLowStock);
  const [threshold, setThreshold] = useState(family.lowStockThreshold?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = aggregate !== family.aggregateLowStock || threshold !== (family.lowStockThreshold?.toString() ?? '');

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await productsApi.updateFamily(family.id, {
        aggregateLowStock: aggregate,
        lowStockThreshold: threshold === '' ? null : Number(threshold),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this family.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {family.name}
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
        <input type="checkbox" checked={aggregate} onChange={(e) => setAggregate(e.target.checked)} />
        Aggregate low-stock across variants in this family
      </label>
      {aggregate && (
        <div className="mt-2">
          <label className={labelClass} style={labelStyle}>
            Family low-stock threshold (blank = use the global default)
          </label>
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-32 rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]"
            style={inputStyle}
          />
        </div>
      )}
      {dirty && (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error && (
            <span className="text-xs" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function FamilyManagerDrawer({
  open,
  onClose,
  families,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  families: ProductFamily[];
  onChanged: (families: ProductFamily[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const family = await productsApi.createFamily({ name: newName.trim() });
      onChanged([...families, family]);
      setNewName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this family.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Product families" subtitle="Group variants for search, marketing, and shared low-stock alerts">
      <div className="flex flex-col gap-4">
        <form onSubmit={handleCreate} className="flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass} style={labelStyle}>
              New family name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Welding rods"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={14} strokeWidth={2} />
            Add
          </button>
        </form>
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {families.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              No product families yet. Create one above, then assign products to it from the product form.
            </p>
          )}
          {families.map((f) => (
            <FamilyRow
              key={f.id}
              family={f}
              onSaved={(updated) => onChanged(families.map((existing) => (existing.id === updated.id ? updated : existing)))}
            />
          ))}
        </div>
      </div>
    </Drawer>
  );
}