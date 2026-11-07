const CACHE_VERSION = 'inventory-app-stock-voice-v6';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('inventory-app-') && key !== CACHE_VERSION)
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Vite modules have stable URLs but changing exports. Never cache them.
  if (/^\/(src|@vite|@react-refresh|@id|@fs|node_modules)(\/|$)/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    const cache = caches.open(CACHE_VERSION);
    const cached = cache.then(store => store.match('/index.html')).catch(() => undefined);
    let freshPage;
    const network = fetch(request).then(response => {
      if (response.ok) freshPage = response.clone();
      return response;
    }).catch(() => undefined);
    // A cached launch can render while a slow connection refreshes the shell.
    const quickCache = new Promise(resolve => setTimeout(resolve, 500)).then(() => cached);
    event.respondWith((async () => {
      const first = await Promise.race([network, quickCache]);
      return first || await cached || await network || Response.error();
    })());
    event.waitUntil(network.then(async () => {
      if (freshPage) await (await cache).put('/index.html', freshPage);
    }).catch(() => undefined));
    return;
  }

  const isStaticAsset = ['style', 'script', 'image', 'font'].includes(
    request.destination,
  );

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(cached => {
      // Content-hashed build assets can be served without a network request.
      const immutable = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(url.pathname);
      if (immutable && cached) return cached;
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return network;
    }),
  );
});
