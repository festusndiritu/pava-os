'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { notificationsApi, getPushStatus, type AppNotification, type PushStatus } from '../../../lib/push';
import { useAuth } from '../../../lib/auth-context';
import { toast } from '../../../components/ui/Toast';

const muted = { color: 'var(--color-ink-600)' };

// "5 min ago", "yesterday" — older than a week falls back to the date.
function ago(iso: string) {
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(secs);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(secs / 86400), 'day');
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

const announce = () => window.dispatchEvent(new Event('pava:notifications-changed'));

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [push, setPush] = useState<PushStatus>('loading');

  const load = useCallback(() => {
    notificationsApi
      .list({ unreadOnly, limit: 100 })
      .then(setItems)
      .catch(() => setItems((prev) => prev ?? []));
  }, [unreadOnly]);

  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pava:notifications-changed', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pava:notifications-changed', load);
    };
  }, [load]);

  useEffect(() => {
    if (user?.id) getPushStatus(user.id).then(setPush);
  }, [user?.id]);

  const unread = items?.filter((n) => !n.readAt).length ?? 0;

  function open(n: AppNotification) {
    if (!n.readAt) {
      // Optimistic: the row reads as done at once; the server catches up.
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? prev);
      notificationsApi.markRead(n.id).then(announce).catch(() => {});
    }
    if (n.url) router.push(n.url);
  }

  async function readAll() {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev?.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })) ?? prev);
      announce();
    } catch {
      toast.error("Couldn't mark them as read");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Notifications
          </h1>
          <p className="mt-0.5 text-sm" style={muted}>
            Things waiting on you, and what happened to the ones you sent.
          </p>
        </div>
        <button
          type="button"
          onClick={readAll}
          disabled={unread === 0}
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
        >
          <CheckCheck size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Mark all read</span>
        </button>
      </div>

      <div className="mt-4 flex gap-1 rounded-md border p-0.5" role="group" aria-label="Filter" style={{ borderColor: 'var(--color-border)', width: 'fit-content' }}>
        {([false, true] as const).map((only) => (
          <button
            key={String(only)}
            type="button"
            aria-pressed={unreadOnly === only}
            onClick={() => setUnreadOnly(only)}
            className="min-h-8 rounded px-3 text-sm font-medium"
            style={{ backgroundColor: unreadOnly === only ? 'var(--color-accent-soft)' : 'transparent', color: unreadOnly === only ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
          >
            {only ? 'Unread' : 'All'}
          </button>
        ))}
      </div>

      {push === 'off' && (
        <Link
          href="/profile"
          className="mt-4 flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
        >
          <BellRing size={15} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
          Switch on alerts for this device in your profile to be pinged the moment something comes in.
        </Link>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {items === null && (
          <p className="text-sm" style={muted}>
            Loading…
          </p>
        )}

        {items?.length === 0 && (
          <div className="rounded-lg border px-6 py-12 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <Bell size={26} strokeWidth={1.5} className="mx-auto mb-2" style={muted} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {unreadOnly ? 'Nothing unread' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-sm" style={muted}>
              {unreadOnly ? 'You’re all caught up.' : 'Edits and advances waiting for approval will show up here.'}
            </p>
          </div>
        )}

        {items?.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => open(n)}
            className="flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors hover:bg-[var(--color-bg)]"
            style={{
              borderColor: n.readAt ? 'var(--color-border)' : 'var(--color-accent)',
              backgroundColor: n.readAt ? 'var(--color-surface)' : 'var(--color-accent-soft)',
            }}
          >
            <span
              aria-hidden
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: n.readAt ? 'transparent' : 'var(--color-accent)' }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                  {n.title}
                </span>
                <span className="shrink-0 text-xs" style={muted}>
                  {ago(n.createdAt)}
                </span>
              </span>
              <span className="mt-0.5 block text-sm" style={muted}>
                {n.body}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
