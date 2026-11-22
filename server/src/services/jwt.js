import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'farmer-saathi-jwt-development-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '14d';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
    }
    return DEFAULT_SECRET;
  }
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_SECRET) {
    throw new Error('JWT_SECRET must not use the default development secret in production.');
  }
  return secret;
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
