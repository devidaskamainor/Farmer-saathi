import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSatelliteCropMonitoring } from '../services/satellite.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const farmer = req.farmer || {};
    const defaultLocation = [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ');
    const defaultCrop = farmer.currentCrops?.[0] || 'General Crops';
    const defaultFarmSize = farmer.farmSize || 2.5;

    const {
      lat,
      lon,
      location,
      crop,
      farmSize
    } = req.query;

    const data = await getSatelliteCropMonitoring({
      latitude: lat ? Number(lat) : undefined,
      longitude: lon ? Number(lon) : undefined,
      location: location || defaultLocation,
      crop: crop || defaultCrop,
      farmSizeAcres: farmSize ? Number(farmSize) : defaultFarmSize,
      language: farmer.preferredLanguage || 'en'
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/zones', async (req, res, next) => {
  try {
    const farmer = req.farmer || {};
    const defaultLocation = [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ');
    const defaultCrop = farmer.currentCrops?.[0] || 'General Crops';

    const { lat, lon, location, crop } = req.query;

    const data = await getSatelliteCropMonitoring({
      latitude: lat ? Number(lat) : undefined,
      longitude: lon ? Number(lon) : undefined,
      location: location || defaultLocation,
      crop: crop || defaultCrop,
      language: farmer.preferredLanguage || 'en'
    });

    res.json({
      meta: data.meta,
      location: data.location,
      fieldZoning: data.fieldZoning
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const farmer = req.farmer || {};
    const defaultLocation = [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ');
    const defaultCrop = farmer.currentCrops?.[0] || 'General Crops';

    const { lat, lon, location, crop } = req.query;

    const data = await getSatelliteCropMonitoring({
      latitude: lat ? Number(lat) : undefined,
      longitude: lon ? Number(lon) : undefined,
      location: location || defaultLocation,
      crop: crop || defaultCrop,
      language: farmer.preferredLanguage || 'en'
    });

    res.json({
      meta: data.meta,
      location: data.location,
      timeSeries: data.timeSeries
    });
  } catch (error) {
    next(error);
  }
});

export default router;
