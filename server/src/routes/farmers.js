import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdates, updateFarmerProfile } from '../services/farmerProfiles.js';
import { HttpError } from '../utils/http.js';

const router = Router();
const languages = new Set(['en', 'hi', 'kn']);
const allowedFields = new Set(['name', 'state', 'district', 'village', 'preferredLanguage', 'farmSize', 'soil', 'irrigationFacilities', 'currentCrops']);

router.use(requireAuth);

router.get('/profile', (req, res) => res.json({ farmer: req.farmer }));

router.get('/profile/:id', (req, res, next) => {
  try {
    assertOwner(req);
    res.json({ farmer: req.farmer });
  } catch (error) { next(error); }
});

router.put('/profile/:id', async (req, res, next) => {
  try {
    assertOwner(req);
    const body = req.body || {};
    for (const key of Object.keys(body)) if (!allowedFields.has(key)) throw new HttpError(400, `The field '${key}' cannot be updated.`);
    if (body.name !== undefined && (!String(body.name).trim() || String(body.name).length > 100)) throw new HttpError(400, 'Name must be between 1 and 100 characters.');
    if (body.preferredLanguage && !languages.has(body.preferredLanguage)) throw new HttpError(400, 'Choose English, Hindi, or Kannada.');
    if (body.farmSize !== undefined && body.farmSize !== null && (!Number.isFinite(Number(body.farmSize)) || Number(body.farmSize) < 0)) throw new HttpError(400, 'Farm size must be a non-negative number.');
    validateSoil(body.soil);
    validateList(body.irrigationFacilities, 'Irrigation facilities');
    validateList(body.currentCrops, 'Current crops');

    const farmer = await updateFarmerProfile(req.supabase, req.authUser.id, profileUpdates(body));
    res.json({ farmer });
  } catch (error) { next(error); }
});

function validateSoil(soil) {
  if (soil === undefined) return;
  if (!soil || typeof soil !== 'object' || Array.isArray(soil)) throw new HttpError(400, 'Soil details must be an object.');
  for (const key of ['nitrogen', 'phosphorus', 'potassium']) {
    if (soil[key] != null && (!Number.isFinite(Number(soil[key])) || Number(soil[key]) < 0)) throw new HttpError(400, `${key} must be a non-negative number.`);
  }
  if (soil.ph != null && (!Number.isFinite(Number(soil.ph)) || Number(soil.ph) < 0 || Number(soil.ph) > 14)) throw new HttpError(400, 'Soil pH must be between 0 and 14.');
}

function validateList(value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || item.length > 100)) {
    throw new HttpError(400, `${label} must be a list of up to 20 short names.`);
  }
}

function assertOwner(req) {
  if (req.params.id !== req.authUser.id) throw new HttpError(403, 'You can only access your own profile.');
}

export default router;
