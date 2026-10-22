'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { productsApi, type ProductFamily } from '../../../lib/products-api';
import { ApiError } from '../../../lib/api';
import { NumericInput, toNumber } from '../../ui/inputs';
import { toast } from '../../ui/Toast';

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-ink-900)',
};

const inputClass =
  'min-h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)]';

const labelClass = 'mb-1 block text-[11px] font-semibold uppercase';

const labelStyle = {
  color: 'var(--color-ink-600)',
  letterSpacing: '0.06em',
};

function FamilyCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className="group flex cursor-pointer items-center gap-2.5 text-sm"
      style={{ color: 'var(--color-ink-900)' }}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />

        <span
          className="flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-1"
          style={{
            borderColor: checked
              ? 'var(--color-accent)'
              : 'var(--color-border)',
            backgroundColor: checked
              ? 'var(--color-accent)'
              : 'var(--color-bg)',
          }}
        >
          {checked && (
            <Check
              size={11}
              strokeWidth={2.75}
              className="text-white"
            />
          )}
        </span>
      </span>

      <span className="select-none">{label}</span>
    </label>
  );
}

function FamilyRow({
  family,
  onSaved,
  last,
}: {
  family: ProductFamily;
  onSaved: (f: ProductFamily) => void;
  last: boolean;
}) {
  const [aggregate, setAggregate] = useState(family.aggregateLowStock);
  const [threshold, setThreshold] = useState(
    family.lowStockThreshold?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);

  const originalThreshold = family.lowStockThreshold?.toString() ?? '';

  const dirty =
    aggregate !== family.aggregateLowStock ||
    threshold !== originalThreshold;

  const fieldId = `family-${family.id}-threshold`;

  async function save() {
    setSaving(true);

    try {
      const updated = await productsApi.updateFamily(family.id, {
        aggregateLowStock: aggregate,
        lowStockThreshold: toNumber(threshold),
      });

      toast.success('Family saved');
      onSaved(updated);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't save family",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <li
      className="px-4 py-4 transition-colors hover:bg-[var(--color-bg)] sm:px-5"
      style={{
        borderBottom: last
          ? undefined
          : '1px solid var(--color-border)',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {family.name}
          </p>

          <p
            className="mt-0.5 text-xs"
            style={{ color: 'var(--color-ink-600)' }}
          >
            Low-stock settings for variants in this family
          </p>
        </div>

        <FamilyCheckbox
          checked={aggregate}
          onChange={setAggregate}
          label="Aggregate low-stock"
        />
      </div>

      {aggregate && (
        <div className="mt-3 flex flex-col gap-3 pl-0 sm:flex-row sm:items-end sm:pl-0">
          <div className="w-full sm:w-52">
            <label
              htmlFor={fieldId}
              className={labelClass}
              style={labelStyle}
            >
              Family low-stock threshold
            </label>

            <NumericInput
              id={fieldId}
              value={threshold}
              onChange={setThreshold}
              placeholder="Global default"
              className={`${inputClass} data-num`}
              style={inputStyle}
            />

            <p
              className="mt-1 text-[11px]"
              style={{ color: 'var(--color-ink-600)' }}
            >
              Blank uses the global default.
            </p>
          </div>

          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-10 self-start rounded-md px-3.5 text-sm font-medium text-white transition-opacity disabled:opacity-60 sm:self-end"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}

        </div>
      )}
    </li>
  );
}

export function FamiliesManager({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const [families, setFamilies] = useState<ProductFamily[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

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

    try {
      const family = await productsApi.createFamily({ name });

      toast.success('Family added');

      setFamilies((prev) => [...(prev ?? []), family]);
      setNewName('');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't add family",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='New family name — e.g. Square Pipe 1.5"'
            aria-label="New family name"
            maxLength={80}
            className={`${inputClass} flex-1`}
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={15} strokeWidth={2} />
            {creating ? 'Adding…' : 'Add family'}
          </button>
        </form>
      )}

      <div
        className="mt-4 overflow-hidden rounded-lg border"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {loadError ? (
          <div className="px-4 py-10 text-center">
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--color-ink-900)' }}
            >
              Couldn&apos;t load families.
            </p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 text-sm font-medium underline underline-offset-2"
              style={{ color: 'var(--color-accent)' }}
            >
              Try again
            </button>
          </div>
        ) : families === null ? (
          <div className="flex flex-col gap-px">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse"
                style={{
                  backgroundColor: 'var(--color-border)',
                  opacity: 0.35,
                }}
              />
            ))}
          </div>
        ) : families.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--color-accent)',
              }}
            >
              <Plus size={17} strokeWidth={2} />
            </div>

            <p
              className="mt-3 text-sm font-semibold"
              style={{ color: 'var(--color-ink-900)' }}
            >
              No product families yet
            </p>

            <p
              className="mx-auto mt-1 max-w-sm text-sm leading-5"
              style={{ color: 'var(--color-ink-600)' }}
            >
              Create a family, then assign products to it.
            </p>
          </div>
        ) : (
          <ul>
            {families.map((family, index) => (
              <FamilyRow
                key={family.id}
                family={family}
                last={index === families.length - 1}
                onSaved={(updated) =>
                  setFamilies((prev) =>
                    (prev ?? []).map((existing) =>
                      existing.id === updated.id
                        ? updated
                        : existing,
                    ),
                  )
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}