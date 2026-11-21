import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeNeonSslMode } from '../src/config/postgresConnection.js';
import {
  assertVerificationEmailConfigured, createPasswordResetLink, createVerificationLink, getVerificationEmailStatus
} from '../src/services/email.js';

test('Neon legacy SSL modes are normalized to full certificate and hostname verification', () => {
  const normalized = new URL(normalizeNeonSslMode(
    'postgresql://farmer:example-password@ep-test.neon.tech/farmer?sslmode=require&channel_binding=require'
  ));

  assert.equal(normalized.searchParams.get('sslmode'), 'verify-full');
  assert.equal(normalized.searchParams.get('channel_binding'), 'require');
  assert.equal(normalized.username, 'farmer');
  assert.equal(normalized.password, 'example-password');
});

test('non-Neon connection strings keep their configured SSL mode', () => {
  const normalized = new URL(normalizeNeonSslMode(
    'postgresql://farmer:example-password@db.example.com/farmer?sslmode=require'
  ));

  assert.equal(normalized.searchParams.get('sslmode'), 'require');
});

test('verification links target the configured frontend page instead of the API', () => {
  const previousClientUrl = process.env.CLIENT_URL;
  const previousApiUrl = process.env.API_PUBLIC_URL;
  try {
    process.env.CLIENT_URL = 'https://farmer.example.test';
    process.env.API_PUBLIC_URL = 'https://api.example.test';
    const url = new URL(createVerificationLink('test-verification-token'));

    assert.equal(url.origin, 'https://farmer.example.test');
    assert.equal(url.pathname, '/verify-email');
    assert.equal(url.searchParams.get('token'), 'test-verification-token');
    assert.doesNotMatch(url.toString(), /api\.example\.test/);
  } finally {
    if (previousClientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = previousClientUrl;
    if (previousApiUrl === undefined) delete process.env.API_PUBLIC_URL;
    else process.env.API_PUBLIC_URL = previousApiUrl;
  }
});

test('password reset links target the frontend reset page', () => {
  const previousClientUrl = process.env.CLIENT_URL;
  try {
    process.env.CLIENT_URL = 'https://farmer.example.test';
    const url = new URL(createPasswordResetLink('test-reset-token'));

    assert.equal(url.origin, 'https://farmer.example.test');
    assert.equal(url.pathname, '/reset-password');
    assert.equal(url.searchParams.get('token'), 'test-reset-token');
  } finally {
    if (previousClientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = previousClientUrl;
  }
});

test('missing SMTP configuration is rejected before account creation', () => {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
  const saved = new Map(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.throws(assertVerificationEmailConfigured, {
      status: 503,
      message: /Email verification is not configured/
    });

    test('Gmail SMTP defaults to port 587 with STARTTLS when configured port is omitted', () => {
      const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
      const saved = new Map(keys.map(key => [key, process.env[key]]));
      try {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'farmer@example.test';
        process.env.SMTP_PASSWORD = 'test-app-password';
        process.env.SMTP_FROM = 'Farmer Saathi <farmer@example.test>';
        delete process.env.SMTP_PORT;
        process.env.SMTP_SECURE = 'false';
        const status = getVerificationEmailStatus();

        assert.equal(status.configured, true);
        assert.equal(status.port, 587);
        assert.equal(status.secure, false);
      } finally {
        for (const key of keys) {
          if (saved.get(key) === undefined) delete process.env[key];
          else process.env[key] = saved.get(key);
        }
      }
    });

    test('SMTP port and secure mode are validated without exposing their values', () => {
      const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
      const saved = new Map(keys.map(key => [key, process.env[key]]));
      try {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'farmer@example.test';
        process.env.SMTP_PASSWORD = 'test-app-password';
        process.env.SMTP_FROM = 'Farmer Saathi <farmer@example.test>';
        process.env.SMTP_PORT = 'not-a-port';
        process.env.SMTP_SECURE = 'maybe';
        const status = getVerificationEmailStatus();

        assert.equal(status.configured, false);
        assert.deepEqual(status.invalid, ['SMTP_PORT', 'SMTP_SECURE']);
      } finally {
        for (const key of keys) {
          if (saved.get(key) === undefined) delete process.env[key];
          else process.env[key] = saved.get(key);
        }
      }
    });
  } finally {
    for (const key of keys) {
      if (saved.get(key) === undefined) delete process.env[key];
      else process.env[key] = saved.get(key);
    }
  }
});
