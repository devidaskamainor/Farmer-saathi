import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFcmDispatchesForTest,
  getFcmHealth,
  getRecentFcmDispatches,
  sendNotificationToTokens,
  sendNotificationToTopic
} from '../src/services/fcm.js';

test('getFcmHealth reports mode and configuration status without throwing', () => {
  const health = getFcmHealth();
  assert.ok(health);
  assert.equal(typeof health.configured, 'boolean');
  assert.match(health.mode, /firebase-admin|in-memory-mock/);
});

test('sendNotificationToTokens gracefully sends and logs notifications to device tokens', async () => {
  clearFcmDispatchesForTest();
  const mockTokens = ['mock-fcm-token-1', 'mock-fcm-token-2'];

  const result = await sendNotificationToTokens(mockTokens, {
    title: '🌾 Makar Sankranti Greetings',
    body: 'Warm wishes to all farmers on the harvest festival!',
    data: { actionUrl: '/dashboard' }
  });

  assert.ok(result);
  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 0);

  const dispatches = getRecentFcmDispatches();
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].recipientCount, 2);
  assert.equal(dispatches[0].title, '🌾 Makar Sankranti Greetings');
});

test('sendNotificationToTopic broadcasts topic messages successfully', async () => {
  clearFcmDispatchesForTest();

  const result = await sendNotificationToTopic('all_farmers', {
    title: '🚀 New Feature: Instant Holiday Alerts',
    body: 'Receive notifications directly in your browser!',
    data: { actionUrl: '/dashboard' }
  });

  assert.ok(result.success);
  assert.ok(result.messageId);

  const dispatches = getRecentFcmDispatches();
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].type, 'topic');
  assert.equal(dispatches[0].topic, 'all_farmers');
});
