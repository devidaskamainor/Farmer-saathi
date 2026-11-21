import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import farmerRoutes from './routes/farmers.js';
import weatherRoutes from './routes/weather.js';
import mandiRoutes from './routes/mandi.js';
import aiRoutes from './routes/ai.js';
import diseaseRoutes from './routes/disease.js';
import voiceRoutes from './routes/voice.js';
import schemeRoutes from './routes/schemes.js';
import authRoutes from './routes/auth.js';
import plannerRoutes from './routes/planner.js';
import farmHistoryRoutes from './routes/farmHistory.js';
import { checkDatabaseConnection } from './config/database.js';
import { getCacheHealth } from './services/cache.js';

const app = express();
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',').map(value => value.trim()).filter(Boolean) || ['http://localhost:5173'];
const apiOrigin = new URL(process.env.API_PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 4000}`).origin;
const allowedMutationOrigins = new Set([...allowedOrigins, apiOrigin]);

function isAllowedClientOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.origin !== origin) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
    const octets = hostname.split('.').map(Number);
    if (octets.some(octet => octet < 0 || octet > 255) || octets.join('.') !== hostname) return false;
    const [first, second] = octets;
    return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) || (first === 169 && second === 254);
  } catch {
    return false;
  }
}

const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv) {
  const numericHops = Number(trustProxyEnv);
  app.set('trust proxy', Number.isFinite(numericHops) ? numericHops : trustProxyEnv === 'true' ? 1 : trustProxyEnv);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || isAllowedClientOrigin(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1kb' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin &&
      !allowedMutationOrigins.has(origin) && !isAllowedClientOrigin(origin)) {
    let diagnosticOrigin = 'invalid';
    try { diagnosticOrigin = new URL(origin).origin; } catch {}
    console.warn(`Rejected state-changing request from origin ${diagnosticOrigin}.`);
    return res.status(403).json({ message: 'This request origin is not allowed.' });
  }
  next();
});
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/disease', rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/mandi', rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/weather', rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/planner', rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/voice', rateLimit({ windowMs: 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', async (_req, res, next) => {
  try {
    const configured = await checkDatabaseConnection();
    res.json({
      status: 'ok',
      database: configured ? 'connected' : 'not_configured',
      cache: getCacheHealth(),
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});
app.use('/api/auth', authRoutes);
app.use('/api/farmers/history', farmHistoryRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/mandi', mandiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/schemes', schemeRoutes);

app.use((_req, res) => res.status(404).json({ message: 'This API route was not found.' }));
app.use((error, _req, res, _next) => {
  if (error?.code === '23505') return res.status(409).json({ message: 'That account or record already exists.' });
  if (isDatabaseConnectionError(error)) {
    console.error('PostgreSQL connection error.', error);
    return res.status(503).json({ message: 'The database is temporarily unavailable. Please try again.' });
  }
  if (error?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
  if (error?.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map(item => item.message).join(' ') });
  if (error?.name === 'MulterError') return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'The image upload could not be processed.' });
  const status = error.status || 500;
  const message = status === 500 ? 'Something went wrong on the server. Please try again.' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ message });
});

function isDatabaseConnectionError(error) {
  const knownCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300']);
  for (let current = error; current; current = current.cause) {
    if (knownCodes.has(current.code) || (typeof current.code === 'string' && current.code.startsWith('08'))) return true;
    if (typeof current.message === 'string' && /connection terminated due to connection timeout/i.test(current.message)) return true;
  }
  return false;
}

export default app;
