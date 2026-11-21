import { getDatabasePool } from '../config/database.js';
import { loadSession } from '../services/auth.js';
import { parseSessionCookie } from '../services/authSessions.js';

export async function requireAuth(req, res, next) {
  try {
    const token = parseSessionCookie(req.headers.cookie);
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const farmer = await loadSession(getDatabasePool(), token);
    if (!farmer) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.authUser = { id: farmer._id, email: farmer.email };
    req.farmer = farmer;
    next();
  } catch (error) {
    next(error);
  }
}
