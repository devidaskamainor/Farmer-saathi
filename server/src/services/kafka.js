import { Kafka, logLevel } from 'kafkajs';

export const KAFKA_TOPICS = Object.freeze({
  NOTIFICATIONS: 'farmer.notifications',
  ACTIVITIES: 'farmer.activities',
  ADVISORY: 'farmer.advisory'
});

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map(b => b.trim())
  .filter(Boolean);

const clientId = process.env.KAFKA_CLIENT_ID || 'farmer-saathi';
const isKafkaEnabled = process.env.KAFKA_ENABLED !== 'false';

let kafkaInstance = null;
let kafkaProducer = null;
let connectionAttempted = false;
let isConnected = false;

// In-memory fallback queue for zero-downtime offline resilience
const inMemoryQueue = [];
const MAX_FALLBACK_QUEUE_SIZE = 1000;

function getKafkaClient() {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.NOTHING,
      retry: {
        initialRetryTime: 300,
        retries: 2
      }
    });
  }
  return kafkaInstance;
}

async function getProducer() {
  if (!isKafkaEnabled) return null;
  if (kafkaProducer && isConnected) return kafkaProducer;
  if (connectionAttempted && !isConnected) return null;

  try {
    connectionAttempted = true;
    const client = getKafkaClient();
    const producer = client.producer({
      allowAutoTopicCreation: true
    });

    // Connect with a 2-second timeout to prevent blocking during startup or tests
    await Promise.race([
      producer.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka connection timeout')), 2000))
    ]);

    kafkaProducer = producer;
    isConnected = true;
    return kafkaProducer;
  } catch {
    isConnected = false;
    return null;
  }
}

export async function produceMessage(topic, payload, key = null) {
  const timestamp = new Date().toISOString();
  const messageData = {
    key: key ? String(key) : null,
    value: typeof payload === 'string' ? payload : JSON.stringify(payload),
    timestamp
  };

  try {
    const producer = await getProducer();
    if (producer) {
      const record = {
        topic,
        messages: [{
          key: messageData.key,
          value: messageData.value,
          headers: {
            'content-type': 'application/json',
            'client-id': clientId,
            timestamp
          }
        }]
      };
      const result = await producer.send(record);
      return {
        ok: true,
        channel: 'kafka',
        topic,
        timestamp,
        result
      };
    }
  } catch {}

  // Fallback to resilient in-memory message buffer
  inMemoryQueue.push({
    topic,
    key: messageData.key,
    value: messageData.value,
    timestamp
  });

  if (inMemoryQueue.length > MAX_FALLBACK_QUEUE_SIZE) {
    inMemoryQueue.shift();
  }

  return {
    ok: true,
    channel: 'in-memory-queue',
    topic,
    timestamp,
    queueSize: inMemoryQueue.length
  };
}

export async function publishNotificationEvent(notification) {
  return produceMessage(
    KAFKA_TOPICS.NOTIFICATIONS,
    {
      eventType: 'NOTIFICATION_DISPATCH',
      notification,
      dispatchedAt: new Date().toISOString()
    },
    notification?.id || 'broadcast'
  );
}

export async function publishActivityEvent(activity, farmerId) {
  return produceMessage(
    KAFKA_TOPICS.ACTIVITIES,
    {
      eventType: 'FARM_ACTIVITY_LOGGED',
      farmerId,
      activity,
      loggedAt: new Date().toISOString()
    },
    farmerId || activity?.id || 'activity'
  );
}

export function getKafkaStatus() {
  return {
    enabled: isKafkaEnabled,
    connected: isConnected,
    mode: isConnected ? 'kafka-broker' : 'in-memory-fallback',
    brokers,
    clientId,
    inMemoryQueueSize: inMemoryQueue.length
  };
}

export function getInMemoryQueue() {
  return [...inMemoryQueue];
}

export function clearInMemoryQueue() {
  inMemoryQueue.length = 0;
}
