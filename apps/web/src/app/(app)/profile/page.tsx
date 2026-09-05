'use client';

import { FormEvent, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import { AVATAR_KEYS, avatarColor } from '../../../lib/constants';
import { Avatar } from '../../../components/Avatar';
import { PinPad } from '../../../components/login/PinPad';

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function fieldStyle() {
  return { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
}

function NameAvatarCard() {
  const { user, refreshMe } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? AVATAR_KEYS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/auth/profile', { name, avatar });
      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile" description="Your display name and avatar — visible to the whole team on the staff login screen.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Display name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className="w-full max-w-sm rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            style={fieldStyle()}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Avatar
          </p>
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
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-transform"
                  style={{
                    backgroundColor: bg,
                    color: fg,
                    outline: selected ? '2px solid var(--color-accent)' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {selected && <Check size={16} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="text-sm" style={{ color: 'var(--color-status-ok)' }}>
              Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

function ChangePinCard() {
  const [step, setStep] = useState<'current' | 'new'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submitNewPin(newPin: string) {
    setSaving(true);
    setError(null);
    try {
      await api.post('/auth/change-pin', { currentPin, newPin });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change PIN.');
      setStep('current');
      setCurrentPin('');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Card title="Change PIN">
        <p className="text-sm" style={{ color: 'var(--color-status-ok)' }}>
          Your PIN has been updated.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Change PIN" description={step === 'current' ? 'Enter your current PIN to continue.' : 'Now enter your new 4-digit PIN.'}>
      <div className="flex justify-center py-2">
        <PinPad
          key={step}
          disabled={saving}
          error={error}
          onErrorClear={() => setError(null)}
          onComplete={(pin) => {
            if (step === 'current') {
              setCurrentPin(pin);
              setStep('new');
            } else {
              submitNewPin(pin);
            }
          }}
        />
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={saving}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            style={fieldStyle()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={saving}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            style={fieldStyle()}
          />
        </div>

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}
        {done && (
          <p className="text-sm" style={{ color: 'var(--color-status-ok)' }}>
            Password updated.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} avatar={user.avatar} size={44} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            My profile
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {user.role === 'ADMIN' ? 'Administrator' : 'Staff'} account
          </p>
        </div>
      </div>

      <NameAvatarCard />
      {user.role === 'STAFF' ? <ChangePinCard /> : <ChangePasswordCard />}
    </div>
  );
}