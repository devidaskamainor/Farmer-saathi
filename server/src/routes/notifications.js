import { Router } from 'express';
import { getDatabasePool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { getFcmHealth, getRecentFcmDispatches } from '../services/fcm.js';
import { getUpcomingHolidaysAndEvents } from '../services/eventsAndHolidays.js';
import {
  createAndBroadcastNotification,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeFcmToken,
  saveFcmToken,
  triggerFeatureNotification,
  triggerHolidayNotification
} from '../services/notifications.js';

const router = Router();

// Public / auth-optional: Fetch notifications
router.get('/', async (req, res, next) => {
  try {
    const userId = req.authUser?.id || null;
    const result = await getUserNotifications(getDatabasePool(), userId);
    res.json(result);
  } catch (error) { next(error); }
});

// FCM Health & configuration status
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    fcm: getFcmHealth(),
    recentDispatches: getRecentFcmDispatches().slice(-10),
    timestamp: new Date().toISOString()
  });
});

// Upcoming holidays & agricultural events catalog
router.get('/holidays', (_req, res) => {
  const upcoming = getUpcomingHolidaysAndEvents(new Date(), 90);
  res.json({ upcoming });
});

// Register FCM Device Registration Token
router.post('/fcm-token', async (req, res, next) => {
  try {
    const { token, deviceType } = req.body || {};
    if (!token) return res.status(400).json({ message: 'Device token is required.' });
    const userId = req.authUser?.id || 'anonymous-device';
    const result = await saveFcmToken(getDatabasePool(), {
      userId,
      token,
      deviceType: deviceType || 'web'
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Remove FCM Device Registration Token
router.delete('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: 'Token is required.' });
    const userId = req.authUser?.id || 'anonymous-device';
    const result = await removeFcmToken(getDatabasePool(), {
      userId,
      token
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Mark single notification as read (optional auth)
router.post('/:id/read', async (req, res, next) => {
  try {
    const userId = req.authUser?.id || 'anonymous-device';
    const result = await markNotificationRead(getDatabasePool(), {
      userId,
      notificationId: req.params.id
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Mark all notifications as read (optional auth)
router.post('/read-all', async (req, res, next) => {
  try {
    const userId = req.authUser?.id || 'anonymous-device';
    const result = await markAllNotificationsRead(getDatabasePool(), userId);
    res.json(result);
  } catch (error) { next(error); }
});

// Broadcast a new notification immediately via FCM
router.post('/broadcast', async (req, res, next) => {
  try {
    const { title, body, type, actionUrl, icon, topic } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required.' });
    }
    const result = await createAndBroadcastNotification(getDatabasePool(), {
      title,
      body,
      type: type || 'general',
      actionUrl: actionUrl || '/dashboard',
      icon: icon || 'bell',
      topic: topic || 'all_farmers'
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Trigger immediate Holiday / Special Event alert via FCM
router.post('/trigger-holiday', async (req, res, next) => {
  try {
    const result = await triggerHolidayNotification(getDatabasePool());
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Trigger immediate New Feature announcement via FCM
router.post('/trigger-feature', async (req, res, next) => {
  try {
    const { title, body, actionUrl } = req.body || {};
    const result = await triggerFeatureNotification(getDatabasePool(), {
      title,
      body,
      actionUrl
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Test dispatch endpoint: verifies live FCM connectivity and sends test push notification
router.post('/test-dispatch', async (req, res, next) => {
  try {
    const {
      title = '🌾 Test Notification: Farmer Saathi FCM is Active!',
      body = 'Your Firebase Cloud Messaging push service is successfully connected and delivering live notifications.',
      actionUrl = '/dashboard',
      topic = 'all_farmers'
    } = req.body || {};

    const result = await createAndBroadcastNotification(getDatabasePool(), {
      title,
      body,
      type: 'test',
      actionUrl,
      icon: 'sparkles',
      topic
    });

    res.status(200).json({
      success: true,
      message: 'Test notification dispatched successfully via FCM.',
      health: getFcmHealth(),
      details: result
    });
  } catch (error) { next(error); }
});

export default router;
