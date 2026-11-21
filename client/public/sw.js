const CACHE_NAME = 'farmer-saathi-shell-v1';
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    fetch('/index.html')
      .then(response => response.text())
      .then(html => {
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map(([, path]) => new URL(path, self.location.origin))
          .filter(url => url.origin === self.location.origin && /\.(?:js|css|woff2?)$/i.test(url.pathname))
          .map(url => url.pathname + url.search);
        return caches.open(CACHE_NAME).then(cache => cache.addAll([...new Set([...SHELL_URLS, ...assets])]));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('farmer-saathi-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
      }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })));
  }
});
