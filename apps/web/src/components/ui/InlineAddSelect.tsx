'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const fieldClass = 'w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]';

/**
 * A select with an inline "add a new one" affordance (brand, category).
 *
 * Enter adds the new entry — it does not submit the surrounding form — and
 * Escape backs out without closing the drawer. Typing a name that already
 * exists just selects the existing one; a failed create shows its reason
 * right under the field instead of failing silently; a newly created entry
 * is selected straight away.
 */
export function InlineAddSelect({
  label,
  noun,
  items,
  value,
  onChange,
  onCreate,
  labelClass,
  labelStyle,
}: {
  label: string;
  noun: string;
  items: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<{ id: string }>;
  labelClass: string;
  labelStyle: React.CSSProperties;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setAdding(false);
    setName('');
    setError(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    const existing = items.find((i) => i.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(existing.id);
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      onChange(created.id);
      cancel();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not add that ${noun}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={labelClass} style={labelStyle}>
        {label}
      </label>
      {!adding ? (
        <div className="flex gap-1.5">
          <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} style={inputStyle}>
            <option value="">—</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add a new ${noun}`}
            title={`Add a new ${noun}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            disabled={busy}
            placeholder={`New ${noun} name`}
            aria-label={`New ${noun} name`}
            className={fieldClass}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="shrink-0 rounded-md px-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
