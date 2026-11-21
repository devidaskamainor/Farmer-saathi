import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../utils/http.js';

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function createSupabaseClient(accessToken) {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the server.');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {})
  });
}

export function supabaseSetupError(error) {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    return new HttpError(503, 'Supabase tables are not set up yet. Run supabase/migrations/001_initial_schema.sql in the project SQL Editor.');
  }
  return new HttpError(error?.status >= 500 ? 502 : 400, error?.message || 'Supabase request failed.');
}
