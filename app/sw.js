// Offline cache for RMD Studio Desk. The app shell is served from the cache
// and refreshed in the background; sync calls always go to the network.
const CACHE = 'studio-desk-0.3.0';
const FONTS = ['bricolage-grotesque-latin-600', 'bricolage-grotesque-latin-700', 'ibm-plex-sans-latin-400', 'ibm-plex-sans-latin-500',
  'ibm-plex-sans-latin-600', 'ibm-plex-mono-latin-400', 'ibm-plex-mono-latin-600'].map((f) => `fonts/${f}-normal.woff2`);
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/qrcode.js', ...FONTS];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('studio-desk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { event.waitUntil(fresh); return cached; }
      const res = await fresh;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});
