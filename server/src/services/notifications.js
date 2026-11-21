import { randomUUID } from 'node:crypto';
import { sendNotificationToTokens, sendNotificationToTopic } from './fcm.js';
import {
  detectActiveHolidayOrEvent,
  getUpcomingHolidaysAndEvents,
  RECENT_FEATURE_ANNOUNCEMENTS
} from './eventsAndHolidays.js';

// In-memory fallback stores for tests or environments without PostgreSQL
const memoryNotifications = [...RECENT_FEATURE_ANNOUNCEMENTS.map(item => ({
  id: randomUUID(),
  title: item.title,
  body: item.body,
  type: item.type,
  action_url: item.actionUrl,
  icon: item.icon || 'sparkles',
  created_at: new Date().toISOString()
}))];

const memoryTokens = new Map(); // userId -> Set<token>
const memoryUserReads = new Set(); // `${userId}:${notificationId}`

export async function saveFcmToken(pool, { userId, token, deviceType = 'web' }) {
  if (!token || typeof token !== 'string') {
    throw new Error('A valid FCM registration token is required.');
  }

  // Update memory store
  if (!memoryTokens.has(userId)) memoryTokens.set(userId, new Set());
  memoryTokens.get(userId).add(token);

  if (pool) {
    try {
      await pool.query(
        `insert into fcm_tokens (user_id, token, device_type, updated_at)
         values ($1, $2, $3, now())
         on conflict (token) do update
         set user_id = excluded.user_id, device_type = excluded.device_type, updated_at = now()`,
        [userId, token, deviceType]
      );
    } catch {
      // In-memory fallback is already populated
    }
  }

  return { saved: true, token, deviceType };
}

export async function removeFcmToken(pool, { userId, token }) {
  if (memoryTokens.has(userId)) {
    memoryTokens.get(userId).delete(token);
  }

  if (pool) {
    try {
      await pool.query(
        'delete from fcm_tokens where token = $1 or (user_id = $2 and token = $1)',
        [token, userId]
      );
    } catch {}
  }

  return { removed: true };
}

export async function getAllFcmTokens(pool, userId = null) {
  if (pool) {
    try {
      const query = userId
        ? 'select token from fcm_tokens where user_id = $1'
        : 'select token from fcm_tokens';
      const params = userId ? [userId] : [];
      const { rows } = await pool.query(query, params);
      if (rows.length > 0) return rows.map(r => r.token);
    } catch {}
  }

  if (userId) {
    return Array.from(memoryTokens.get(userId) || []);
  }

  const allTokens = new Set();
  for (const set of memoryTokens.values()) {
    for (const t of set) allTokens.add(t);
  }
  return Array.from(allTokens);
}

export async function getUserNotifications(pool, userId = null) {
  let dbRows = [];

  if (pool) {
    try {
      const { rows } = await pool.query(
        `select n.*,
          case when r.read_at is not null then true else false end as is_read
         from notifications n
         left join user_notification_reads r on r.notification_id = n.id and r.user_id = $1
         order by n.created_at desc limit 50`,
        [userId || randomUUID()]
      );
      dbRows = rows;
    } catch {}
  }

  let list;
  if (dbRows.length > 0) {
    list = dbRows.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      actionUrl: row.action_url,
      icon: row.icon,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at
    }));
  } else {
    // Return memory notifications
    list = memoryNotifications.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      actionUrl: row.action_url,
      icon: row.icon,
      isRead: userId ? memoryUserReads.has(`${userId}:${row.id}`) : false,
      createdAt: row.created_at
    }));
  }

  const unreadCount = list.filter(n => !n.isRead).length;
  return { notifications: list, unreadCount };
}

export async function markNotificationRead(pool, { userId, notificationId }) {
  if (!notificationId) return { updated: false };

  memoryUserReads.add(`${userId}:${notificationId}`);

  if (pool) {
    try {
      await pool.query(
        `insert into user_notification_reads (notification_id, user_id, read_at)
         values ($1, $2, now())
         on conflict (notification_id, user_id) do update set read_at = now()`,
        [notificationId, userId]
      );
    } catch {}
  }

  return { updated: true, notificationId };
}

export async function markAllNotificationsRead(pool, userId) {
  for (const n of memoryNotifications) {
    memoryUserReads.add(`${userId}:${n.id}`);
  }

  if (pool) {
    try {
      await pool.query(
        `insert into user_notification_reads (notification_id, user_id, read_at)
         select id, $1, now() from notifications
         on conflict (notification_id, user_id) do update set read_at = now()`,
        [userId]
      );
    } catch {}
  }

  return { updated: true };
}

export async function createAndBroadcastNotification(pool, {
  title,
  body,
  type = 'general',
  actionUrl = '/dashboard',
  icon = 'bell',
  topic = 'all_farmers'
}) {
  if (!title || !body) throw new Error('Title and body are required for a notification.');

  const notificationId = randomUUID();
  const newNotification = {
    id: notificationId,
    title,
    body,
    type,
    action_url: actionUrl,
    icon,
    created_at: new Date().toISOString()
  };

  // 1. Save to in-memory store
  memoryNotifications.unshift(newNotification);

  // 2. Save to database if available
  if (pool) {
    try {
      await pool.query(
        `insert into notifications (id, title, body, type, action_url, icon, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [newNotification.id, title, body, type, actionUrl, icon, newNotification.created_at]
      );
    } catch {}
  }

  // 3. Immediately dispatch FCM push notifications
  const registeredTokens = await getAllFcmTokens(pool);
  const tokenDispatch = await sendNotificationToTokens(registeredTokens, {
    title,
    body,
    data: { id: notificationId, type, actionUrl },
    icon
  });

  const topicDispatch = await sendNotificationToTopic(topic, {
    title,
    body,
    data: { id: notificationId, type, actionUrl },
    icon
  });

  return {
    success: true,
    notification: {
      id: notificationId,
      title,
      body,
      type,
      actionUrl,
      icon,
      createdAt: newNotification.created_at
    },
    fcm: {
      recipientsCount: registeredTokens.length,
      tokenDispatch,
      topicDispatch
    }
  };
}

export async function triggerHolidayNotification(pool, referenceDate = new Date()) {
  const holiday = detectActiveHolidayOrEvent(referenceDate);
  return createAndBroadcastNotification(pool, {
    title: holiday.title,
    body: holiday.body,
    type: holiday.type,
    actionUrl: holiday.actionUrl || '/dashboard',
    icon: holiday.type === 'holiday' ? 'party-popper' : 'calendar',
    topic: 'holidays'
  });
}

export async function triggerFeatureNotification(pool, {
  title = '🚀 New Feature: Instant Holiday & Event Alerts via FCM',
  body = 'You will now immediately receive live updates on festive dates, sowing seasons, and crop planning guidance!',
  actionUrl = '/dashboard',
  icon = 'sparkles'
} = {}) {
  return createAndBroadcastNotification(pool, {
    title,
    body,
    type: 'feature',
    actionUrl,
    icon,
    topic: 'new_features'
  });
}
