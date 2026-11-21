import { Router } from 'express';
import { getDatabasePool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdates, updateFarmerProfile, validatePreferredLanguage } from '../services/farmerProfiles.js';
import { HttpError } from '../utils/http.js';

const router = Router();
const allowedFields = new Set(['name', 'state', 'district', 'village', 'preferredLanguage', 'farmSize', 'soil', 'farmPlan', 'irrigationFacilities', 'currentCrops']);

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
    if (body.preferredLanguage !== undefined) validatePreferredLanguage(body.preferredLanguage);
    if (body.farmSize !== undefined && body.farmSize !== null && (!Number.isFinite(Number(body.farmSize)) || Number(body.farmSize) < 0)) throw new HttpError(400, 'Farm size must be a non-negative number.');
    validateSoil(body.soil);
    validateFarmPlan(body.farmPlan);
    validateList(body.irrigationFacilities, 'Irrigation facilities');
    validateList(body.currentCrops, 'Current crops');

    const farmer = await updateFarmerProfile(getDatabasePool(), req.authUser.id, profileUpdates(body));
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
  if (soil.moisturePct != null && (!Number.isFinite(Number(soil.moisturePct)) || Number(soil.moisturePct) < 0 || Number(soil.moisturePct) > 100)) throw new HttpError(400, 'Measured soil moisture must be between 0 and 100 percent.');
  if (soil.moistureMeasuredAt != null && !isDateOnly(soil.moistureMeasuredAt)) throw new HttpError(400, 'Soil moisture measurement date must be a valid date.');
  if ((soil.moisturePct == null) !== (soil.moistureMeasuredAt == null)) throw new HttpError(400, 'Enter both the measured soil moisture and its measurement date.');
}

function validateFarmPlan(farmPlan) {
  if (farmPlan === undefined) return;
  if (!farmPlan || typeof farmPlan !== 'object' || Array.isArray(farmPlan)) throw new HttpError(400, 'Crop planning details must be an object.');
  const fields = new Set(['crop', 'growthStage', 'sowingDate', 'irrigationMethod']);
  for (const key of Object.keys(farmPlan)) if (!fields.has(key)) throw new HttpError(400, `The crop planning field '${key}' cannot be updated.`);
  for (const [key, label] of [['crop', 'Crop'], ['growthStage', 'Growth stage'], ['irrigationMethod', 'Irrigation method']]) {
    if (farmPlan[key] != null && (typeof farmPlan[key] !== 'string' || farmPlan[key].trim().length > 100)) {
      throw new HttpError(400, `${label} must be 100 characters or fewer.`);
    }
  }
  if (farmPlan.sowingDate != null && farmPlan.sowingDate !== '' && !isDateOnly(farmPlan.sowingDate)) {
    throw new HttpError(400, 'Sowing date must be a valid date.');
  }
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

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default router;
