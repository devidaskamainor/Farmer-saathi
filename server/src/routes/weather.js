import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWeather } from '../services/weather.js';

const router = Router();
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const location = [req.query.location, req.farmer.village, req.farmer.district, req.farmer.state].filter(Boolean).join(', ');
    res.json(await getWeather(location));
  } catch (error) { next(error); }
});
export default router;
