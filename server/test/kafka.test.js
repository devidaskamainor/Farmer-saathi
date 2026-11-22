import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  produceMessage,
  publishNotificationEvent,
  publishActivityEvent,
  getKafkaStatus,
  getInMemoryQueue,
  clearInMemoryQueue,
  KAFKA_TOPICS
} from '../src/services/kafka.js';

beforeEach(() => {
  clearInMemoryQueue();
});

test('getKafkaStatus returns configuration and mode metadata', () => {
  const status = getKafkaStatus();
  assert.equal(typeof status.enabled, 'boolean');
  assert.equal(typeof status.connected, 'boolean');
  assert.ok(['kafka-broker', 'in-memory-fallback'].includes(status.mode));
  assert.ok(Array.isArray(status.brokers));
  assert.equal(typeof status.clientId, 'string');
  assert.equal(typeof status.inMemoryQueueSize, 'number');
});

test('produceMessage queues message to in-memory fallback buffer when broker is offline', async () => {
  const result = await produceMessage(KAFKA_TOPICS.NOTIFICATIONS, { test: 'data' }, 'key-1');
  assert.equal(result.ok, true);
  assert.ok(['kafka', 'in-memory-queue'].includes(result.channel));
  assert.equal(result.topic, KAFKA_TOPICS.NOTIFICATIONS);
  assert.ok(result.timestamp);

  const queue = getInMemoryQueue();
  if (result.channel === 'in-memory-queue') {
    assert.equal(queue.length, 1);
    assert.equal(queue[0].key, 'key-1');
    assert.equal(JSON.parse(queue[0].value).test, 'data');
  }
});

test('publishNotificationEvent packages and queues notification dispatch event', async () => {
  const notification = {
    id: 'notif-123',
    title: 'Festival Alert',
    body: 'Happy Ugadi to all farmers!',
    type: 'holiday'
  };

  const result = await publishNotificationEvent(notification);
  assert.equal(result.ok, true);
  assert.equal(result.topic, KAFKA_TOPICS.NOTIFICATIONS);

  const queue = getInMemoryQueue();
  if (result.channel === 'in-memory-queue') {
    const item = queue.find(q => q.key === 'notif-123');
    assert.ok(item, 'Queued item should exist');
    const parsed = JSON.parse(item.value);
    assert.equal(parsed.eventType, 'NOTIFICATION_DISPATCH');
    assert.equal(parsed.notification.title, 'Festival Alert');
  }
});

test('publishActivityEvent packages and queues farm activity event', async () => {
  const activity = {
    id: 'act-456',
    crop: 'Tomato',
    eventType: 'sowing',
    eventDate: '2026-06-15'
  };

  const result = await publishActivityEvent(activity, 'farmer-789');
  assert.equal(result.ok, true);
  assert.equal(result.topic, KAFKA_TOPICS.ACTIVITIES);

  const queue = getInMemoryQueue();
  if (result.channel === 'in-memory-queue') {
    const item = queue.find(q => q.key === 'farmer-789');
    assert.ok(item, 'Queued item should exist');
    const parsed = JSON.parse(item.value);
    assert.equal(parsed.eventType, 'FARM_ACTIVITY_LOGGED');
    assert.equal(parsed.activity.crop, 'Tomato');
  }
});
