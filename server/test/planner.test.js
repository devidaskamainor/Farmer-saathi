import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFarmPlan, getPlannerThresholds } from '../src/services/planner.js';

const thresholds = getPlannerThresholds({});
const forecast = [
  { date: '2026-11-21', rainMm: 0, maxC: 31 },
  { date: '2026-11-22', rainMm: 28, maxC: 32 },
  { date: '2026-11-23', rainMm: 0, maxC: 39 },
  { date: '2026-11-24', rainMm: 0, maxC: 30 },
  { date: '2026-11-25', rainMm: 0, maxC: 30 },
  { date: '2026-11-26', rainMm: 0, maxC: 30 },
  { date: '2026-11-27', rainMm: 0, maxC: 30 }
];

test('planner creates source-labelled weather risk alerts and a cautious dry-spell review', () => {
  const plan = buildFarmPlan({
    village: 'Hunsur', district: 'Mysuru', state: 'Karnataka',
    currentCrops: ['Tomato'], farmPlan: { growthStage: 'Flowering' }, soil: {}
  }, {
    location: 'Hunsur, Karnataka', forecast, source: 'Open-Meteo', fetchedAt: '2026-11-21T00:00:00Z'
  }, thresholds, new Date('2026-11-21T00:00:00Z'));

  assert.equal(plan.forecastDays, 7);
  assert.equal(plan.forecastSource, 'Open-Meteo');
  assert.ok(plan.alerts.some(alert => alert.title === 'Heavy rainfall forecast'));
  assert.ok(plan.alerts.some(alert => alert.title === 'High temperature forecast'));
  assert.ok(plan.alerts.some(alert => alert.title === 'Prolonged dry weather'));
  assert.match(plan.recommendation, /Rain is forecast soon/);
  assert.equal(plan.soilMoisture, null);
  assert.ok(plan.missingInformation.includes('Recent measured soil moisture'));
  assert.ok(plan.reviewDays.length > 0);
});

test('planner marks stale soil measurements missing and never invents watering quantities', () => {
  const plan = buildFarmPlan({
    village: 'Hunsur', currentCrops: ['Rice'],
    soil: { moisturePct: 20, moistureMeasuredAt: '2026-11-15' }
  }, { forecast, source: 'Open-Meteo' }, thresholds, new Date('2026-11-21T00:00:00Z'));

  assert.equal(plan.soilMoisture, null);
  assert.ok(plan.missingInformation.includes('Recent measured soil moisture'));
  assert.doesNotMatch(plan.recommendation, /\b(liters?|gallons?|minutes?)\b/i);
});

test('planner reports unavailable forecast rather than emitting weather alerts', () => {
  const plan = buildFarmPlan({ soil: {}, currentCrops: [] }, null, thresholds);

  assert.equal(plan.forecastUnavailable, true);
  assert.equal(plan.forecastDays, 0);
  assert.deepEqual(plan.alerts, []);
  assert.match(plan.recommendation, /forecast is unavailable/i);
});

test('planner does not present a short forecast as a complete seven-day outlook', () => {
  const plan = buildFarmPlan({}, { forecast: forecast.slice(0, 5), source: 'Test source' }, thresholds);

  assert.equal(plan.forecastDays, 5);
  assert.equal(plan.forecastUnavailable, true);
  assert.match(plan.forecastUnavailableMessage, /complete seven-day outlook is unavailable/);
});

test('planner rejects invalid configured thresholds', () => {
  assert.throws(
    () => getPlannerThresholds({ FARM_ALERT_HEAVY_RAIN_MM: '0' }),
    /FARM_ALERT_HEAVY_RAIN_MM must be a positive number/
  );
});
