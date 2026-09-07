/* =========================================================
   WATTRIX — service worker
   Offline is a feature here, not a nicety: people need this
   tool in basement car parks and at rural chargers.

   Strategy:
     HTML   network first, fall back to cache, then 404 page
     assets cache first, refreshed in the background
     fonts  stale while revalidate
   =======================================================*/
const VERSION = 'wattrix-v3.0.1';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const PRECACHE = [
  './',
  './index.html',
  './calculator.html',
  './use-cases.html',
  './about.html',
  './404.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/data.js',
  './assets/js/calculator.js',
  './assets/js/tour.js',
  './assets/js/home.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing; a single 404 would leave us with no
      // cache at all, so each file is added on its own.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never let analytics near the cache.
  if (/googletagmanager|google-analytics|googlesyndication|doubleclick/.test(url.hostname)) return;

  if (isFont(url)) {
    e.respondWith(
      caches.open(RUNTIME).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => { });
          return res;
        })
        .catch(() => caches.match(req)
          .then((hit) => hit || caches.match('./calculator.html'))
          .then((hit) => hit || caches.match('./404.html'))
          .then((hit) => hit || new Response(
            '<h1>Offline</h1><p>Wattrix has not cached this page yet.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          ))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => { });
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
