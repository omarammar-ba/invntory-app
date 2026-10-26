const CACHE_VERSION = 'inventory-app-v25-consistent-modules';
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
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () =>
          (await caches.match('/index.html')) || (await caches.match('/')),
        ),
    );
    return;
  }

  const isStaticAsset = ['style', 'script', 'image', 'font'].includes(
    request.destination,
  );

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      // Only content-hashed build assets are immutable; stable URLs use fresh bytes.
      const immutable = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(url.pathname);
      return immutable && cached ? cached : network;
    }),
  );
});
