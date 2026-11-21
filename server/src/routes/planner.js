import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { buildFarmPlan, getPlannerThresholds } from '../services/planner.js';
import { getPlanningWeather } from '../services/weather.js';
import { HttpError } from '../utils/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const location = [req.farmer.village, req.farmer.district, req.farmer.state].filter(Boolean).join(', ');
    let weather = null;
    if (location) {
      try {
        weather = await getPlanningWeather(location);
      } catch (error) {
        if (!(error instanceof HttpError) && !(error instanceof TypeError)) throw error;
      }
    }
    res.json(buildFarmPlan(req.farmer, weather, getPlannerThresholds()));
  } catch (error) { next(error); }
});

export default router;
