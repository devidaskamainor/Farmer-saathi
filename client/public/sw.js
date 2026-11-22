const CACHE_NAME = 'farmer-saathi-shell-v2';
const SHELL_URLS = ['/', '/index.html'];

// Pre-cache essential app shell assets safely
self.addEventListener('install', event => {
  event.waitUntil(
    fetch('/index.html')
      .then(response => {
        if (!response.ok) throw new Error('Network response not ok');
        return response.text();
      })
      .then(async html => {
        const assets = [];
        const matches = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);
        for (const match of matches) {
          try {
            const url = new URL(match[1], self.location.origin);
            if (url.origin === self.location.origin && /\.(?:js|css|woff2?|svg|png|ico)$/i.test(url.pathname)) {
              assets.push(url.pathname);
            }
          } catch {}
        }

        const cache = await caches.open(CACHE_NAME);
        const uniqueUrls = [...new Set([...SHELL_URLS, ...assets])];

        // Safely cache each asset individually so one missing asset never fails the installation
        await Promise.all(
          uniqueUrls.map(url =>
            fetch(url, { cache: 'no-cache' })
              .then(res => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => {})
          )
        );
      })
      .catch(err => {
        console.warn('App-shell offline caching notice:', err?.message || err);
      })
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('farmer-saathi-shell-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Resilient network-first for navigation, cache-first for static assets with safe offline fallbacks
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept API endpoints or external third-party requests
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  // SPA navigation handling
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - Farmer Saathi</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:2rem;"><h2>🌾 Farmer Saathi</h2><p>You appear to be offline. Reconnect to the internet to load updated farming advice.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Static assets: cache-first with safe network fallback
  if (['script', 'style', 'font', 'image'].includes(request.destination) || /\.(?:js|css|woff2?|svg|png|ico)$/i.test(requestUrl.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => {
            return new Response('', { status: 408, statusText: 'Offline asset not in cache' });
          });
      })
    );
  }
});

// FCM & Web Push Notification Handler
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { notification: { title: 'Farmer Saathi Alert', body: event.data ? event.data.text() : '' } };
  }

  const title = data.notification?.title || data.title || '🌾 Farmer Saathi Notification';
  const options = {
    body: data.notification?.body || data.body || 'New agricultural advisory or seasonal milestone update.',
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
