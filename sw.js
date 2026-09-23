// Prayer Book service worker
// Bump CACHE_VERSION whenever prayer-book.html (or this file) changes,
// so returning visitors get the update instead of a stale cached copy.
var CACHE_VERSION = 'prayer-book-v1';
var SHELL = [
  './prayer-book.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_VERSION; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // App shell: same-origin files this app ships (HTML, manifest, icons).
  // Network-first, so an online visitor always gets the latest version;
  // fall back to cache when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./prayer-book.html');
        });
      })
    );
    return;
  }

  // Bible verse text: cache-first, since a verse read once never changes,
  // and this lets already-opened passages work fully offline.
  if (url.hostname === 'bible.helloao.org') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
          return res;
        }).catch(function () {
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});
