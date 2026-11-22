import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import {
  computeSatelliteAnalysis,
  getSatelliteCropMonitoring
} from '../src/services/satellite.js';
import { signJwt } from '../src/services/jwt.js';

const mockTelemetry = {
  daily: {
    temperature_2m_max: [32.0, 31.5, 30.8],
    temperature_2m_min: [20.5, 20.0, 19.8],
    et0_fao_evapotranspiration: [4.9, 4.7, 5.1],
    shortwave_radiation_sum: [22.1, 21.8, 22.5]
  },
  hourly: {
    soil_moisture_0_to_1cm: Array(24).fill(0.26),
    soil_moisture_1_to_3cm: Array(24).fill(0.30),
    soil_moisture_3_to_9cm: Array(24).fill(0.34)
  }
};

test('computeSatelliteAnalysis calculates spectral indices within valid physical bounds', () => {
  const result = computeSatelliteAnalysis({
    latitude: 17.9104,
    longitude: 77.5199,
    location: 'Bidar, Karnataka, India',
    crop: 'Tomato',
    farmSizeAcres: 3.5,
    telemetry: mockTelemetry,
    language: 'en'
  });

  // Verify Spectral Indices
  assert.ok(result.indices.ndvi.value >= 0.2 && result.indices.ndvi.value <= 0.95);
  assert.ok(result.indices.ndwi.value >= -0.3 && result.indices.ndwi.value <= 0.6);
  assert.ok(result.indices.ndre.value >= 0.1 && result.indices.ndre.value <= 0.65);
  assert.ok(result.indices.evi.value >= 0.1 && result.indices.evi.value <= 0.95);
  assert.ok(result.indices.savi.value >= 0.1 && result.indices.savi.value <= 0.95);

  // Ratings and descriptions
  assert.ok(['Optimal Vigor', 'Healthy Canopy', 'Moderate Vigor', 'Stress / Sparse Canopy'].includes(result.indices.ndvi.rating));
  assert.ok(result.indices.ndvi.color.startsWith('#'));
  assert.ok(result.indices.ndwi.rating.length > 0);

  // Satellite Pass Metadata
  assert.equal(result.meta.provider, 'Copernicus Sentinel-2 Constellation');
  assert.ok(result.meta.satellite.startsWith('Sentinel-2'));
  assert.ok(result.meta.spatialResolution.includes('10m'));
  assert.ok(result.meta.lastOverpassDate.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(result.meta.nextOverpassDate.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(result.meta.cloudCoverPct >= 0 && result.meta.cloudCoverPct <= 100);

  // Soil & Evapotranspiration
  assert.ok(result.soilAndAtmosphere.rootZoneMoisturePct >= 10 && result.soilAndAtmosphere.rootZoneMoisturePct <= 100);
  assert.equal(result.soilAndAtmosphere.dailyEvapotranspirationMm, 4.9);
});

test('computeSatelliteAnalysis generates accurate 3x3 spatial field zoning heatmap', () => {
  const result = computeSatelliteAnalysis({
    latitude: 15.3173,
    longitude: 75.7139,
    location: 'Gadag, Karnataka',
    crop: 'Cotton',
    farmSizeAcres: 4.5,
    telemetry: mockTelemetry
  });

  const zones = result.fieldZoning.zones;
  assert.equal(zones.length, 9);

  // Verify grid identifiers A1 through C3
  const expectedIds = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
  assert.deepEqual(zones.map(z => z.id), expectedIds);

  zones.forEach(zone => {
    assert.ok(zone.name.length > 0);
    assert.ok(zone.ndvi >= 0.1 && zone.ndvi <= 1.0);
    assert.ok(zone.ndwi >= -0.5 && zone.ndwi <= 1.0);
    assert.ok(zone.soilMoisturePct >= 0 && zone.soilMoisturePct <= 100);
    assert.ok(['optimal', 'healthy', 'moderate', 'stressed'].includes(zone.status));
    assert.ok(zone.color.startsWith('#'));
    assert.ok(zone.observation.length > 10);
  });

  // Verify distribution percentages total 100%
  const dist = result.fieldZoning.distribution;
  const totalPct = dist.optimalPct + dist.healthyPct + dist.moderatePct + dist.stressedPct;
  assert.equal(totalPct, 100);
});

test('computeSatelliteAnalysis generates regional crops, farm parcels, sections, and satellite imagery tiles', () => {
  const result = computeSatelliteAnalysis({
    latitude: 17.9104,
    longitude: 77.5199,
    location: 'Bidar, Karnataka, India',
    crop: 'Sugarcane',
    farmSizeAcres: 5.0,
    telemetry: mockTelemetry
  });

  // Regional Crops (Crops grown over there)
  assert.ok(result.regionalCrops.length >= 4);
  const cropNames = result.regionalCrops.map(c => c.name);
  assert.ok(cropNames.includes('Sugarcane'));
  assert.ok(cropNames.includes('Soybean'));
  assert.ok(result.regionalCrops.every(c => c.sharePct > 0 && c.color.startsWith('#')));

  // Farm-Level Mapped Crop Parcels
  assert.ok(result.farmParcels.length >= 2);
  assert.equal(result.farmParcels[0].crop, 'Sugarcane');
  assert.ok(result.farmParcels[0].areaAcres > 0);
  assert.ok(result.farmParcels[0].color.startsWith('#'));

  // Section-by-Section Workflow (Section A, B, C, D)
  assert.equal(result.farmSections.length, 4);
  const sectionIds = result.farmSections.map(s => s.id);
  assert.deepEqual(sectionIds, ['sec-a', 'sec-b', 'sec-c', 'sec-d']);

  const secA = result.farmSections.find(s => s.id === 'sec-a');
  assert.equal(secA.vegetationCondition, 'Healthy vegetation');
  assert.equal(secA.inspectionRequired, false);

  const secB = result.farmSections.find(s => s.id === 'sec-b');
  assert.equal(secB.vegetationCondition, 'Declining vegetation index');
  assert.equal(secB.inspectionRequired, true);

  const secC = result.farmSections.find(s => s.id === 'sec-c');
  assert.equal(secC.vegetationCondition, 'Sparse vegetation');
  assert.equal(secC.inspectionRequired, true);

  // High-Resolution Satellite Tile Metadata
  assert.ok(result.tileMetadata.centerTileUrl.includes('ArcGIS/rest/services/World_Imagery'));
  assert.equal(result.tileMetadata.surroundingTiles.length, 9);
  assert.equal(result.meta.imageryLayers.length, 5);

  // Weather Correlation & Alerts
  assert.ok(result.weatherCorrelation.assessment.length > 0);
  assert.ok(['stress', 'beneficial', 'stable'].includes(result.weatherCorrelation.trendImpact));
  assert.ok(Array.isArray(result.alerts));
});

test('computeSatelliteAnalysis generates 6-week historical Sentinel-2 overpass trajectory', () => {
  const result = computeSatelliteAnalysis({
    latitude: 12.9716,
    longitude: 77.5946,
    location: 'Bengaluru, Karnataka',
    crop: 'Paddy',
    telemetry: mockTelemetry
  });

  const history = result.timeSeries;
  assert.equal(history.length, 6);

  history.forEach(pass => {
    assert.ok(pass.date.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(['Sentinel-2A', 'Sentinel-2B'].includes(pass.satellite));
    assert.ok(pass.ndvi > 0);
    assert.ok(pass.stage.length > 0);
  });
});

test('computeSatelliteAnalysis generates actionable agronomic advisories and spoken narration', () => {
  const result = computeSatelliteAnalysis({
    latitude: 18.5204,
    longitude: 73.8567,
    location: 'Pune, Maharashtra',
    crop: 'Sugarcane',
    telemetry: mockTelemetry
  });

  // Recommendations
  assert.ok(result.recommendations.length >= 2);
  const categories = result.recommendations.map(r => r.category);
  assert.ok(categories.includes('Irrigation'));
  assert.ok(categories.includes('Nutrient Management'));

  result.recommendations.forEach(rec => {
    assert.ok(['High', 'Medium', 'Low'].includes(rec.priority));
    assert.ok(rec.title.length > 0);
    assert.ok(rec.details.length > 0);
    assert.ok(rec.action.length > 0);
  });

  // Spoken summary
  assert.ok(result.spokenSummary.includes('Farmer Saathi Satellite Crop Report'));
  assert.ok(result.spokenSummary.includes('NDVI'));
  assert.ok(result.spokenSummary.includes('NDWI'));
});

test('getSatelliteCropMonitoring falls back gracefully when external service is offline', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Network offline in test');
  };

  try {
    const result = await getSatelliteCropMonitoring({
      latitude: 17.9104,
      longitude: 77.5199,
      crop: 'Wheat',
      location: 'Bidar, Karnataka'
    });

    assert.ok(result.indices.ndvi.value > 0);
    assert.equal(result.fieldZoning.zones.length, 9);
    assert.ok(result.recommendations.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

let server;
let baseUrl;

before(async () => {
  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

test('/api/satellite rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${baseUrl}/api/satellite`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.message, /sign in/i);
});

test('/api/satellite/zones rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${baseUrl}/api/satellite/zones`);
  assert.equal(res.status, 401);
});

test('/api/satellite/history rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${baseUrl}/api/satellite/history`);
  assert.equal(res.status, 401);
});
