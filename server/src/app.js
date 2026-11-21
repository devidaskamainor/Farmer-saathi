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
import { isSupabaseConfigured } from './config/supabase.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',').map(value => value.trim()) || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/disease', rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: isSupabaseConfigured() ? 'configured' : 'not_configured', timestamp: new Date().toISOString() }));
app.use('/api/farmers', farmerRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/mandi', mandiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/schemes', schemeRoutes);

app.use((_req, res) => res.status(404).json({ message: 'This API route was not found.' }));
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
  if (error?.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map(item => item.message).join(' ') });
  if (error?.name === 'MulterError') return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'The image upload could not be processed.' });
  const status = error.status || 500;
  const message = status === 500 ? 'Something went wrong on the server. Please try again.' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ message });
});

export default app;
