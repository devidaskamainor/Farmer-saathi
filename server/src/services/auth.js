import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { HttpError } from '../utils/http.js';
import { createSessionToken, hashSessionToken, SESSION_DURATION_DAYS } from './authSessions.js';
import { getFarmerById, mapFarmer } from './farmerProfiles.js';

const bcryptRounds = 12;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function validateEmailAddress(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  return normalizedEmail;
}

export function validateNewPassword(password) {
  const passwordBytes = typeof password === 'string' ? Buffer.byteLength(password, 'utf8') : 0;
  if (passwordBytes < 8 || passwordBytes > 72) {
    throw new HttpError(400, 'Password must be at least 8 characters and no more than 72 bytes.');
  }
}

export function validateCredentials(email, password) {
  const normalizedEmail = validateEmailAddress(email);
  validateNewPassword(password);
  return normalizedEmail;
}

export async function registerAccount(pool, { email, password, profile }) {
  const normalizedEmail = validateCredentials(email, password);
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const client = await pool.connect();
  const verificationToken = randomBytes(32).toString('base64url');
  try {
    await client.query('begin');
    const { rows: userRows } = await client.query(
      'insert into app_users (id, email, password_hash) values ($1, $2, $3) returning id, email, created_at',
      [randomUUID(), normalizedEmail, passwordHash]
    );
    const user = userRows[0];
    const farmer = await insertFarmer(client, user.id, normalizedEmail, profile);
    await client.query(
      `insert into auth_email_verifications (user_id, token_hash, expires_at)
       values ($1, $2, now() + interval '24 hours')`,
      [user.id, hashSessionToken(verificationToken)]
    );
    await client.query('commit');
    return { farmer, email: normalizedEmail, verificationToken };
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') throw new HttpError(409, 'An account with this email already exists.');
    throw error;
  } finally { client.release(); }
}

export async function loginAccount(pool, { email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof password !== 'string' || password.length === 0) {
    throw new HttpError(400, 'Enter your email address and password.');
  }
  const { rows } = await pool.query(
    'select id, email, password_hash, email_verified_at from app_users where lower(email) = $1',
    [normalizedEmail]
  );
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash).catch(() => false) : false;
  if (!valid) throw new HttpError(401, 'Email or password is incorrect.');
  if (!user.email_verified_at) throw new HttpError(403, 'Please verify your email address using the link we sent before signing in.');

  const sessionToken = createSessionToken();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const farmer = await getFarmerById(client, user.id);
    if (!farmer) throw new HttpError(404, 'Farmer profile was not found. Contact support before retrying.');
    await insertSession(client, user.id, sessionToken);
    await client.query('commit');
    return { farmer, token: sessionToken };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function createEmailVerification(pool, email) {
  const normalizedEmail = normalizeEmail(email);
  const { rows } = await pool.query(
    `select id, email from app_users
     where lower(email) = $1 and email_verified_at is null`,
    [normalizedEmail]
  );
  if (!rows[0]) return null;
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `insert into auth_email_verifications (user_id, token_hash, expires_at)
     values ($1, $2, now() + interval '24 hours')
     on conflict (user_id) do update
     set token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now()`,
    [rows[0].id, hashSessionToken(token)]
  );
  return { email: rows[0].email, token };
}

export async function verifyEmail(pool, token) {
  if (!token || token.length > 200) return null;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select v.user_id from auth_email_verifications v
       where v.token_hash = $1 and v.expires_at > now() for update`,
      [hashSessionToken(token)]
    );
    if (!rows[0]) {
      await client.query('rollback');
      return null;
    }
    const userId = rows[0].user_id;
    await client.query('update app_users set email_verified_at = now(), updated_at = now() where id = $1', [userId]);
    await client.query('delete from auth_email_verifications where user_id = $1', [userId]);
    const farmer = await getFarmerById(client, userId);
    if (!farmer) throw new HttpError(404, 'Farmer profile was not found. Contact support before retrying.');
    const sessionToken = createSessionToken();
    await insertSession(client, userId, sessionToken);
    await client.query('commit');
    return { farmer, token: sessionToken };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function createPasswordReset(pool, email) {
  const normalizedEmail = validateEmailAddress(email);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      'delete from auth_password_resets where expires_at <= now() or consumed_at is not null'
    );
    const { rows } = await client.query(
      `select id, email from app_users
       where lower(email) = $1 and email_verified_at is not null`,
      [normalizedEmail]
    );
    if (!rows[0]) {
      await client.query('commit');
      return null;
    }

    const token = randomBytes(32).toString('base64url');
    await client.query(
      `insert into auth_password_resets (user_id, token_hash, expires_at, consumed_at)
       values ($1, $2, now() + interval '15 minutes', null)
       on conflict (user_id) do update
       set token_hash = excluded.token_hash,
           expires_at = excluded.expires_at,
           consumed_at = null,
           created_at = now()`,
      [rows[0].id, hashSessionToken(token)]
    );
    await client.query('commit');
    return { email: rows[0].email, token };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function resetPassword(pool, token, newPassword) {
  validateNewPassword(newPassword);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(token)) return false;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select user_id from auth_password_resets
       where token_hash = $1 and expires_at > now() and consumed_at is null
       for update`,
      [hashSessionToken(token)]
    );
    if (!rows[0]) {
      await client.query('rollback');
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
    const { rowCount } = await client.query(
      'update app_users set password_hash = $1, updated_at = now() where id = $2',
      [passwordHash, rows[0].user_id]
    );
    if (rowCount !== 1) {
      await client.query('rollback');
      return false;
    }
    await client.query(
      'update auth_password_resets set consumed_at = now() where user_id = $1',
      [rows[0].user_id]
    );
    await client.query('delete from auth_sessions where user_id = $1', [rows[0].user_id]);
    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function loadSession(pool, token) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const { rows } = await pool.query(
    `select f.* from auth_sessions s
     join farmers f on f.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash]
  );
  return rows[0] ? mapFarmer(rows[0]) : null;
}

export async function deleteSession(pool, token) {
  if (!token) return;
  await pool.query('delete from auth_sessions where token_hash = $1', [hashSessionToken(token)]);
}

async function insertFarmer(client, userId, email, profile) {
  const { rows } = await client.query(
    `insert into farmers
      (id, name, email, state, district, village, preferred_language, current_crops)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      userId, profile.name, email, profile.state, profile.district, profile.village,
      profile.preferredLanguage, profile.currentCrops
    ]
  );
  return mapFarmer(rows[0]);
}

async function insertSession(client, userId, token) {
  await client.query(
    `insert into auth_sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + ($3 * interval '1 day'))`,
    [userId, hashSessionToken(token), SESSION_DURATION_DAYS]
  );
}
