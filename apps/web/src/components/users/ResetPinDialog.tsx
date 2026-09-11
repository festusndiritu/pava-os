'use client';

import { useState } from 'react';
import { usersApi, type StaffUser } from '../../lib/users-api';
import { ApiError } from '../../lib/api';

export function ResetPinDialog({ user, onClose, onDone }: { user: StaffUser; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.resetPin(user.id, pin);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset PIN.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Reset PIN — {user.name}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          This immediately signs them out everywhere. They'll need the new PIN next time.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="New 4-digit PIN"
            className="w-full rounded-md border px-3 py-2 text-sm data-num"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving || pin.length !== 4} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? 'Saving…' : 'Reset PIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}