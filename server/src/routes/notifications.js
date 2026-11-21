import { Router } from 'express';
import { getDatabasePool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { getFcmHealth } from '../services/fcm.js';
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

// FCM Health / configuration status
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    fcm: getFcmHealth(),
    timestamp: new Date().toISOString()
  });
});

// Upcoming holidays & agricultural events catalog
router.get('/holidays', (_req, res) => {
  const upcoming = getUpcomingHolidaysAndEvents(new Date(), 90);
  res.json({ upcoming });
});

// Register FCM Device Registration Token (requires auth)
router.post('/fcm-token', requireAuth, async (req, res, next) => {
  try {
    const { token, deviceType } = req.body || {};
    if (!token) return res.status(400).json({ message: 'Device token is required.' });
    const result = await saveFcmToken(getDatabasePool(), {
      userId: req.authUser.id,
      token,
      deviceType: deviceType || 'web'
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Remove FCM Device Registration Token (requires auth)
router.delete('/fcm-token', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: 'Token is required.' });
    const result = await removeFcmToken(getDatabasePool(), {
      userId: req.authUser.id,
      token
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Mark single notification as read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const result = await markNotificationRead(getDatabasePool(), {
      userId: req.authUser.id,
      notificationId: req.params.id
    });
    res.json(result);
  } catch (error) { next(error); }
});

// Mark all notifications as read
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead(getDatabasePool(), req.authUser.id);
    res.json(result);
  } catch (error) { next(error); }
});

// Broadcast a new notification immediately via FCM (feature, holiday, event, or custom)
router.post('/broadcast', requireAuth, async (req, res, next) => {
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
router.post('/trigger-holiday', requireAuth, async (req, res, next) => {
  try {
    const result = await triggerHolidayNotification(getDatabasePool());
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Trigger immediate New Feature announcement via FCM
router.post('/trigger-feature', requireAuth, async (req, res, next) => {
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

export default router;
