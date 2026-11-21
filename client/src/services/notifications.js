import { api } from './api.js';

export async function fetchNotifications() {
  const { data } = await api.get('/notifications');
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

  return { status: 'granted', token };
}

export async function triggerHolidayAlert() {
  const { data } = await api.post('/notifications/trigger-holiday');
  return data;
}

export async function triggerFeatureAlert() {
  const { data } = await api.post('/notifications/trigger-feature');
  return data;
}
