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


// FCM & Web Push Notification Handlers
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { notification: { title: 'Farmer Saathi Alert', body: event.data ? event.data.text() : '' } };
  }

  const title = data.notification?.title || data.title || '🌾 Farmer Saathi Notification';
  const options = {
    body: data.notification?.body || data.body || 'New agricultural advisory or festival update available.',
    icon: data.notification?.icon || data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.data?.click_action || data.data?.actionUrl || data.actionUrl || '/dashboard'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
