'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Box, Boxes, Check, ChevronDown, ChevronRight, CircleDot, Droplet, Grid3x3, Hash, Layers, Package, Pencil, Plus, Ruler, ShoppingBag, Trash2, Truck, Weight, X } from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { NumericInput, toNumber } from '../../ui/inputs';
import { productsApi, type SubUnit, type Unit } from '../../../lib/products-api';
import { ApiError } from '../../../lib/api';
import { usageLabel } from './LookupManager';
import { toast } from '../../ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const inputClass = 'min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

// One tap to get a sensible starting set on a fresh install — a product can't
// be created without a unit, so an empty list is a dead end otherwise.
const COMMON_UNITS = [
  { name: 'Piece', symbol: 'pcs' },
  { name: 'Bag', symbol: 'bag' },
  { name: 'Kilogram', symbol: 'kg' },
  { name: 'Roll', symbol: 'roll' },
  { name: 'Sheet', symbol: 'sheet' },
  { name: 'Metre', symbol: 'm' },
  { name: 'Bundle', symbol: 'bdl' },
  { name: 'Litre', symbol: 'ltr' },
];

// A curated set of the symbols this trade actually uses — picking one is
// faster and less error-prone than typing it, and still just sets the same
// plain-text `symbol` the API has always stored. "Custom…" covers anything
// not on the list, so nothing is lost versus free text.
const SYMBOL_OPTIONS: { symbol: string; icon: typeof Package }[] = [
  { symbol: 'pcs', icon: Package },
  { symbol: 'kg', icon: Weight },
  { symbol: 'g', icon: Weight },
  { symbol: 'ltr', icon: Droplet },
  { symbol: 'm', icon: Ruler },
  { symbol: 'bag', icon: ShoppingBag },
  { symbol: 'box', icon: Box },
  { symbol: 'bdl', icon: Boxes },
  { symbol: 'sheet', icon: Layers },
  { symbol: 'roll', icon: CircleDot },
  { symbol: 'dz', icon: Grid3x3 },
  { symbol: 'ton', icon: Truck },
];

function SymbolPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const preset = SYMBOL_OPTIONS.find((o) => o.symbol === value);
  const Icon = preset?.icon ?? Hash;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative w-32 shrink-0" ref={wrapRef}>
      <button
        type="button"
        id={id}
        onClick={() => {
          setCustomMode(false);
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={value ? `Symbol: ${value}` : 'Choose a symbol'}
        className={`${inputClass} flex items-center gap-1.5`}
        style={inputStyle}
      >
        <Icon size={15} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />
        <span className="min-w-0 flex-1 truncate text-left">{value || 'Symbol'}</span>
        <ChevronDown size={13} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />
      </button>

      {open && (
        <div role="menu" aria-label="Symbol options" className="absolute left-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-md border p-1.5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="grid grid-cols-2 gap-1">
            {SYMBOL_OPTIONS.map((opt) => (
              <button
                key={opt.symbol}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(opt.symbol);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm"
                style={{ backgroundColor: value === opt.symbol ? 'var(--color-bg)' : 'transparent', color: 'var(--color-ink-900)' }}
              >
                <opt.icon size={14} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />
                <span className="min-w-0 flex-1 truncate">{opt.symbol}</span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--color-border)' }}>
            {customMode ? (
              <input
                autoFocus
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customValue.trim()) {
                    e.preventDefault();
                    onChange(customValue.trim());
                    setOpen(false);
                  }
                }}
                onBlur={() => {
                  if (customValue.trim()) onChange(customValue.trim());
                }}
                placeholder="Custom symbol"
                aria-label="Custom symbol"
                maxLength={12}
                className={`${inputClass} min-h-8`}
                style={inputStyle}
              />
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCustomValue(value && !preset ? value : '');
                  setCustomMode(true);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-sm"
                style={{ color: 'var(--color-ink-600)' }}
              >
                Custom…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, danger, disabled, title, children }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className="flex h-9 w-9 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-30"
      style={{ color: danger ? 'var(--color-status-bad)' : 'var(--color-ink-600)' }}
    >
      {children}
    </button>
  );
}

function SubUnitRow({ unit, sub, canEdit, onChanged, onError }: { unit: Unit; sub: SubUnit; canEdit: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);
  const [factor, setFactor] = useState(String(sub.factor));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const f = toNumber(factor);
    if (!name.trim() || !f || f <= 0) return;
    setBusy(true);
    try {
      await productsApi.updateSubUnit(unit.id, sub.id, { name: name.trim(), factor: f });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save that sub-unit.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await productsApi.deleteSubUnit(unit.id, sub.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setConfirming(false);
      onError(err instanceof ApiError ? err.message : 'Could not remove that sub-unit.');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 py-1.5">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Sub-unit name" maxLength={60} className={inputClass} style={inputStyle} />
        <NumericInput allowDecimal maxDecimals={3} value={factor} onChange={setFactor} aria-label="Factor" className={`${inputClass} w-24 shrink-0 data-num`} style={inputStyle} />
        <button type="submit" disabled={busy} aria-label="Save" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Check size={15} strokeWidth={2.25} />
        </button>
        <IconButton label="Cancel" onClick={() => setEditing(false)}>
          <X size={15} strokeWidth={2} />
        </IconButton>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-ink-900)' }}>
        {sub.name}
      </span>
      <span className="data-num shrink-0 text-xs" style={{ color: 'var(--color-ink-600)' }}>
        × {sub.factor}
      </span>
      {canEdit && (
        <div className="flex shrink-0 items-center">
          <IconButton label={`Edit ${sub.name}`} onClick={() => setEditing(true)}>
            <Pencil size={14} strokeWidth={2} />
          </IconButton>
          <IconButton label={`Remove ${sub.name}`} danger onClick={() => setConfirming(true)}>
            <Trash2 size={14} strokeWidth={2} />
          </IconButton>
        </div>
      )}
      {confirming && <ConfirmDialog title={`Remove ${sub.name}?`} description={`It's only a description of ${unit.name}; no product or sale refers to it.`} confirmLabel="Remove" busy={busy} onCancel={() => setConfirming(false)} onConfirm={remove} />}
    </div>
  );
}

function SubUnits({ unit, canEdit, onChanged, onError }: { unit: Unit; canEdit: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [factor, setFactor] = useState('');
  const [busy, setBusy] = useState(false);
  const subs = unit.subUnits ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    const f = toNumber(factor);
    if (!name.trim() || !f || f <= 0) return;
    setBusy(true);
    try {
      await productsApi.addSubUnit(unit.id, { name: name.trim(), factor: f });
      setName('');
      setFactor('');
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not add that sub-unit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
        Ways {unit.name.toLowerCase()} is sold or described, and how much of the base measure each one is — e.g. &ldquo;50kg bag&rdquo; under Bag has a factor of 50.
      </p>

      {subs.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          No sub-units yet.
        </p>
      ) : (
        <div className="mt-2 divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {subs.map((s) => (
            <SubUnitRow key={s.id} unit={unit} sub={s} canEdit={canEdit} onChanged={onChanged} onError={onError} />
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="unitsmanager-sub-unit" className={labelClass} style={labelStyle}>
              Sub-unit
            </label>
            <input id="unitsmanager-sub-unit" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 50kg bag" maxLength={60} className={inputClass} style={inputStyle} />
          </div>
          <div className="w-24 shrink-0">
            <label htmlFor="unitsmanager-factor" className={labelClass} style={labelStyle}>
              Factor
            </label>
            <NumericInput id="unitsmanager-factor" allowDecimal maxDecimals={3} value={factor} onChange={setFactor} placeholder="50" className={`${inputClass} data-num`} style={inputStyle} />
          </div>
          <button type="submit" disabled={busy || !name.trim() || !toNumber(factor)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-md border px-3 text-sm font-medium disabled:opacity-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}>
            <Plus size={14} strokeWidth={2} />
            Add
          </button>
        </form>
      )}
    </div>
  );
}

export function UnitsManager({ canEdit }: { canEdit: boolean }) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoadError(false);
    try {
      setUnits(await productsApi.units());
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !symbol.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await productsApi.createUnit({ name: name.trim(), symbol: symbol.trim() });
      toast.success('Unit added');
      setName('');
      setSymbol('');
      setOpenId(created.id);
      await load();
    } catch (err) {
      fail(err, 'Could not add that unit.');
    } finally {
      setAdding(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editSymbol.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await productsApi.updateUnit(editingId, { name: editName.trim(), symbol: editSymbol.trim() });
      toast.success('Unit saved');
      setEditingId(null);
      await load();
    } catch (err) {
      fail(err, 'Could not save that unit.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await productsApi.deleteUnit(confirmDelete.id);
      toast.success('Unit removed');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setConfirmDelete(null);
      fail(err, 'Could not remove that unit.');
    } finally {
      setDeleting(false);
    }
  }

  async function addCommon() {
    setSeeding(true);
    setError(null);
    try {
      for (const u of COMMON_UNITS) {
        try {
          await productsApi.createUnit(u);
        } catch (err) {
          // Already there (409) is fine; anything else is worth surfacing.
          if (!(err instanceof ApiError && err.status === 409)) throw err;
        }
      }
      toast.success('Common units added');
      await load();
    } catch (err) {
      fail(err, 'Could not add the common units.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="min-w-0 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit name — e.g. Bag" aria-label="New unit name" maxLength={60} className={inputClass} style={inputStyle} />
          </div>
          <SymbolPicker value={symbol} onChange={setSymbol} id="unitsmanager-new-symbol" />
          <button type="submit" disabled={adding || !name.trim() || !symbol.trim()} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
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
              Couldn&apos;t load the units.
            </p>
            <button type="button" onClick={() => void load()} className="mt-2 text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              Try again
            </button>
          </div>
        ) : units === null ? (
          <div className="flex flex-col gap-px p-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-md" style={{ backgroundColor: 'var(--color-border)', opacity: 0.5 }} />
            ))}
          </div>
        ) : units.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              No units yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Every product is sold in a unit — pieces, bags, kilograms. Add the ones you use, or start from the common set.
            </p>
            {canEdit && (
              <button type="button" onClick={addCommon} disabled={seeding} className="mt-3 rounded-md border px-3.5 py-2 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                {seeding ? 'Adding…' : 'Add common units'}
              </button>
            )}
          </div>
        ) : (
          <ul>
            {units.map((u, i) => {
              const used = u._count?.products ?? 0;
              const subCount = u.subUnits?.length ?? 0;
              const open = openId === u.id;
              const editing = editingId === u.id;
              return (
                <li key={u.id} style={i > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}>
                  <div className="flex min-h-12 items-center gap-2 px-2 py-2 pr-4">
                    <button type="button" onClick={() => setOpenId(open ? null : u.id)} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} sub-units of ${u.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
                      <ChevronRight size={16} strokeWidth={2} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
                    </button>

                    {editing ? (
                      <form onSubmit={handleSave} className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} aria-label={`Name of ${u.name}`} maxLength={60} className={inputClass} style={inputStyle} />
                        </div>
                        <SymbolPicker value={editSymbol} onChange={setEditSymbol} id={`unitsmanager-edit-symbol-${u.id}`} />
                        <button type="submit" disabled={saving} aria-label="Save" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
                          <Check size={15} strokeWidth={2.25} />
                        </button>
                        <IconButton label="Cancel" onClick={() => setEditingId(null)}>
                          <X size={15} strokeWidth={2} />
                        </IconButton>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                          {u.name}
                          <span className="data-num ml-2 rounded px-1.5 py-0.5 text-xs font-normal" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
                            {u.symbol}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-xs sm:inline" style={{ color: 'var(--color-ink-600)' }}>
                          {subCount > 0 ? `${subCount} sub-unit${subCount === 1 ? '' : 's'} · ` : ''}
                          {usageLabel(used)}
                        </span>
                        {canEdit && (
                          <div className="flex shrink-0 items-center">
                            <IconButton
                              label={`Edit ${u.name}`}
                              onClick={() => {
                                setEditingId(u.id);
                                setEditName(u.name);
                                setEditSymbol(u.symbol);
                                setError(null);
                              }}
                            >
                              <Pencil size={15} strokeWidth={2} />
                            </IconButton>
                            <IconButton label={`Remove ${u.name}`} danger disabled={used > 0} title={used > 0 ? `In use by ${used} product${used === 1 ? '' : 's'}` : 'Remove'} onClick={() => setConfirmDelete(u)}>
                              <Trash2 size={15} strokeWidth={2} />
                            </IconButton>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {open && <SubUnits unit={u} canEdit={canEdit} onChanged={load} onError={setError} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Remove ${confirmDelete.name}?`}
          description={
            (confirmDelete.subUnits?.length ?? 0) > 0
              ? `No product uses this unit. Its ${confirmDelete.subUnits!.length} sub-unit${confirmDelete.subUnits!.length === 1 ? '' : 's'} will be removed with it.`
              : 'No product uses this unit, so nothing else changes.'
          }
          confirmLabel="Remove"
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
