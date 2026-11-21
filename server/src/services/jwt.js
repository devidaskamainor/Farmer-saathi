import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'farmer-saathi-jwt-development-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '14d';

export function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_SECRET;
}

export function signJwt(payload, options = {}) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRES_IN,
    ...options
  });
}

export function verifyJwt(token, options = {}) {
  if (!token || typeof token !== 'string') return null;
  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret, options);
  } catch (error) {
    return null;
  }
}

export function generateFarmerJwt(farmer) {
  if (!farmer) throw new Error('Farmer object is required to generate a JWT.');
  return signJwt({
    sub: farmer._id,
    email: farmer.email,
    role: 'farmer'
  });
}

export function parseBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
