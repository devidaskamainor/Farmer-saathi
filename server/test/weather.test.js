import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlanningWeather } from '../src/services/weather.js';

test('farm planner requests and returns seven days from the forecast provider', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async value => {
    const url = new URL(value);
    urls.push(url);
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      return Response.json({ results: [{ name: 'Mysuru', admin1: 'Karnataka', country: 'India', country_code: 'IN', latitude: 12.3, longitude: 76.6, timezone: 'Asia/Kolkata' }] });
    }
    return Response.json({
      current: { temperature_2m: 30, relative_humidity_2m: 60, rain: 0, wind_speed_10m: 2, weather_code: 1 },
      daily: {
        time: Array.from({ length: 7 }, (_, index) => `2026-11-${String(21 + index).padStart(2, '0')}`),
        temperature_2m_min: [20, 20, 20, 20, 20, 20, 20],
        temperature_2m_max: [30, 30, 30, 30, 30, 30, 30],
        rain_sum: [0, 0, 0, 0, 0, 0, 0],
        weather_code: [1, 1, 1, 1, 1, 1, 1]
      }
    });
  };
  try {
    const result = await getPlanningWeather('Mysuru, Karnataka');
    const forecastRequest = urls.find(url => url.hostname === 'api.open-meteo.com');
    assert.equal(forecastRequest.searchParams.get('forecast_days'), '7');
    assert.equal(result.forecast.length, 7);
    assert.equal(result.source, 'Open-Meteo');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
