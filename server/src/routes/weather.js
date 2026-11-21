import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWeather } from '../services/weather.js';

const router = Router();
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const queryLoc = req.query.location || req.query.q || req.query.city;
    const farmerLoc = [req.farmer?.village, req.farmer?.district, req.farmer?.state].filter(Boolean).join(', ');
    const location = queryLoc || farmerLoc || 'Mandya, Karnataka';
    res.json(await getWeather(location));
  } catch (error) { next(error); }
});
export default router;
