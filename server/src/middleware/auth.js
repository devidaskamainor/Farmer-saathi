import { getDatabasePool } from '../config/database.js';
import { loadSession } from '../services/auth.js';
import { getFarmerById } from '../services/farmerProfiles.js';
import { parseSessionCookie } from '../services/authSessions.js';
import { parseBearerToken, verifyJwt } from '../services/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    // 1. Authorization: Bearer <JWT> header support
    const bearerToken = parseBearerToken(req.headers.authorization);
    if (bearerToken) {
      const payload = verifyJwt(bearerToken);
      if (!payload || !payload.sub) {
        return res.status(401).json({ message: 'Your authorization token is invalid or has expired. Please sign in again.' });
      }
      const farmer = await getFarmerById(getDatabasePool(), payload.sub);
      if (!farmer) {
        return res.status(401).json({ message: 'The account for this token was not found. Please sign in again.' });
      }
      req.authUser = { id: farmer._id, email: farmer.email };
      req.farmer = farmer;
      return next();
    }

    // 2. Cookie-based session support
    const token = parseSessionCookie(req.headers.cookie);
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });

    // Check if cookie holds a JWT
    const jwtPayload = verifyJwt(token);
    if (jwtPayload?.sub) {
      const farmer = await getFarmerById(getDatabasePool(), jwtPayload.sub);
      if (farmer) {
        req.authUser = { id: farmer._id, email: farmer.email };
        req.farmer = farmer;
        return next();
      }
    }

    // Check database-backed session token
    const farmer = await loadSession(getDatabasePool(), token);
    if (!farmer) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.authUser = { id: farmer._id, email: farmer.email };
    req.farmer = farmer;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const bearerToken = parseBearerToken(req.headers.authorization);
    if (bearerToken) {
      const payload = verifyJwt(bearerToken);
      if (payload?.sub) {
        const farmer = await getFarmerById(getDatabasePool(), payload.sub);
        if (farmer) {
          req.authUser = { id: farmer._id, email: farmer.email };
          req.farmer = farmer;
          return next();
        }
      }
    }
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      const jwtPayload = verifyJwt(token);
      if (jwtPayload?.sub) {
        const farmer = await getFarmerById(getDatabasePool(), jwtPayload.sub);
        if (farmer) {
          req.authUser = { id: farmer._id, email: farmer.email };
          req.farmer = farmer;
          return next();
        }
      }
      const farmer = await loadSession(getDatabasePool(), token);
      if (farmer) {
        req.authUser = { id: farmer._id, email: farmer.email };
        req.farmer = farmer;
      }
    }
  } catch {}
  next();
}

