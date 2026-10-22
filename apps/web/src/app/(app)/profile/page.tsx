'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import { DEFAULT_AVATAR } from '../../../lib/constants';
import { Avatar, AvatarPicker } from '../../../components/Avatar';
import { Switch } from '../../../components/ui/Switch';
import { PinPad } from '../../../components/login/PinPad';
import { toast } from '../../../components/ui/Toast';
import { disablePush, enablePush, getPushStatus, type PushStatus } from '../../../lib/push';

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
  const [avatar, setAvatar] = useState(user?.avatar ?? DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/profile', { name, avatar });
      await refreshMe();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile" description="Your display name and avatar">
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
          <AvatarPicker name={name} value={avatar} onChange={setAvatar} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function NotificationsCard() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getPushStatus(userId).then((st) => live && setStatus(st));
    return () => {
      live = false;
    };
  }, [userId]);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      setStatus(on ? await enablePush(userId) : await disablePush(userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update notifications");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Notifications
      </h2>
      <Switch label="Notifications" checked={status === 'on'} disabled={busy || (status !== 'on' && status !== 'off')} onChange={toggle} />
    </div>
  );
}

function ChangePinCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'current' | 'new'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setOpen(false);
    setStep('current');
    setCurrentPin('');
  }

  async function submitNewPin(newPin: string) {
    setSaving(true);
    setError(false);
    try {
      await api.post('/auth/change-pin', { currentPin, newPin });
      toast.success('PIN changed');
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't change PIN");
      setError(true);
      setStep('current');
      setCurrentPin('');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Card title="PIN">
        <button type="button" onClick={() => setOpen(true)} className="rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Change PIN
        </button>
      </Card>
    );
  }

  return (
    <Card title="Change PIN" description={step === 'current' ? 'Current PIN' : 'New PIN'}>
      <div className="flex justify-center py-2">
        <PinPad
          key={step}
          disabled={saving}
          error={error}
          onErrorClear={() => setError(false)}
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
      <button type="button" onClick={reset} disabled={saving} className="mt-2 text-sm font-medium" style={{ color: 'var(--color-ink-600)' }}>
        Cancel
      </button>
    </Card>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't change password");
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
      <NotificationsCard />
      {user.role === 'STAFF' ? <ChangePinCard /> : <ChangePasswordCard />}
    </div>
  );
}