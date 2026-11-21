import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmailAddress,
  validateSocialAccount,
  isDisposableDomain,
  isFakeEmailPattern
} from '../src/services/emailValidator.js';

test('isDisposableDomain identifies known throwaway and temporary domains', () => {
  assert.equal(isDisposableDomain('mailinator.com'), true);
  assert.equal(isDisposableDomain('tempmail.com'), true);
  assert.equal(isDisposableDomain('10minutemail.com'), true);
  assert.equal(isDisposableDomain('guerrillamail.com'), true);
  assert.equal(isDisposableDomain('yopmail.com'), true);
  assert.equal(isDisposableDomain('sub.mailinator.com'), true);

  assert.equal(isDisposableDomain('gmail.com'), false);
  assert.equal(isDisposableDomain('yahoo.com'), false);
  assert.equal(isDisposableDomain('outlook.com'), false);
});

test('isFakeEmailPattern detects obvious dummy, placeholder, and repetitive email patterns', () => {
  assert.equal(isFakeEmailPattern('test', 'test.com'), true);
  assert.equal(isFakeEmailPattern('fake', 'gmail.com'), true);
  assert.equal(isFakeEmailPattern('dummy', 'yahoo.com'), true);
  assert.equal(isFakeEmailPattern('asdf', 'asdf.com'), true);
  assert.equal(isFakeEmailPattern('test123', 'gmail.com'), true);
  assert.equal(isFakeEmailPattern('aaaa', 'gmail.com'), true);
  assert.equal(isFakeEmailPattern('11111', 'gmail.com'), true);

  assert.equal(isFakeEmailPattern('devdevudevidaskaminor', 'gmail.com'), false);
  assert.equal(isFakeEmailPattern('ramesh.patil', 'gmail.com'), false);
  assert.equal(isFakeEmailPattern('suresh_farmer', 'yahoo.in'), false);
});

test('validateEmailAddress accepts valid active email addresses', () => {
  assert.equal(
    validateEmailAddress('devdevudevidaskaminor@gmail.com'),
    'devdevudevidaskaminor@gmail.com'
  );
  assert.equal(
    validateEmailAddress(' RAMESH.KUMAR@OUTLOOK.COM '),
    'ramesh.kumar@outlook.com'
  );
  assert.equal(
    validateEmailAddress('farmer.sita@karnataka.gov.in'),
    'farmer.sita@karnataka.gov.in'
  );
});

test('validateEmailAddress rejects fake, dummy, and disposable emails', () => {
  // Disposable
  assert.throws(() => validateEmailAddress('user@mailinator.com'), {
    status: 400,
    message: /Disposable and temporary email/
  });
  assert.throws(() => validateEmailAddress('farmer@tempmail.com'), {
    status: 400,
    message: /Disposable and temporary email/
  });

  // Dummy / test
  assert.throws(() => validateEmailAddress('test@test.com'), {
    status: 400,
    message: /real, active email/
  });
  assert.throws(() => validateEmailAddress('fake@gmail.com'), {
    status: 400,
    message: /real, active email/
  });
  assert.throws(() => validateEmailAddress('asdf@asdf.com'), {
    status: 400,
    message: /real, active email/
  });

  // Invalid syntax / TLD
  assert.throws(() => validateEmailAddress('notanemail'), {
    status: 400,
    message: /valid email address/
  });
  assert.throws(() => validateEmailAddress('user@site.fake'), {
    status: 400,
    message: /top-level extension is not valid/
  });
});

test('validateSocialAccount validates Google and Facebook accounts and blocks fake credentials', () => {
  // Valid Google
  assert.equal(
    validateSocialAccount('google', { email: 'devdevudevidaskaminor@gmail.com' }),
    'devdevudevidaskaminor@gmail.com'
  );

  // Valid Facebook
  assert.equal(
    validateSocialAccount('facebook', { email: 'farmer.contact@gmail.com' }),
    'farmer.contact@gmail.com'
  );

  // Google with @facebook.com rejected
  assert.throws(() => validateSocialAccount('google', { email: 'myuser@facebook.com' }), {
    status: 400,
    message: /Google account or Gmail/
  });

  // Facebook with retired @facebook.com rejected
  assert.throws(() => validateSocialAccount('facebook', { email: 'dummy@facebook.com' }), {
    status: 400,
    message: /Retired @facebook.com/
  });

  // Fake Facebook ID rejected
  assert.throws(() => validateSocialAccount('facebook', { email: 'real.user@gmail.com', id: 'fake' }), {
    status: 400,
    message: /Invalid Facebook account ID/
  });
  assert.throws(() => validateSocialAccount('facebook', { email: 'real.user@gmail.com', id: '000000' }), {
    status: 400,
    message: /Invalid Facebook account ID/
  });

  // Unsupported provider rejected
  assert.throws(() => validateSocialAccount('twitter', { email: 'user@gmail.com' }), {
    status: 400,
    message: /Supported social providers/
  });
});
