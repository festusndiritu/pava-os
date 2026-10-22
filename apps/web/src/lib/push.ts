import { api } from './api';

/** Browser side of push notifications. */

export type PushStatus = 'loading' | 'unsupported' | 'ios-needs-install' | 'denied' | 'off' | 'on';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
  reminderHour: number;
}

const optInKey = (userId: string) => `pava.push.optin.${userId}`;

const hasOptedIn = (userId: string) => {
  try {
    return localStorage.getItem(optInKey(userId)) === '1';
  } catch {
    return false;
  }
};
const setOptedIn = (userId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(optInKey(userId), '1');
    else localStorage.removeItem(optInKey(userId));
  } catch {
    // storage blocked — the toggle just won't persist
  }
};

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Typed against an explicit ArrayBuffer — newer TypeScript won't accept a
// Uint8Array<ArrayBufferLike> as the browser's BufferSource.
function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

export const getPushConfig = () => api.get<PushConfig>('/notifications/config');

async function ensureSubscription(reg: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const key = keyToBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made under a different server key (keys were regenerated) can never be delivered
  // to — replace it.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

export async function getPushStatus(userId: string): Promise<PushStatus> {
  if (typeof window === 'undefined') return 'loading';
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted' || !hasOptedIn(userId)) return 'off';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Asks permission (must be called from a tap/click), subscribes, tells the server. */
export async function enablePush(userId: string): Promise<PushStatus> {
  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) throw new Error('Notifications are not set up on the server yet.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await registration();
  const sub = await ensureSubscription(reg, config.publicKey);
  await api.post('/notifications/subscribe', sub.toJSON());
  setOptedIn(userId, true);
  return 'on';
}

export async function disablePush(userId: string): Promise<PushStatus> {
  setOptedIn(userId, false);
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api.post('/notifications/unsubscribe', { endpoint: sub.endpoint });
  } catch {
  }
  return 'off';
}

/** Run once per signed-in user. */
export async function syncPush(userId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !hasOptedIn(userId)) return;
  try {
    const config = await getPushConfig();
    if (!config.enabled || !config.publicKey) return;
    const reg = await registration();
    const sub = await ensureSubscription(reg, config.publicKey);
    await api.post('/notifications/subscribe', sub.toJSON());
  } catch {
  }
}

/** Explicit sign-out only: stop this device receiving the signed-out person's notifications. */
export async function releaseDeviceOnLogout(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api.post('/notifications/unsubscribe', { endpoint: sub.endpoint });
  } catch {
    // never block signing out
  }
}

export const sendTestPush = () => api.post<{ delivered: number }>('/notifications/test');

// ------------------------------------------------------------------- Inbox What the notifications
// page and the topbar bell read.

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (opts: { unreadOnly?: boolean; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.unreadOnly) qs.set('unread', '1');
    if (opts.limit) qs.set('limit', String(opts.limit));
    const q = qs.toString();
    return api.get<AppNotification[]>(`/notifications${q ? `?${q}` : ''}`);
  },
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
