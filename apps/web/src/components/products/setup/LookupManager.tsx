'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ApiError } from '../../../lib/api';
import { toast } from '../../ui/Toast';

interface Item {
  id: string;
  name: string;
  _count?: { products: number };
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const inputClass = 'min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]';

export function usageLabel(n: number | undefined, noun = 'product') {
  if (!n) return 'Not used yet';
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Add / rename / remove for a flat list of names — brands and categories.
 * Removal is only offered when nothing uses the entry; the server enforces
 * the same rule, this just doesn't dangle a button that can only fail.
 */
export function LookupManager({
  noun,
  nounPlural,
  emptyHint,
  canEdit,
  api,
}: {
  noun: string;
  nounPlural: string;
  emptyHint: string;
  canEdit: boolean;
  api: {
    list: () => Promise<Item[]>;
    create: (name: string) => Promise<Item>;
    rename: (id: string, name: string) => Promise<Item>;
    remove: (id: string) => Promise<unknown>;
  };
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoadError(false);
    try {
      setItems(await api.list());
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      await api.create(name);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} added`);
      setNewName('');
      await load();
    } catch (err) {
      fail(err, `Could not add that ${noun}.`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await api.rename(editingId, name);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} renamed`);
      setEditingId(null);
      await load();
    } catch (err) {
      fail(err, `Could not rename that ${noun}.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.remove(confirmDelete.id);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} removed`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setConfirmDelete(null);
      fail(err, `Could not remove that ${noun}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${noun} name`} aria-label={`New ${noun} name`} maxLength={60} className={inputClass} style={inputStyle} />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={15} strokeWidth={2} />
            {adding ? 'Adding…' : 'Add'}
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
              Couldn&apos;t load the {nounPlural}.
            </p>
            <button type="button" onClick={() => void load()} className="mt-2 text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              Try again
            </button>
          </div>
        ) : items === null ? (
          <div className="flex flex-col gap-px p-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-md" style={{ backgroundColor: 'var(--color-border)', opacity: 0.5 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              No {nounPlural} yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--color-ink-600)' }}>
              {emptyHint}
            </p>
          </div>
        ) : (
          <ul>
            {items.map((item, i) => {
              const used = item._count?.products ?? 0;
              const editing = editingId === item.id;
              return (
                <li key={item.id} className="flex min-h-12 items-center gap-3 px-4 py-2" style={i > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}>
                  {editing ? (
                    <form onSubmit={handleRename} className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        aria-label={`Rename ${item.name}`}
                        maxLength={60}
                        className={inputClass}
                        style={inputStyle}
                      />
                      <button type="submit" disabled={saving || !editName.trim()} aria-label="Save name" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
                        <Check size={15} strokeWidth={2.25} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                        <X size={15} strokeWidth={2} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {item.name}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {usageLabel(used)}
                      </span>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditName(item.name);
                              setError(null);
                            }}
                            aria-label={`Rename ${item.name}`}
                            title="Rename"
                            className="flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ color: 'var(--color-ink-600)' }}
                          >
                            <Pencil size={15} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            disabled={used > 0}
                            onClick={() => setConfirmDelete(item)}
                            aria-label={`Remove ${item.name}`}
                            title={used > 0 ? `In use by ${used} product${used === 1 ? '' : 's'} — move them first` : 'Remove'}
                            className="flex h-9 w-9 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-30"
                            style={{ color: 'var(--color-status-bad)' }}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Remove ${confirmDelete.name}?`}
          description={`No product uses this ${noun}, so nothing else changes.`}
          confirmLabel="Remove"
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
