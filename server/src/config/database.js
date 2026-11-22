import './env.js';
import pg from 'pg';
import { HttpError } from '../utils/http.js';
import { normalizeNeonSslMode } from './postgresConnection.js';

const { Pool } = pg;
let pool;

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, 'PostgreSQL is not configured. Set DATABASE_URL on the server.');
  }
  if (!pool) {
    let hostname;
    try { hostname = new URL(process.env.DATABASE_URL).hostname.toLowerCase(); }
    catch { throw new HttpError(503, 'DATABASE_URL must be a valid PostgreSQL connection URL.'); }
    const neon = hostname === 'neon.tech' || hostname.endsWith('.neon.tech');
    const sslEnabled = neon || process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && process.env.NODE_ENV === 'production');
    pool = new Pool({
      connectionString: normalizeNeonSslMode(process.env.DATABASE_URL),
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ...(sslEnabled ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {})
    });
    pool.on('error', error => console.error('Unexpected PostgreSQL idle client error.', error));
  }
  return pool;
}

export async function checkDatabaseConnection() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await getDatabasePool().query('select 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabasePool() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
