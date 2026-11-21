const defaults = {
  heavyRainMm: 25,
  severeRainMm: 50,
  highTemperatureC: 38,
  dryDayRainMm: 1,
  drySpellDays: 3,
  soilMoistureLowPct: 30,
  soilMeasurementMaxAgeDays: 3
};

const configNames = {
  heavyRainMm: 'FARM_ALERT_HEAVY_RAIN_MM',
  severeRainMm: 'FARM_ALERT_SEVERE_RAIN_MM',
  highTemperatureC: 'FARM_ALERT_HIGH_TEMPERATURE_C',
  dryDayRainMm: 'FARM_ALERT_DRY_DAY_RAIN_MM',
  drySpellDays: 'FARM_ALERT_DRY_SPELL_DAYS',
  soilMoistureLowPct: 'FARM_SOIL_MOISTURE_LOW_PCT',
  soilMeasurementMaxAgeDays: 'FARM_SOIL_MEASUREMENT_MAX_AGE_DAYS'
};

export function getPlannerThresholds(env = process.env) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const raw = env[configNames[key]];
    const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${configNames[key]} must be a positive number.`);
    }
    return [key, value];
  }));
}

export function buildFarmPlan(farmer, weather, thresholds = getPlannerThresholds(), now = new Date()) {
  const forecast = Array.isArray(weather?.forecast) ? weather.forecast.slice(0, 7) : [];
  const location = [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ');
  const crop = farmer.farmPlan?.crop || farmer.currentCrops?.[0] || '';
  const missingInformation = [];

  if (!location) missingInformation.push('Farm location');
  if (!crop) missingInformation.push('Current crop');
  if (!farmer.farmPlan?.growthStage) missingInformation.push('Crop growth stage');
  if (!farmer.farmPlan?.sowingDate) missingInformation.push('Sowing date');
  if (!farmer.farmPlan?.irrigationMethod) missingInformation.push('Irrigation method');

  const soilMoisture = getRecentSoilMoisture(farmer.soil, thresholds, now);
  if (soilMoisture === null) missingInformation.push('Recent measured soil moisture');

  const alerts = forecast.length ? createAlerts(forecast, crop, weather.source, thresholds) : [];
  const reviewDays = forecast
    .filter(day => Number.isFinite(day.rainMm) && day.rainMm <= thresholds.dryDayRainMm)
    .map(day => ({ date: day.date, rainMm: day.rainMm, maxC: day.maxC }));
  const recommendation = getRecommendation({
    forecast, alerts, crop, soilMoisture, reviewDays, thresholds
  });

  return {
    location: weather?.location || location,
    crop: crop || null,
    recommendation,
    reviewDays,
    alerts,
    missingInformation,
    forecast,
    forecastDays: forecast.length,
    forecastUnavailable: forecast.length < 7,
    forecastUnavailableMessage: forecast.length < 7
      ? forecast.length === 0
        ? 'Seven-day forecast data is currently unavailable for this location.'
        : `Only ${forecast.length} forecast day(s) are available; a complete seven-day outlook is unavailable.`
      : '',
    forecastSource: forecast.length ? weather.source : null,
    fetchedAt: weather?.fetchedAt || null,
    soilMoisture: soilMoisture === null
      ? null
      : { percent: soilMoisture.value, measuredAt: soilMoisture.measuredAt, source: 'Farmer-entered measurement' }
  };
}

function getRecentSoilMoisture(soil = {}, thresholds, now) {
  const value = Number(soil.moisturePct);
  const measuredAt = soil.moistureMeasuredAt;
  if (!Number.isFinite(value) || value < 0 || value > 100 || !isDateOnly(measuredAt)) return null;
  const measuredDate = new Date(`${measuredAt}T00:00:00Z`);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const ageDays = (today - measuredDate) / 86_400_000;
  if (ageDays < 0 || ageDays > thresholds.soilMeasurementMaxAgeDays) return null;
  return { value, measuredAt };
}

function createAlerts(forecast, crop, source, thresholds) {
  const alerts = [];
  for (const day of forecast) {
    if (Number.isFinite(day.rainMm) && day.rainMm >= thresholds.heavyRainMm) {
      alerts.push({
        id: `heavy-rain-${day.date}`,
        title: 'Heavy rainfall forecast',
        severity: day.rainMm >= thresholds.severeRainMm ? 'high' : 'moderate',
        affectedCrop: crop || 'Farm',
        reason: `${day.rainMm} mm of rainfall is forecast for ${day.date}.`,
        action: 'Check drainage and local field conditions; reassess irrigation before watering.',
        period: day.date,
        source
      });
    }
    if (Number.isFinite(day.maxC) && day.maxC >= thresholds.highTemperatureC) {
      alerts.push({
        id: `high-temperature-${day.date}`,
        title: 'High temperature forecast',
        severity: 'moderate',
        affectedCrop: crop || 'Farm',
        reason: `A maximum temperature of ${day.maxC}°C is forecast for ${day.date}.`,
        action: 'Check crops during cooler hours and follow locally verified heat-care guidance.',
        period: day.date,
        source
      });
    }
  }

  let dryRun = [];
  for (const day of forecast) {
    if (Number.isFinite(day.rainMm) && day.rainMm <= thresholds.dryDayRainMm) {
      dryRun.push(day);
    } else {
      addDryAlert(alerts, dryRun, crop, source, thresholds);
      dryRun = [];
    }
  }
  addDryAlert(alerts, dryRun, crop, source, thresholds);
  return alerts;
}

function addDryAlert(alerts, dryRun, crop, source, thresholds) {
  if (dryRun.length < thresholds.drySpellDays) return;
  const start = dryRun[0].date;
  const end = dryRun[dryRun.length - 1].date;
  alerts.push({
    id: `dry-spell-${start}`,
    title: 'Prolonged dry weather',
    severity: 'moderate',
    affectedCrop: crop || 'Farm',
    reason: `${dryRun.length} consecutive forecast days have no more than ${thresholds.dryDayRainMm} mm rain per day.`,
    action: 'Check measured root-zone soil moisture and crop stage before deciding whether to irrigate.',
    period: start === end ? start : `${start} to ${end}`,
    source
  });
}

function getRecommendation({ forecast, alerts, crop, soilMoisture, reviewDays, thresholds }) {
  if (!forecast.length) {
    return 'A reliable forecast is unavailable. No irrigation schedule can be recommended; check current field conditions and try again later.';
  }
  const nearHeavyRain = forecast.slice(0, 2).some(day =>
    alerts.some(alert => alert.id === `heavy-rain-${day.date}`)
  );
  if (nearHeavyRain) {
    return `Rain is forecast soon${crop ? ` for your ${crop} field` : ''}. Check drainage and root-zone soil moisture before watering; the forecast alone cannot determine field conditions.`;
  }
  if (soilMoisture && soilMoisture.value <= thresholds.soilMoistureLowPct) {
    return `Your recent farmer-entered soil moisture measurement is ${soilMoisture.value}% (${soilMoisture.measuredAt}). Recheck it in the field and consider local crop-stage guidance before irrigation; this value is not a live sensor reading.`;
  }
  const firstDryDay = reviewDays[0];
  if (firstDryDay) {
    return `Use ${firstDryDay.date} as a soil-moisture review day${crop ? ` for ${crop}` : ''}. This is not a watering instruction: check the root zone and crop stage before deciding.`;
  }
  return `Check root-zone soil moisture${crop ? ` for ${crop}` : ''} before watering. No measured soil moisture is available, so a precise irrigation date, duration, or quantity cannot be determined.`;
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
