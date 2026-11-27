/* Pava OS service worker.
 *
 * Two jobs: push notifications, and keeping the app itself available with no internet so the till opens
 * and prices can be looked up during an outage.
 *
 * What it caches, and why that can't leave you on a stale app:
 *   - /_next/static/*  built files with a content hash in their name: a changed file has a new name, so a
 *     cached one is never out of date. Served from the cache first.
 *   - Page loads (navigations): always tried on the network first. The cached copy is used only when the
 *     network fails or doesn't answer within a few seconds.
 * API calls go to a different origin and are never touched here: data is never served from this cache
 * (the till keeps its own copy of the catalogue in IndexedDB). */

const SHELL = 'pava-shell-v1';
const STATIC = 'pava-static-v1';
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('pava-') && key !== SHELL && key !== STATIC) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/pava-logo.png') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Next's client-side transitions ask for RSC payloads; leave those alone. If one fails offline, Next
  // falls back to a normal page load, which is handled below.
  if (req.mode === 'navigate') event.respondWith(networkThenCache(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkThenCache(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NAV_TIMEOUT_MS)),
    ]);
    // Redirects (e.g. to /login) and errors are not worth keeping as the offline copy of a page.
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const url = new URL(req.url);
    // The page asked for, else the till, else any app page we have: they all boot the same client app.
    for (const path of [url.pathname + url.search, url.pathname, '/pos', '/dashboard', '/']) {
      const hit = await cache.match(path);
      if (hit) return hit;
    }
    throw err;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  // Same tag = replace the earlier notification rather than stacking; renotify
  // makes the replacement still buzz/ping.
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  event.waitUntil(
    (async () => {
      // Open tabs refresh their unread count now instead of polling for it.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: 'pava:push' });
      await self.registration.showNotification(data.title || 'Pava OS', options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          try {
            await client.focus();
            if ('navigate' in client) await client.navigate(target);
            return;
          } catch {
            // fall through and open a fresh window
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
