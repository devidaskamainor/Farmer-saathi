// @ts-nocheck
/// <reference no-default-lib="true"/>
/// <reference lib="es2022" />
/// <reference lib="webworker" />
/* eslint-env serviceworker */

// Firebase Cloud Messaging Service Worker
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { notification: { title: 'Farmer Saathi Alert', body: event.data ? event.data.text() : '' } };
  }

  const title = data.notification?.title || data.title || '🌾 Farmer Saathi Notification';
  const options = {
    body: data.notification?.body || data.body || 'New agricultural advisory or event update available.',
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
