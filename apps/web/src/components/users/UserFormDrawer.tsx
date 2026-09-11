'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { usersApi, type StaffUser } from '../../lib/users-api';
import { AVATAR_KEYS, avatarColor, type ModuleKey } from '../../lib/constants';
import { PermissionEditor } from './PermissionEditor';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function UserFormDrawer({
  open,
  onClose,
  onSaved,
  user,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user: StaffUser | null;
}) {
  const isEdit = !!user;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_KEYS[0]);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [permissions, setPermissions] = useState<ModuleKey[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setAvatar(user?.avatar ?? AVATAR_KEYS[0]);
    setPhone(user?.phone ?? '');
    setPin('');
    setPermissions(user?.permissions ?? []);
    setActive(user?.active ?? true);
    setError(null);
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && user) {
        await usersApi.update(user.id, { name, avatar, phone: phone || undefined, permissions, active });
      } else {
        if (!/^\d{4}$/.test(pin)) {
          setError('PIN must be exactly 4 digits');
          setSaving(false);
          return;
        }
        await usersApi.create({ name, avatar, phone: phone || undefined, pin, permissions });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit staff account' : 'Add staff account'}
      wide
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="user-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add staff'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <div>
            <label className={labelClass} style={labelStyle}>
              Display name
            </label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Phone
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>

          {!isEdit && (
            <div>
              <label className={labelClass} style={labelStyle}>
                4-digit PIN
              </label>
              <input
                required
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="e.g. 4821"
                className="w-32 rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]"
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                They'll use this to sign in from the staff grid.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass} style={labelStyle}>
              Avatar
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_KEYS.map((key) => {
                const { bg, fg } = avatarColor(key);
                const selected = avatar === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAvatar(key)}
                    aria-label={key}
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: bg, color: fg, outline: selected ? '2px solid var(--color-accent)' : 'none', outlineOffset: 2 }}
                  >
                    {selected && <Check size={14} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-900)' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (can sign in)
            </label>
          )}
        </div>

        <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
          <p className="mb-3 text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-900)', letterSpacing: '0.04em' }}>
            Module access
          </p>
          <PermissionEditor value={permissions} onChange={setPermissions} />
        </div>
      </form>
    </Drawer>
  );
}