/* Pava OS service worker — push notifications only.
 * Deliberately has no fetch handler and caches nothing, so it can never serve
 * a stale copy of the app or get in the way of API calls. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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

  event.waitUntil(self.registration.showNotification(data.title || 'Pava OS', options));
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
