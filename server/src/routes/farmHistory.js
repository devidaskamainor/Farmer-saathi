import { Router } from 'express';
import { getDatabasePool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createFarmActivity, deleteFarmActivity, listFarmHistory, updateFarmActivity, validateFarmActivity
} from '../services/farmHistory.js';
import { HttpError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json({ activities: await listFarmHistory(getDatabasePool(), req.authUser.id) }); }
  catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const activity = validateFarmActivity(req.body || {});
    const saved = await createFarmActivity(getDatabasePool(), req.authUser.id, activity);
    res.status(201).json({ activity: saved });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Farm activity ID is invalid.');
    const activity = validateFarmActivity(req.body || {});
    const saved = await updateFarmActivity(getDatabasePool(), req.authUser.id, req.params.id, activity);
    res.json({ activity: saved });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Farm activity ID is invalid.');
    await deleteFarmActivity(getDatabasePool(), req.authUser.id, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default router;
