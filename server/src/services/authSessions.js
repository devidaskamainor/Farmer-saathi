import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'farmer_saathi_session';
if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(SESSION_COOKIE_NAME)) {
  throw new Error('SESSION_COOKIE_NAME must be a valid cookie name.');
}
export const SESSION_DURATION_DAYS = Math.min(Math.max(Number(process.env.SESSION_DURATION_DAYS) || 14, 1), 90);

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookieOptions() {
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(sameSite)) throw new Error('SESSION_COOKIE_SAME_SITE must be strict, lax, or none.');
  const secure = process.env.SESSION_COOKIE_SECURE === 'true' || (process.env.SESSION_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');
  if (sameSite === 'none' && !secure) throw new Error('SameSite=None session cookies require SESSION_COOKIE_SECURE=true.');
  return { httpOnly: true, secure, sameSite, path: '/' };
}

export function parseSessionCookie(header) {
  if (typeof header !== 'string') return '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return ''; }
  }
  return '';
}
