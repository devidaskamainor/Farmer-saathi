import { api } from './api.js';

export async function fetchNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

export async function getFcmHealth() {
  const { data } = await api.get('/notifications/health');
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.post(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data;
}

export async function registerFcmToken(token) {
  const { data } = await api.post('/notifications/fcm-token', {
    token,
    deviceType: 'web'
  });
  return data;
}

export async function requestPushPermissionAndRegister() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { status: 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: 'denied' };
  }

  // Generate / retrieve web client token
  let token = localStorage.getItem('farmer_fcm_token');
  if (!token) {
    token = `web-fcm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    localStorage.setItem('farmer_fcm_token', token);
  }

  try {
    await registerFcmToken(token);
  } catch {
    // If offline or unauthenticated, local token is persisted
  }

  // Pop a test confirmation notification
  try {
    new Notification('🌾 Farmer Saathi Alerts Active', {
      body: 'You are now set up to receive instant festival, holiday, and crop feature updates!',
      icon: '/favicon.ico'
    });
  } catch {}

  return { status: 'granted', token };
}

export async function triggerHolidayAlert() {
  const { data } = await api.post('/notifications/trigger-holiday');
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && data?.notification) {
    try {
      new Notification(data.notification.title, {
        body: data.notification.body,
        icon: '/favicon.ico'
      });
    } catch {}
  }
  return data;
}

export async function triggerFeatureAlert() {
  const { data } = await api.post('/notifications/trigger-feature');
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && data?.notification) {
    try {
      new Notification(data.notification.title, {
        body: data.notification.body,
        icon: '/favicon.ico'
      });
    } catch {}
  }
  return data;
}

export async function sendTestNotification({ title, body, actionUrl } = {}) {
  const { data } = await api.post('/notifications/test-dispatch', { title, body, actionUrl });
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && data?.details?.notification) {
    try {
      new Notification(data.details.notification.title, {
        body: data.details.notification.body,
        icon: '/favicon.ico'
      });
    } catch {}
  }
  return data;
}
