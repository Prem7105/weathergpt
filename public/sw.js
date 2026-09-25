// Bump these on any caching-strategy change so activate() purges old caches.
const CACHE_NAME = 'weathergpt-static-v2';
const DATA_CACHE_NAME = 'weathergpt-data-v2';
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);
const DATA_API_PATHS = ['/api/risk', '/api/incidents'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    // Network-first for live weather/ground-reality: always show fresh data,
    // fall back to the last response (with its visible assessedAt timestamp)
    // only when the network is actually down.
    const isDataApi = event.request.method === 'GET'
      && DATA_API_PATHS.some((path) => requestUrl.pathname === path || requestUrl.pathname.startsWith(`${path}/`));
    if (isDataApi) {
      event.respondWith(
        caches.open(DATA_CACHE_NAME).then((cache) => fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(async () => (await cache.match(event.request)) || Response.error())),
      );
    }
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/')),
    );
    return;
  }

  if (!STATIC_DESTINATIONS.has(event.request.destination)) {
    return;
  }

  // Only content-hashed production build output is immutable, so only it may be
  // cache-first. Dev chunks (e.g. /_next/static/chunks/app/page.js) carry no
  // hash, and everything else is network-first so a new deploy shows up at once.
  const isImmutable = requestUrl.pathname.startsWith('/_next/static/') && /[0-9a-f]{16}/i.test(requestUrl.pathname);
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (isImmutable) {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(async () => (await cache.match(event.request)) || Response.error());
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'WeatherGPT', body: event.data?.text() || 'New weather update.' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'WeatherGPT', {
    body: payload.body || 'New weather update.',
    icon: payload.icon || '/icons/weatherGPT logo.png',
    badge: payload.badge || '/icons/weatherGPT logo.png',
    tag: payload.tag || 'weathergpt-weather',
    data: payload.data || { url: '/' },
    actions: payload.actions || [{ action: 'view-weather', title: 'View Weather' }, { action: 'dismiss', title: 'Dismiss' }],
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const existing = clientList.find((client) => 'focus' in client);
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  }));
});
