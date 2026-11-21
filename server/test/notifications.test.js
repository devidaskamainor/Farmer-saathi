import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectActiveHolidayOrEvent,
  getUpcomingHolidaysAndEvents,
  INDIAN_HOLIDAYS_AND_EVENTS,
  RECENT_FEATURE_ANNOUNCEMENTS
} from '../src/services/eventsAndHolidays.js';
import {
  createAndBroadcastNotification,
  getAllFcmTokens,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeFcmToken,
  saveFcmToken,
  triggerFeatureNotification,
  triggerHolidayNotification
} from '../src/services/notifications.js';

test('Indian holidays catalog includes major festivals and seasonal milestones', () => {
  assert.ok(INDIAN_HOLIDAYS_AND_EVENTS.length >= 8);
  const keys = INDIAN_HOLIDAYS_AND_EVENTS.map(item => item.key);
  assert.ok(keys.includes('makar_sankranti'));
  assert.ok(keys.includes('republic_day'));
  assert.ok(keys.includes('baisakhi'));
  assert.ok(keys.includes('independence_day'));
  assert.ok(keys.includes('kisan_diwas'));
});

test('detectActiveHolidayOrEvent identifies the active or upcoming event for a given date', () => {
  const makarSankrantiDate = new Date(2026, 0, 14); // Jan 14
  const detected = detectActiveHolidayOrEvent(makarSankrantiDate);
  assert.ok(detected);
  assert.equal(detected.key, 'makar_sankranti');
  assert.match(detected.title, /Makar Sankranti/i);
});

test('getUpcomingHolidaysAndEvents returns sorted events within time window', () => {
  const upcoming = getUpcomingHolidaysAndEvents(new Date(2026, 0, 1), 60);
  assert.ok(Array.isArray(upcoming));
  assert.ok(upcoming.length > 0);
  assert.ok(upcoming[0].daysUntil >= 0);
});

test('saveFcmToken and getAllFcmTokens record device tokens with fallback', async () => {
  const userId = 'farmer-test-uuid-1';
  const token = 'fcm-device-token-abc-123';

  await saveFcmToken(null, { userId, token, deviceType: 'web' });
  const userTokens = await getAllFcmTokens(null, userId);
  assert.ok(userTokens.includes(token));

  await removeFcmToken(null, { userId, token });
  const updatedTokens = await getAllFcmTokens(null, userId);
  assert.ok(!updatedTokens.includes(token));
});

test('createAndBroadcastNotification dispatches notification and updates notification lists', async () => {
  const result = await createAndBroadcastNotification(null, {
    title: '🌾 Baisakhi Special Advisory',
    body: 'Check your harvest timing for wheat.',
    type: 'holiday',
    actionUrl: '/markets'
  });

  assert.ok(result.success);
  assert.equal(result.notification.title, '🌾 Baisakhi Special Advisory');

  const { notifications, unreadCount } = await getUserNotifications(null, 'farmer-test-uuid-2');
  assert.ok(notifications.length > 0);
  const found = notifications.find(n => n.id === result.notification.id);
  assert.ok(found);
  assert.equal(found.title, '🌾 Baisakhi Special Advisory');
  assert.equal(found.isRead, false);

  // Mark single as read
  await markNotificationRead(null, { userId: 'farmer-test-uuid-2', notificationId: found.id });
  const afterRead = await getUserNotifications(null, 'farmer-test-uuid-2');
  const readItem = afterRead.notifications.find(n => n.id === found.id);
  assert.equal(readItem.isRead, true);

  // Mark all as read
  await markAllNotificationsRead(null, 'farmer-test-uuid-2');
  const afterAllRead = await getUserNotifications(null, 'farmer-test-uuid-2');
  assert.equal(afterAllRead.unreadCount, 0);
});

test('triggerHolidayNotification and triggerFeatureNotification broadcast immediately', async () => {
  const holidayResult = await triggerHolidayNotification(null, new Date(2026, 0, 26)); // Republic Day
  assert.ok(holidayResult.success);
  assert.match(holidayResult.notification.title, /Republic Day/i);

  const featureResult = await triggerFeatureNotification(null, {
    title: '🚀 New Feature: AI Pest Diagnosis',
    body: 'Upload crop leaf photos for instant disease detection.'
  });
  assert.ok(featureResult.success);
  assert.match(featureResult.notification.title, /AI Pest Diagnosis/i);
});
