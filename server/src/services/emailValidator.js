import { HttpError } from '../utils/http.js';

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamailblock.com',
  '10minutemail.com', '10minutemail.net', '10minmail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com',
  'temp-mail.com', 'tempail.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
  'nomail.xl.cx', 'throwawaymail.com', 'trashmail.com', 'trashmail.net', 'trashmail.org', 'trashmail.me', 'sharklasers.com',
  'dispostable.com', 'getairmail.com', 'fakemailgenerator.com', 'mohmal.com', 'mohmal.in', 'crazymailing.com', 'mytemp.email',
  'generator.email', 'maildrop.cc', 'inboxkitten.com', 'nada.ltd', 'getnada.com', 'burnermail.io', 'discard.email',
  'tempr.email', 'fake.com', 'fakeemail.com', 'fakemail.com', 'spamgourmet.com', '0-mail.com', 'anonaddy.me', 'fakeinbox.com',
  'emailondeck.com', 'throwaway.email', 'burneremail.com', 'tmail.ws', 'minuteinbox.com', 'fastmail.fm', 'mytempemail.com',
  'dropmail.me', 'armyspy.com', 'cuvox.de', 'dayrep.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com',
  'superrito.com', 'teleworm.us', 'tinypm.com', 'mytrashmail.com', 'binkmail.com', 'safetymail.info', 'trashymail.com'
]);

const DUMMY_LOCAL_PARTS = new Set([
  'test', 'testing', 'tester', 'test1', 'test2', 'test123',
  'fake', 'fakeemail', 'fakemail', 'fakeuser', 'dummy', 'dummyemail', 'dummyuser',
  'asdf', 'asdfgh', 'asdfghjkl', 'qwerty', 'zxcvbnm',
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '0000', '00000',
  'abc', 'abcd', 'xyz', 'aaa', 'bbb', 'ccc', 'xxx', 'zzz',
  'admin', 'administrator', 'root', 'user', 'username', 'someone', 'nobody', 'noone',
  'sample', 'placeholder', 'temp', 'temporary', 'throwaway', 'burner',
  'noreply', 'no-reply', 'dontreply', 'donotreply', 'example', 'demo'
]);

const FAKE_TLDS = new Set(['fake', 'dummy', 'invalid', 'local', 'localhost']);

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isDisposableDomain(domain) {
  const normalized = String(domain || '').trim().toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.has(normalized)) return true;
  // Check multi-level subdomains, e.g. abc.mailinator.com
  const parts = normalized.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (DISPOSABLE_EMAIL_DOMAINS.has(parentDomain)) return true;
  }
  return false;
}

export function isFakeEmailPattern(localPart, domain) {
  const lp = String(localPart || '').trim().toLowerCase();
  const dom = String(domain || '').trim().toLowerCase();
  const domainBase = dom.split('.')[0];

  // Obvious dummy words
  if (DUMMY_LOCAL_PARTS.has(lp)) return true;

  // Pattern matches like fake123, test456, dummy01
  if (/^(fake|dummy|test|tester|asdf|sample|placeholder|temp)[0-9]*$/i.test(lp)) return true;

  // Local part identical to base domain (test@test.com, fake@fake.com, asdf@asdf.com)
  if (lp === domainBase && (DUMMY_LOCAL_PARTS.has(lp) || lp.length < 5)) return true;

  // Repeated single character like aaaaaa or 111111
  if (/^(.)\1{3,}$/.test(lp)) return true;

  // Domain itself is a dummy name
  if (['test.com', 'fake.com', 'dummy.com', 'fakemail.com', 'example.fake'].includes(dom)) return true;

  return false;
}

export function validateEmailAddress(email, { allowTestEnvironment = true } = {}) {
  const normalizedEmail = normalizeEmail(email);

  // RFC basic pattern check
  if (!normalizedEmail || normalizedEmail.length > 254) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);

  if (localPart.length > 64 || !domain || domain.length > 253) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  // Consecutive dots or invalid boundaries
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    throw new HttpError(400, 'Enter a valid email domain (e.g., example@domain.com).');
  }

  const tld = domainParts[domainParts.length - 1];
  // TLD must be alphabetic and at least 2 chars
  if (!/^[a-zA-Z]{2,}$/.test(tld)) {
    throw new HttpError(400, 'Enter an email with a valid top-level domain.');
  }

  // Fake or reserved internal TLDs
  if (FAKE_TLDS.has(tld)) {
    throw new HttpError(400, 'The email domain top-level extension is not valid.');
  }

  // Handle .test domain: allow example.test for test suites, reject otherwise
  if (tld === 'test' && domain !== 'example.test' && (!allowTestEnvironment || process.env.NODE_ENV !== 'test')) {
    throw new HttpError(400, 'Test email addresses are not allowed.');
  }

  // Disposable email check
  if (isDisposableDomain(domain)) {
    throw new HttpError(400, 'Disposable and temporary email addresses are not allowed. Please enter an active, personal email.');
  }

  // Fake / dummy pattern check
  if (isFakeEmailPattern(localPart, domain)) {
    throw new HttpError(400, 'Please enter a real, active email address. Test or dummy emails are not allowed.');
  }

  return normalizedEmail;
}

export function validateSocialAccount(provider, { email, id }) {
  const normProvider = String(provider || '').trim().toLowerCase();
  if (!['google', 'facebook'].includes(normProvider)) {
    throw new HttpError(400, 'Supported social providers are Google and Facebook.');
  }

  const normalized = normalizeEmail(email);
  const domain = normalized.split('@')[1];

  if (normProvider === 'google' && (domain === 'facebook.com' || domain === 'fb.com')) {
    throw new HttpError(400, 'Please sign in with a valid Google account or Gmail address.');
  }

  if (normProvider === 'facebook' && (domain === 'facebook.com' || domain === 'fb.com')) {
    throw new HttpError(400, 'Retired @facebook.com email addresses cannot be used. Please use the real email linked to your Facebook account.');
  }

  const normalizedEmail = validateEmailAddress(email);

  if (normProvider === 'facebook' && id) {
    const cleanId = String(id).trim().toLowerCase();
    if (['fake', 'dummy', 'test', 'asdf', '000000', '12345'].includes(cleanId) || /^([0-9])\1{5,}$/.test(cleanId)) {
      throw new HttpError(400, 'Invalid Facebook account ID.');
    }
  }

  return normalizedEmail;
}
