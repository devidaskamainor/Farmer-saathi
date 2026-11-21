import { createSupabaseClient } from '../config/supabase.js';
import { getOrCreateFarmer } from '../services/farmerProfiles.js';

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });

  try {
    const supabase = createSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      if (error.status === 401 || error.status === 403) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
      return res.status(502).json({ message: 'Could not verify your Supabase session. Please try again.' });
    }
    if (!data.user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.supabase = supabase;
    req.authUser = data.user;
    req.farmer = await getOrCreateFarmer(supabase, data.user);
    next();
  } catch (error) {
    next(error);
  }
}
