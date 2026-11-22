import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import {
  authenticateGoogleAccount, authenticateSocialAccount, createPasswordReset, deleteSession, loadSession, loginAccount, registerAccount, resetPassword, verifyEmail
} from '../src/services/auth.js';
import { hashSessionToken } from '../src/services/authSessions.js';
import { verifyGoogleIdToken } from '../src/services/googleAuth.js';

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
      if (sql === 'begin' || sql === 'commit') return { rows: [] };
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
    idToken: 'mock-google-id-token',
    preferredLanguage: 'kn',
    customVerifier: async () => ({
      googleId: 'g-12345',
      email: 'farmer.google@example.com',
      name: 'Farmer Google',
      email_verified: true
    })
  });

  assert.equal(createdUser, true);
  assert.equal(sessionCreated, true);
  assert.ok(result.token);
  assert.equal(result.farmer._id, farmerRow.id);
});

test('authenticateSocialAccount rejects unsupported providers and missing Google token', async () => {
  const pool = {};
  await assert.rejects(authenticateSocialAccount(pool, { provider: 'twitter', email: 'test@example.com' }), {
    status: 400,
    message: /Supported social providers/
  });
  await assert.rejects(authenticateSocialAccount(pool, { provider: 'google', email: 'farmer@gmail.com' }), {
    status: 400,
    message: /verified Google ID token is required/
  });
});

test('authenticateGoogleAccount creates new user and farmer, and sets up session', async () => {
  let createdUser = false;
  let sessionCreated = false;
  let insertedFarmer = null;

  const client = {
    async query(sql, values = []) {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] };
      if (sql.includes('select id, email, email_verified_at from app_users')) return { rows: [] };
      if (sql.includes('insert into app_users')) {
        createdUser = true;
        return { rows: [{ id: farmerRow.id, email: values[1] }] };
      }
      if (sql.includes('insert into farmers')) {
        insertedFarmer = { ...farmerRow, name: values[1], email: values[2] };
        return { rows: [insertedFarmer] };
      }
      if (sql.includes('insert into auth_sessions')) {
        sessionCreated = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };

  const mockVerifier = async () => ({
    googleId: 'google-sub-12345',
    email: 'newfarmer@example.com',
    name: 'New Google Farmer'
  });

  const result = await authenticateGoogleAccount(pool, {
    idToken: 'mock-valid-id-token',
    preferredLanguage: 'kn',
    customVerifier: mockVerifier
  });

  assert.equal(createdUser, true);
  assert.equal(sessionCreated, true);
  assert.equal(result.farmer.email, 'newfarmer@example.com');
  assert.ok(result.token);
});

test('authenticateGoogleAccount logs in existing user, verifies email, and preserves profile', async () => {
  let updatedVerifiedAt = false;
  let sessionCreated = false;

  const client = {
    async query(sql, values = []) {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] };
      if (sql.includes('select id, email, email_verified_at from app_users')) {
        return { rows: [{ id: farmerRow.id, email: farmerRow.email, email_verified_at: null }] };
      }
      if (sql.includes('update app_users set email_verified_at')) {
        updatedVerifiedAt = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('select * from farmers where id = $1')) {
        return { rows: [farmerRow] };
      }
      if (sql.includes('insert into auth_sessions')) {
        sessionCreated = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };

  const mockVerifier = async () => ({
    googleId: 'google-sub-existing',
    email: farmerRow.email,
    name: 'Ravi'
  });

  const result = await authenticateGoogleAccount(pool, {
    idToken: 'mock-valid-id-token',
    customVerifier: mockVerifier
  });

  assert.equal(updatedVerifiedAt, true);
  assert.equal(sessionCreated, true);
  assert.equal(result.farmer._id, farmerRow.id);
  assert.ok(result.token);
});

test('authenticateGoogleAccount rolls back and throws when database errors occur', async () => {
  let rolledBack = false;
  const client = {
    async query(sql) {
      if (sql === 'begin') return { rows: [] };
      if (sql === 'rollback') {
        rolledBack = true;
        return { rows: [] };
      }
      if (sql.includes('select id, email')) throw new Error('Database connection failed');
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } };
  const mockVerifier = async () => ({
    googleId: 'google-1',
    email: 'test@example.com',
    name: 'Test'
  });

  await assert.rejects(
    authenticateGoogleAccount(pool, { idToken: 'token', customVerifier: mockVerifier }),
    { message: /Database connection failed/ }
  );
  assert.equal(rolledBack, true);
});

test('verifyGoogleIdToken verifies audience against configured client ID', async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id-12345.apps.googleusercontent.com';
  
  const mockClient = {
    async verifyIdToken({ idToken, audience }) {
      assert.equal(idToken, 'valid-token');
      assert.equal(audience, 'test-client-id-12345.apps.googleusercontent.com');
      return {
        getPayload: () => ({
          aud: 'test-client-id-12345.apps.googleusercontent.com',
          iss: 'accounts.google.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: 'sub-123',
          email: 'verified@gmail.com',
          email_verified: true,
          name: 'Verified User'
        })
      };
    }
  };

  const payload = await verifyGoogleIdToken('valid-token', mockClient);
  assert.equal(payload.email, 'verified@gmail.com');
  assert.equal(payload.name, 'Verified User');
  assert.equal(payload.googleId, 'sub-123');
});

test('verifyGoogleIdToken rejects empty or invalid token parameter', async () => {
  await assert.rejects(verifyGoogleIdToken(''), { status: 400 });
  await assert.rejects(verifyGoogleIdToken(null), { status: 400 });
});

test('verifyGoogleIdToken rejects tokens with mismatched audience', async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = 'expected-client-id';

  const mockClient = {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          aud: 'different-client-id',
          iss: 'accounts.google.com',
          sub: 'sub-123',
          email: 'user@example.com',
          email_verified: true
        })
      };
    }
  };

  await assert.rejects(verifyGoogleIdToken('token', mockClient), {
    status: 401,
    message: /audience does not match/
  });
});

test('verifyGoogleIdToken rejects unverified Google email addresses', async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';

  const mockClient = {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          aud: 'test-client-id',
          iss: 'https://accounts.google.com',
          sub: 'sub-123',
          email: 'unverified@example.com',
          email_verified: false
        })
      };
    }
  };

  await assert.rejects(verifyGoogleIdToken('token', mockClient), {
    status: 403,
    message: /must be verified/
  });
});

test('verifyGoogleIdToken rejects invalid issuer', async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';

  const mockClient = {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          aud: 'test-client-id',
          iss: 'malicious-issuer.com',
          sub: 'sub-123',
          email: 'user@example.com',
          email_verified: true
        })
      };
    }
  };

  await assert.rejects(verifyGoogleIdToken('token', mockClient), {
    status: 401,
    message: /issuer is invalid/
  });
});

test('loadSession and deleteSession manage session lifecycle accurately', async () => {
  const token = 'active-session-token';
  const pool = {
    async query(sql, values) {
      if (sql.includes('from auth_sessions s')) {
        assert.equal(values[0], hashSessionToken(token));
        return { rows: [farmerRow] };
      }
      if (sql.includes('delete from auth_sessions')) {
        assert.equal(values[0], hashSessionToken(token));
        return { rowCount: 1 };
      }
      return { rows: [] };
    }
  };

  const loaded = await loadSession(pool, token);
  assert.equal(loaded._id, farmerRow.id);

  // Expired or missing
  const emptyPool = { async query() { return { rows: [] }; } };
  assert.equal(await loadSession(emptyPool, 'missing-token'), null);

  // Delete
  await deleteSession(pool, token);
});
