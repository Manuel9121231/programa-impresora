/* ═══════════════════════════════════════════════════════════
   MantApp — Service Worker (Cache-first for shell assets)
   ═══════════════════════════════════════════════════════════ */

// Skip ALL caching on localhost so dev changes are instant
const IS_LOCAL = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const CACHE_NAME = 'mantapp-v5';
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
  'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js',
];

self.addEventListener('install', event => {
  if (IS_LOCAL) { self.skipWaiting(); return; }
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  if (IS_LOCAL) { self.clients.claim(); return; }
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Never intercept Apps Script calls
  if (event.request.url.includes('script.google.com')) return;
  // On localhost: always go to network, no caching
  if (IS_LOCAL) return;

  // Strategy: Network First, falling back to cache.
  // This ensures the user ALWAYS gets the latest version if they have internet,
  // but still allows the app to work flawlessly offline.
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // If we get a valid response, clone it, update the cache, and return it.
        if (res && res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => {
        // If network fails (offline), fall back to the cache
        return caches.match(event.request).then(cached => {
            return cached || caches.match('/index.html');
        });
      })
  );
});
