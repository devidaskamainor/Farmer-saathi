import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import {
  authenticateSocialAccount, createPasswordReset, loginAccount, registerAccount, resetPassword, verifyEmail
} from '../src/services/auth.js';
import { hashSessionToken } from '../src/services/authSessions.js';

const farmerRow = {
  id: '2a1c4eb5-cf69-4c79-8a35-27c4bcb438f3',
  name: 'Ravi',
  email: 'ravi@example.test',
  state: 'Karnataka',
  district: '',
  village: '',
  preferred_language: 'en',
  farm_size: null,
  soil: {},
  irrigation_facilities: [],
  current_crops: [],
  created_at: new Date(),
  updated_at: new Date()
};

test('registerAccount stores a bcrypt hash and only a hash of the verification token', async () => {
  let storedPasswordHash;
  let storedVerificationHash;
  const client = {
    async query(sql, values = []) {
      if (sql.includes('insert into app_users')) {
        storedPasswordHash = values[2];
        return { rows: [{ id: farmerRow.id, email: values[1], created_at: new Date() }] };
      }
      if (sql.includes('insert into farmers')) return { rows: [farmerRow] };
      if (sql.includes('insert into auth_email_verifications')) storedVerificationHash = values[1];
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const result = await registerAccount(pool, {
    email: ' RAVI@example.test ',
    password: 'secure-password',
    profile: { ...farmerRow, preferredLanguage: 'en', currentCrops: [] }
  });

  assert.equal(await bcrypt.compare('secure-password', storedPasswordHash), true);
  assert.equal(result.farmer._id, farmerRow.id);
  assert.equal(storedVerificationHash, hashSessionToken(result.verificationToken));
  assert.notEqual(storedVerificationHash, result.verificationToken);
});

test('loginAccount blocks accounts whose email has not been verified', async () => {
  const passwordHash = await bcrypt.hash('secure-password', 4);
  const pool = {
    async query() {
      return { rows: [{ id: farmerRow.id, email: farmerRow.email, password_hash: passwordHash, email_verified_at: null }] };
    }
  };
  await assert.rejects(loginAccount(pool, { email: farmerRow.email, password: 'secure-password' }), {
    status: 403,
    message: /verify your email/
  });
});

test('verifyEmail marks the account verified and creates a hashed session', async () => {
  const verificationToken = 'test-verification-token';
  let storedSessionHash;
  const client = {
    async query(sql, values = []) {
      if (sql.includes('select v.user_id')) return { rows: [{ user_id: farmerRow.id }] };
      if (sql.includes('select * from farmers')) return { rows: [farmerRow] };
      if (sql.includes('insert into auth_sessions')) storedSessionHash = values[1];
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const result = await verifyEmail(pool, verificationToken);

  assert.equal(result.farmer._id, farmerRow.id);
  assert.equal(storedSessionHash, hashSessionToken(result.token));
  assert.notEqual(storedSessionHash, result.token);
});

test('verifyEmail rejects expired or unknown tokens without creating a session', async () => {
  let createdSession = false;
  const client = {
    async query(sql) {
      if (sql.includes('select v.user_id')) return { rows: [] };
      if (sql.includes('insert into auth_sessions')) createdSession = true;
      return { rows: [] };
    },
    release() {}
  };
  const result = await verifyEmail({ async connect() { return client; } }, 'expired-token');

  assert.equal(result, null);
  assert.equal(createdSession, false);
});

test('createPasswordReset stores only a hashed token, expires it in 15 minutes, and replaces prior tokens', async () => {
  let storedTokenHash;
  let insertSql = '';
  const client = {
    async query(sql, values = []) {
      if (sql.includes('select id, email from app_users')) {
        assert.match(sql, /email_verified_at is not null/);
        assert.equal(values[0], farmerRow.email);
        return { rows: [{ id: farmerRow.id, email: farmerRow.email }] };
      }
      if (sql.includes('insert into auth_password_resets')) {
        insertSql = sql;
        storedTokenHash = values[1];
      }
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const result = await createPasswordReset({ async connect() { return client; } }, ' RAVI@example.test ');

  assert.equal(result.email, farmerRow.email);
  assert.equal(result.token.length, 43);
  assert.equal(storedTokenHash, hashSessionToken(result.token));
  assert.notEqual(storedTokenHash, result.token);
  assert.match(insertSql, /interval '15 minutes'/);
  assert.match(insertSql, /on conflict \(user_id\) do update/);
});

test('createPasswordReset does not create tokens for unknown or unverified users', async () => {
  let insertedReset = false;
  const client = {
    async query(sql) {
      if (sql.includes('select id, email from app_users')) return { rows: [] };
      if (sql.includes('insert into auth_password_resets')) insertedReset = true;
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };

  assert.equal(await createPasswordReset({ async connect() { return client; } }, farmerRow.email), null);
  assert.equal(insertedReset, false);
});

test('resetPassword consumes a valid token, changes the bcrypt hash, and invalidates all sessions', async () => {
  const token = 'valid-password-reset-token';
  let queryForToken = '';
  let storedPasswordHash;
  let consumed = false;
  let invalidatedSessions = false;
  let committed = false;
  const client = {
    async query(sql, values = []) {
      if (sql.includes('select user_id from auth_password_resets')) {
        queryForToken = sql;
        assert.equal(values[0], hashSessionToken(token));
        return { rows: [{ user_id: farmerRow.id }] };
      }
      if (sql.includes('update app_users set password_hash')) {
        storedPasswordHash = values[0];
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('update auth_password_resets set consumed_at')) consumed = true;
      if (sql.includes('delete from auth_sessions')) invalidatedSessions = true;
      if (sql === 'commit') committed = true;
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };

  assert.equal(await resetPassword({ async connect() { return client; } }, token, 'new-secure-password'), true);
  assert.match(queryForToken, /expires_at > now\(\) and consumed_at is null\s+for update/);
  assert.equal(await bcrypt.compare('new-secure-password', storedPasswordHash), true);
  assert.equal(consumed, true);
  assert.equal(invalidatedSessions, true);
  assert.equal(committed, true);
});

test('resetPassword rejects expired or reused tokens without changing the account', async () => {
  let changedPassword = false;
  let invalidatedSessions = false;
  const client = {
    async query(sql) {
      if (sql.includes('select user_id from auth_password_resets')) return { rows: [] };
      if (sql.includes('update app_users')) changedPassword = true;
      if (sql.includes('delete from auth_sessions')) invalidatedSessions = true;
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };

  assert.equal(await resetPassword({ async connect() { return client; } }, 'expired-or-used-token', 'new-secure-password'), false);
  assert.equal(changedPassword, false);
  assert.equal(invalidatedSessions, false);
});

test('resetPassword validates the bcrypt-compatible password length before database access', async () => {
  const pool = {
    async connect() {
      assert.fail('Database must not be accessed for an invalid password.');
    }
  };

  await assert.rejects(resetPassword(pool, 'valid-reset-token', 'short'), {
    status: 400,
    message: /at least 8 characters/
  });
  await assert.rejects(resetPassword(pool, 'valid-reset-token', 'a'.repeat(73)), {
    status: 400,
    message: /no more than 72 bytes/
  });
});

test('authenticateSocialAccount logs in or registers user via google and facebook', async () => {
  let createdUser = false;
  let sessionCreated = false;
  const client = {
    async query(sql, values = []) {
      if (sql.includes('select id, email, email_verified_at from app_users')) return { rows: [] };
      if (sql.includes('insert into app_users')) {
        createdUser = true;
        return { rows: [] };
      }
      if (sql.includes('insert into farmers')) return { rows: [farmerRow] };
      if (sql.includes('insert into auth_sessions')) {
        sessionCreated = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const result = await authenticateSocialAccount(pool, {
    provider: 'google',
    email: 'farmer.google@example.com',
    name: 'Farmer Google',
    preferredLanguage: 'kn'
  });

  assert.equal(createdUser, true);
  assert.equal(sessionCreated, true);
  assert.ok(result.token);
  assert.equal(result.farmer._id, farmerRow.id);
});

test('authenticateSocialAccount rejects unsupported providers and invalid emails', async () => {
  const pool = {};
  await assert.rejects(authenticateSocialAccount(pool, { provider: 'twitter', email: 'test@example.com' }), {
    status: 400,
    message: /Supported social providers/
  });
  await assert.rejects(authenticateSocialAccount(pool, { provider: 'google', email: 'invalid-email' }), {
    status: 400,
    message: /valid email/
  });
});
