import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDatabasePool } from '../config/database.js';
import { getClientUrl } from '../config/urls.js';
import { requireAuth } from '../middleware/auth.js';
import {
  authenticateSocialAccount, createEmailVerification, createPasswordReset, deleteSession, loginAccount,
  registerAccount, resetPassword, validateEmailAddress, verifyEmail
} from '../services/auth.js';
import { parseSessionCookie, SESSION_COOKIE_NAME, sessionCookieOptions, SESSION_DURATION_DAYS } from '../services/authSessions.js';
import { HttpError } from '../utils/http.js';
import { supportedLanguages } from '../config/languages.js';
import {
  assertVerificationEmailConfigured, createVerificationLink, sendPasswordResetEmail, sendVerificationEmail
} from '../services/email.js';

const router = Router();
const passwordResetRequestMessage = 'If an account exists for that email, a password reset link will be sent.';
const passwordResetRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many password reset requests. Please try again later.' }
});
const passwordResetCompleteLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' }
});

router.post('/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const profile = validateProfile(body);
    assertVerificationEmailConfigured();
    const account = await registerAccount(getDatabasePool(), {
      email: body.email,
      password: body.password,
      profile
    });
    await sendVerificationEmail(account.email, account.verificationToken);
    res.status(201).json({ verificationRequired: true });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const account = await loginAccount(getDatabasePool(), req.body || {});
    setSessionCookie(res, account.token);
    res.json({ farmer: account.farmer });
  } catch (error) { next(error); }
});

router.post('/social', async (req, res, next) => {
  try {
    const { provider, email, name, preferredLanguage } = req.body || {};
    const result = await authenticateSocialAccount(getDatabasePool(), {
      provider,
      email,
      name,
      preferredLanguage
    });
    setSessionCookie(res, result.token);
    res.json({ farmer: result.farmer });
  } catch (error) { next(error); }
});

router.get('/session', requireAuth, (req, res) => res.json({ farmer: req.farmer }));

router.post('/password/forgot', passwordResetRequestLimit, async (req, res, next) => {
  try {
    const email = validateEmailAddress(req.body?.email);
    assertVerificationEmailConfigured();
    getClientUrl();
    const reset = await createPasswordReset(getDatabasePool(), email);
    res.json({ message: passwordResetRequestMessage });
    if (reset) {
      setImmediate(() => {
        sendPasswordResetEmail(reset.email, reset.token)
          .catch(() => console.error('Password reset email delivery failed.'));
      });
    }
  } catch (error) { next(error); }
});

router.post('/password/reset', passwordResetCompleteLimit, async (req, res, next) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(token)) {
      return res.status(400).json({ message: 'This password reset link is invalid or expired. Request a new link and try again.' });
    }
    const reset = await resetPassword(getDatabasePool(), token, password);
    if (!reset) {
      return res.status(400).json({ message: 'This password reset link is invalid or expired. Request a new link and try again.' });
    }
    clearSessionCookie(res);
    res.json({ message: 'Your password has been reset. Sign in with your new password.' });
  } catch (error) { next(error); }
});

router.post('/verification/resend', async (req, res, next) => {
  try {
    assertVerificationEmailConfigured();
    const details = await createEmailVerification(getDatabasePool(), req.body?.email || '');
    if (details) await sendVerificationEmail(details.email, details.token);
    res.json({ message: 'If the account needs verification, a new link has been sent.' });
  } catch (error) { next(error); }
});

router.get('/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(token)) {
    return res.status(400).type('text').send('This verification link is invalid or expired. Request a new link and try again.');
  }
  res.set('Cache-Control', 'no-store');
  res.redirect(303, createVerificationLink(token));
});

router.post('/verify', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(token)) {
      return res.status(400).json({ message: 'This verification link is invalid or expired. Request a new link and try again.' });
    }
    const result = await verifyEmail(getDatabasePool(), token);
    if (!result) return res.status(400).json({ message: 'This verification link is invalid or expired. Request a new link and try again.' });
    setSessionCookie(res, result.token);
    res.json({ farmer: result.farmer });
  } catch (error) { next(error); }
});

router.post('/logout', async (req, res, next) => {
  try {
    await deleteSession(getDatabasePool(), parseSessionCookie(req.headers.cookie));
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) { next(error); }
});

function validateProfile(body) {
  const allowed = new Set(['email', 'password', 'name', 'preferredLanguage', 'village', 'district', 'state', 'currentCrops']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw new HttpError(400, `The field '${key}' cannot be registered.`);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) throw new HttpError(400, 'Name must be between 1 and 100 characters.');
  const preferredLanguage = body.preferredLanguage || 'en';
  if (!supportedLanguages.has(preferredLanguage)) throw new HttpError(400, 'Choose a language from the supported list.');
  return {
    name,
    preferredLanguage,
    village: shortText(body.village, 'Village'),
    district: shortText(body.district, 'District'),
    state: shortText(body.state, 'State'),
    currentCrops: stringList(body.currentCrops, 'Current crops')
  };
}

function shortText(value, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > 100) throw new HttpError(400, `${label} must be 100 characters or fewer.`);
  return value.trim();
}

function stringList(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || item.length > 100)) {
    throw new HttpError(400, `${label} must be a list of up to 20 short names.`);
  }
  return value.map(item => item.trim()).filter(Boolean);
}

function setSessionCookie(res, token) {
  const options = sessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${options.path}`,
    `Max-Age=${SESSION_DURATION_DAYS * 24 * 60 * 60}`,
    'HttpOnly',
    `SameSite=${capitalize(options.sameSite)}`
  ];
  if (options.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const options = sessionCookieOptions();
  const parts = [`${SESSION_COOKIE_NAME}=`, `Path=${options.path}`, 'Max-Age=0', 'HttpOnly', `SameSite=${capitalize(options.sameSite)}`];
  if (options.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

export default router;
