import { cert, initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let firebaseApp = null;
let messaging = null;
const recentDispatches = [];

function initFirebase() {
  if (messaging) return messaging;

  // In test runs without explicitly enabled live FCM, preserve offline mock mode
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_REAL_FCM_IN_TEST) {
    return null;
  }

  const existing = getApps().find(app => app.name === 'farmer-saathi');
  if (existing) {
    firebaseApp = existing;
    messaging = getMessaging(firebaseApp);
    return messaging;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  try {
    if (serviceAccountJson) {
      const credentials = typeof serviceAccountJson === 'string' && serviceAccountJson.trim().startsWith('{')
        ? JSON.parse(serviceAccountJson)
        : null;

      if (credentials) {
        firebaseApp = initializeApp({
          credential: cert(credentials)
        }, 'farmer-saathi');
        messaging = getMessaging(firebaseApp);
        console.info('Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT.');
        return messaging;
      }
    }

    if (projectId && clientEmail && privateKey) {
      firebaseApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      }, 'farmer-saathi');
      messaging = getMessaging(firebaseApp);
      console.info('Firebase Admin SDK initialized successfully via environment credentials.');
      return messaging;
    }
  } catch (error) {
    console.warn('Firebase Admin SDK could not initialize; running in resilient mock mode.', error.message);
  }

  return null;
}

function sanitizeDataPayload(data = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return sanitized;
}

export function getFcmHealth() {
  const msgr = messaging || initFirebase();
  const isConfigured = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  );

  return {
    configured: isConfigured && Boolean(msgr),
    mode: msgr ? 'firebase-admin' : 'in-memory-mock',
    projectId: process.env.FIREBASE_PROJECT_ID || 'not-set',
    recentDispatchCount: recentDispatches.length
  };
}

export async function sendNotificationToTokens(tokens = [], { title, body, data = {}, icon = '/favicon.ico' }) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, dispatches: 0 };
  }

  const sanitizedData = sanitizeDataPayload({
    ...data,
    click_action: data.actionUrl || '/dashboard',
    timestamp: new Date().toISOString()
  });

  const payload = {
    notification: { title, body },
    data: sanitizedData,
    webpush: {
      notification: {
        title,
        body,
        icon,
        badge: '/favicon.ico'
      },
      fcmOptions: {
        link: data.actionUrl || '/dashboard'
      }
    }
  };

  const msgr = messaging || initFirebase();

  if (msgr) {
    try {
      const response = await msgr.sendEachForMulticast({
        tokens,
        ...payload
      });

      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      recentDispatches.push({
        type: 'multicast',
        recipientCount: tokens.length,
        title,
        body,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        mode: 'firebase-admin',
        timestamp: new Date().toISOString()
      });

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        mode: 'firebase-admin'
      };
    } catch (error) {
      console.error('FCM Multicast error; falling back to logged dispatch.', error.message);
    }
  }

  // Resilient fallback (mock / dev mode)
  const dispatchRecord = {
    type: 'multicast',
    recipientCount: tokens.length,
    title,
    body,
    successCount: tokens.length,
    failureCount: 0,
    mode: 'in-memory-mock',
    timestamp: new Date().toISOString()
  };
  recentDispatches.push(dispatchRecord);
  return {
    successCount: tokens.length,
    failureCount: 0,
    mode: 'in-memory-mock'
  };
}

export async function sendNotificationToTopic(topic = 'all_farmers', { title, body, data = {}, icon = '/favicon.ico' }) {
  const sanitizedTopic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, '_');
  const sanitizedData = sanitizeDataPayload({
    ...data,
    click_action: data.actionUrl || '/dashboard',
    timestamp: new Date().toISOString()
  });

  const payload = {
    topic: sanitizedTopic,
    notification: { title, body },
    data: sanitizedData,
    webpush: {
      notification: {
        title,
        body,
        icon
      },
      fcmOptions: {
        link: data.actionUrl || '/dashboard'
      }
    }
  };

  const msgr = messaging || initFirebase();

  if (msgr) {
    try {
      const messageId = await msgr.send(payload);
      recentDispatches.push({
        type: 'topic',
        topic: sanitizedTopic,
        title,
        body,
        messageId,
        mode: 'firebase-admin',
        timestamp: new Date().toISOString()
      });
      return { success: true, messageId, mode: 'firebase-admin' };
    } catch (error) {
      console.error('FCM Topic dispatch error; falling back to logged dispatch.', error.message);
    }
  }

  // Resilient fallback (mock / dev mode)
  const mockId = `mock-fcm-topic-${Date.now()}`;
  recentDispatches.push({
    type: 'topic',
    topic: sanitizedTopic,
    title,
    body,
    messageId: mockId,
    mode: 'in-memory-mock',
    timestamp: new Date().toISOString()
  });
  return { success: true, messageId: mockId, mode: 'in-memory-mock' };
}

export function getRecentFcmDispatches() {
  return [...recentDispatches];
}

export function clearFcmDispatchesForTest() {
  recentDispatches.length = 0;
}
