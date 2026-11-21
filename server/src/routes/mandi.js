import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { compareMandiPrices, getMandiPrices } from '../services/mandi.js';

const router = Router();
router.use(requireAuth);
router.get('/prices', async (req, res, next) => {
  try { res.json(await getMandiPrices({ state: req.query.state || req.farmer.state, district: req.query.district || req.farmer.district, commodity: req.query.commodity })); }
  catch (error) { next(error); }
});
router.get('/compare', async (req, res, next) => {
  try { res.json(await compareMandiPrices({ state: req.query.state || req.farmer.state, district: req.query.district || req.farmer.district, commodity: req.query.commodity })); }
  catch (error) { next(error); }
});
export default router;
