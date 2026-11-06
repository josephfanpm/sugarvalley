// Offline shell for the installed web app. Network first for code and data (so updates land
// right away), cache first for art and fonts (they never change between versions).
const CACHE = 'sugar-valley-v3';
const SHELL = ['/game/', '/game/main.js', '/game/vendor/phaser.min.js', '/game/fonts/dotgothic16-400.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const cacheFirst = url.pathname.startsWith('/art/') || url.pathname.startsWith('/audio/') || url.pathname.startsWith('/game/fonts/') || url.pathname.startsWith('/game/icons/');
  if (cacheFirst) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })).catch(() => Response.error()));
    return;
  }
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || Response.error())));
});
