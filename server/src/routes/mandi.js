import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { compareMandiPrices, getMandiPrices } from '../services/mandi.js';
import { HttpError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);
router.get(['/', '/prices'], async (req, res, next) => {
  try { res.json(await getMandiPrices(filtersFromRequest(req))); }
  catch (error) { next(error); }
});
router.get(['/trends', '/compare'], async (req, res, next) => {
  try { res.json(await compareMandiPrices(filtersFromRequest(req))); }
  catch (error) { next(error); }
});

function filtersFromRequest(req) {
  const filters = {
    state: req.query.state || req.farmer.state,
    district: req.query.district || req.farmer.district,
    commodity: req.query.commodity,
    market: req.query.market
  };
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && (typeof value !== 'string' || value.length > 100)) {
      throw new HttpError(400, `${key} filter must be 100 characters or fewer.`);
    }
  }
  return filters;
}

export default router;
