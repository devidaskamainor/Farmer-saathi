import { fetchJson, HttpError } from '../utils/http.js';

let openWeatherKeyRejected = false;

const weatherText = (code) => ({
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail'
}[code] || 'Conditions unavailable');

export async function getWeather(location) {
  if (!location) throw new HttpError(400, 'Add your village, district, or city to your farmer profile to request a forecast.');

  const apiKey = process.env.WEATHER_API_KEY?.trim();
  if (!apiKey || openWeatherKeyRejected) return getOpenMeteoWeather(location);

  try {
    return await getOpenWeather(location, apiKey);
  } catch (error) {
    if (/api key/i.test(error?.message || '')) openWeatherKeyRejected = true;
    return getOpenMeteoWeather(location);
  }
}

async function getOpenWeather(location, apiKey) {
  const query = new URLSearchParams({ q: location, appid: apiKey, units: 'metric' });
  const [current, forecast] = await Promise.all([
    fetchJson(`https://api.openweathermap.org/data/2.5/weather?${query}`),
    fetchJson(`https://api.openweathermap.org/data/2.5/forecast?${query}`)
  ]);
  const days = new Map();
  for (const item of forecast.list || []) {
    const date = item.dt_txt.slice(0, 10);
    const entry = days.get(date) || { date, temperatures: [], rainMm: 0, conditions: item.weather?.[0]?.description || 'Conditions unavailable' };
    entry.temperatures.push(item.main?.temp);
    entry.rainMm += item.rain?.['3h'] || 0;
    if (item.dt_txt.includes('12:00:00')) entry.conditions = item.weather?.[0]?.description || entry.conditions;
    days.set(date, entry);
  }
  return {
    location: `${current.name}${current.sys?.country ? `, ${current.sys.country}` : ''}`,
    current: {
      temperatureC: current.main?.temp,
      humidity: current.main?.humidity,
      windSpeedMs: current.wind?.speed,
      rainfallMm: current.rain?.['1h'] ?? current.rain?.['3h'] ?? 0,
      conditions: current.weather?.[0]?.description || 'Conditions unavailable'
    },
    forecast: [...days.values()].slice(0, 5).map(day => ({
      date: day.date,
      minC: Math.min(...day.temperatures),
      maxC: Math.max(...day.temperatures),
      rainMm: Number(day.rainMm.toFixed(1)),
      conditions: day.conditions
    })),
    source: 'OpenWeather',
    fetchedAt: new Date().toISOString()
  };
}

async function getOpenMeteoWeather(location) {
  const place = await geocodeIndiaLocation(location);
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,rain,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,rain_sum',
    forecast_days: '5',
    timezone: place.timezone || 'auto',
    wind_speed_unit: 'ms'
  });
  const forecast = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const daily = forecast.daily || {};
  const current = forecast.current || {};
  if (!Number.isFinite(current.temperature_2m) || !Array.isArray(daily.time)) {
    throw new HttpError(502, 'The weather service did not return a usable forecast. Please try again.');
  }

  return {
    location: [place.name, place.admin1, place.country].filter((value, index, values) => value && values.indexOf(value) === index).join(', '),
    current: {
      temperatureC: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeedMs: current.wind_speed_10m,
      rainfallMm: current.rain ?? current.precipitation ?? 0,
      conditions: weatherText(current.weather_code)
    },
    forecast: daily.time.slice(0, 5).map((date, index) => ({
      date,
      minC: daily.temperature_2m_min?.[index],
      maxC: daily.temperature_2m_max?.[index],
      rainMm: Number((daily.rain_sum?.[index] || 0).toFixed(1)),
      conditions: weatherText(daily.weather_code?.[index])
    })),
    source: 'Open-Meteo',
    fetchedAt: new Date().toISOString()
  };
}

async function geocodeIndiaLocation(location) {
  const parts = String(location).split(',').map(part => part.trim()).filter(Boolean);
  const candidates = parts.length > 1
    ? [`${parts[0]}, ${parts.at(-1)}`, `${parts.at(-2)}, ${parts.at(-1)}`, parts[0], parts.at(-2)]
    : [parts[0]];

  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    const params = new URLSearchParams({ name: candidate, count: '5', language: 'en', format: 'json', countryCode: 'IN' });
    const result = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const place = result.results?.find(item => item.country_code === 'IN');
    if (place) return place;
  }
  throw new HttpError(404, 'Could not find this location in India. Check the village or district in your farmer profile.');
}
