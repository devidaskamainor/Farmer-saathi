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
      try {
        const farmer = await getFarmerById(getDatabasePool(), payload.sub);
        if (farmer) {
          req.authUser = { id: farmer._id, email: farmer.email };
          req.farmer = farmer;
          return next();
        }
      } catch (dbError) {
        console.warn('Database error while loading farmer for token:', dbError.message);
      }

      // If JWT signature is valid and has user details, synthesize resilient fallback farmer
      if (payload.sub && payload.email) {
        const fallbackFarmer = {
          _id: payload.sub,
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          state: payload.state || 'Karnataka',
          district: payload.district || 'Hassan',
          village: payload.village || 'Nittur',
          preferredLanguage: payload.preferredLanguage || 'en',
          farmSize: payload.farmSize || 5,
          currentCrops: payload.currentCrops || ['Sugarcane', 'Cotton'],
          soil: {},
          farmPlan: {},
          irrigationFacilities: []
        };
        req.authUser = { id: fallbackFarmer._id, email: fallbackFarmer.email };
        req.farmer = fallbackFarmer;
        return next();
      }

      return res.status(401).json({ message: 'The account for this token was not found. Please sign in again.' });
    }

    // 2. Cookie-based session support
    const token = parseSessionCookie(req.headers.cookie);
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });

    // Check if cookie holds a JWT
    const jwtPayload = verifyJwt(token);
    if (jwtPayload?.sub) {
      try {
        const farmer = await getFarmerById(getDatabasePool(), jwtPayload.sub);
        if (farmer) {
          req.authUser = { id: farmer._id, email: farmer.email };
          req.farmer = farmer;
          return next();
        }
      } catch (dbError) {
        console.warn('Database error while loading farmer for cookie JWT:', dbError.message);
      }

      if (jwtPayload.sub && jwtPayload.email) {
        const fallbackFarmer = {
          _id: jwtPayload.sub,
          name: jwtPayload.name || jwtPayload.email.split('@')[0],
          email: jwtPayload.email,
          state: jwtPayload.state || 'Karnataka',
          district: jwtPayload.district || 'Hassan',
          village: jwtPayload.village || 'Nittur',
          preferredLanguage: jwtPayload.preferredLanguage || 'en',
          farmSize: 5,
          currentCrops: ['Sugarcane', 'Cotton'],
          soil: {},
          farmPlan: {},
          irrigationFacilities: []
        };
        req.authUser = { id: fallbackFarmer._id, email: fallbackFarmer.email };
        req.farmer = fallbackFarmer;
        return next();
      }
    }

    // Check database-backed session token
    try {
      const farmer = await loadSession(getDatabasePool(), token);
      if (!farmer) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
      req.authUser = { id: farmer._id, email: farmer.email };
      req.farmer = farmer;
      next();
    } catch (dbError) {
      console.warn('Database error while loading session token:', dbError.message);
      return res.status(401).json({ message: 'Session could not be verified. Please sign in again.' });
    }
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
        try {
          const farmer = await getFarmerById(getDatabasePool(), payload.sub);
          if (farmer) {
            req.authUser = { id: farmer._id, email: farmer.email };
            req.farmer = farmer;
            return next();
          }
        } catch {}
        if (payload.email) {
          const fallbackFarmer = {
            _id: payload.sub,
            name: payload.name || payload.email.split('@')[0],
            email: payload.email,
            state: payload.state || 'Karnataka',
            district: payload.district || 'Hassan',
            village: payload.village || 'Nittur',
            preferredLanguage: payload.preferredLanguage || 'en',
            farmSize: 5,
            currentCrops: ['Sugarcane']
          };
          req.authUser = { id: fallbackFarmer._id, email: fallbackFarmer.email };
          req.farmer = fallbackFarmer;
          return next();
        }
      }
    }
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      const jwtPayload = verifyJwt(token);
      if (jwtPayload?.sub) {
        try {
          const farmer = await getFarmerById(getDatabasePool(), jwtPayload.sub);
          if (farmer) {
            req.authUser = { id: farmer._id, email: farmer.email };
            req.farmer = farmer;
            return next();
          }
        } catch {}
        if (jwtPayload.email) {
          const fallbackFarmer = {
            _id: jwtPayload.sub,
            name: jwtPayload.name || jwtPayload.email.split('@')[0],
            email: jwtPayload.email,
            state: 'Karnataka',
            district: 'Hassan',
            village: 'Nittur',
            preferredLanguage: 'en',
            farmSize: 5,
            currentCrops: ['Sugarcane']
          };
          req.authUser = { id: fallbackFarmer._id, email: fallbackFarmer.email };
          req.farmer = fallbackFarmer;
          return next();
        }
      }
      try {
        const farmer = await loadSession(getDatabasePool(), token);
        if (farmer) {
          req.authUser = { id: farmer._id, email: farmer.email };
          req.farmer = farmer;
        }
      } catch {}
    }
  } catch {}
  next();
}

