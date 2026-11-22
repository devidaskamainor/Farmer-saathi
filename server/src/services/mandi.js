import { fetchJson } from '../utils/http.js';
import { getOrSetCache } from './cache.js';
import { MANDI_BENCHMARK_RECORDS, COMMODITY_SYNONYMS } from '../data/mandiBenchmarkData.js';

const resourceId = () => process.env.AGMARKNET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070';

export function matchCommodity(recordCommodity, searchCommodity) {
  if (!searchCommodity) return true;
  const rc = (recordCommodity || '').toLowerCase().trim();
  const sc = searchCommodity.toLowerCase().trim();
  if (rc === sc || rc.includes(sc) || sc.includes(rc)) return true;

  // Check synonym groups
  for (const [key, synonyms] of Object.entries(COMMODITY_SYNONYMS)) {
    const searchMatchesGroup = key === sc || synonyms.some(s => s === sc || sc.includes(s) || s.includes(sc));
    if (searchMatchesGroup) {
      if (synonyms.some(s => rc === s || rc.includes(s) || s.includes(rc))) {
        return true;
      }
    }
  }
  return false;
}

export function queryBenchmarkMandiRecords(filters = {}) {
  const reqCommodity = String(filters.commodity || '').trim();
  const reqState = String(filters.state || '').trim().toLowerCase();
  const reqDistrict = String(filters.district || '').trim().toLowerCase();
  const reqMarket = String(filters.market || '').trim().toLowerCase();

  let matched = MANDI_BENCHMARK_RECORDS.filter(r => {
    // 1. Commodity match
    if (!matchCommodity(r.commodity, reqCommodity)) return false;

    // 2. State match
    if (reqState && r.state.toLowerCase() !== reqState) return false;

    // 3. Market match (if specified)
    if (reqMarket && !r.market.toLowerCase().includes(reqMarket)) return false;

    return true;
  });

  // If district filter is requested:
  if (reqDistrict && matched.length > 0) {
    const districtMatched = matched.filter(r => r.district.toLowerCase() === reqDistrict);
    // If matching records found in that district, use them;
    // otherwise keep state-level records so the farmer isn't left empty-handed.
    if (districtMatched.length > 0) {
      matched = districtMatched;
    }
  }

  // Sort by modal price descending
  matched.sort((a, b) => (b.modalPrice ?? 0) - (a.modalPrice ?? 0));

  return {
    records: matched,
    source: 'AGMARKNET Reported Market Prices',
    fetchedAt: new Date().toISOString(),
    total: matched.length
  };
}

async function fetchLiveMandiRecords(apiKey, filters) {
  const params = new URLSearchParams({ 'api-key': apiKey, format: 'json', limit: '100' });
  const mapping = { state: 'state', district: 'district', commodity: 'commodity', market: 'market' };
  for (const [key, apiField] of Object.entries(mapping)) {
    const value = String(filters[key] || '').trim();
    if (value) params.set(`filters[${apiField}]`, value);
  }
  const payload = await fetchJson(`https://api.data.gov.in/resource/${resourceId()}?${params}`);
  const records = (payload.records || []).map(record => ({
    commodity: record.commodity || record.Commodity || '',
    variety: record.variety || record.Variety || '',
    grade: record.grade || record.Grade || '',
    market: record.market || record.Market || '',
    district: record.district || record.District || '',
    state: record.state || record.State || '',
    minPrice: numberOrNull(record.min_price ?? record.Min_Price),
    maxPrice: numberOrNull(record.max_price ?? record.Max_Price),
    modalPrice: numberOrNull(record.modal_price ?? record.Modal_Price),
    marketDate: record.arrival_date || record.Arrival_Date || '',
    priceUnit: record.unit || record.Unit || '₹/quintal'
  }));

  if (records.length === 0) return null;

  return {
    records,
    source: 'AGMARKNET (Live) via data.gov.in',
    fetchedAt: new Date().toISOString(),
    total: payload.total ?? records.length
  };
}

export async function getMandiPrices(filters = {}) {
  const cacheKey = `mandi:prices:${JSON.stringify(filters)}`;
  return getOrSetCache(cacheKey, async () => {
    const apiKey = process.env.AGMARKNET_API_KEY;
    if (apiKey) {
      try {
        const liveResult = await fetchLiveMandiRecords(apiKey, filters);
        if (liveResult && liveResult.records?.length > 0) {
          return liveResult;
        }
      } catch (err) {
        console.warn('AGMARKNET live fetch failed, falling back to benchmark records:', err?.message || err);
      }
    }

    return queryBenchmarkMandiRecords(filters);
  }, 900);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

export async function compareMandiPrices(filters = {}) {
  const result = await getMandiPrices(filters);
  return {
    ...result,
    records: [...result.records].sort((a, b) => (b.modalPrice ?? -Infinity) - (a.modalPrice ?? -Infinity)),
    trends: buildMandiTrends(result.records)
  };
}

export function buildMandiTrends(records) {
  const groups = new Map();
  for (const record of records) {
    if (!record.priceUnit || record.modalPrice == null) continue;
    const date = normalizeMarketDate(record.marketDate);
    if (!date) continue;
    const key = [
      record.commodity, record.variety, record.grade, record.market, record.district, record.state, record.priceUnit
    ].join('\u0000');
    const group = groups.get(key) || {
      commodity: record.commodity,
      variety: record.variety,
      grade: record.grade,
      market: record.market,
      district: record.district,
      state: record.state,
      priceUnit: record.priceUnit,
      dates: new Map()
    };
    const daily = group.dates.get(date) || [];
    daily.push(record.modalPrice);
    group.dates.set(date, daily);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap(group => {
    const series = [...group.dates.entries()]
      .filter(([, prices]) => prices.length === 1)
      .map(([date, prices]) => ({ date, modalPrice: prices[0] }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (series.length < 2) return [];
    const first = series[0];
    const latest = series[series.length - 1];
    const change = latest.modalPrice - first.modalPrice;
    return [{
      commodity: group.commodity,
      variety: group.variety,
      grade: group.grade,
      market: group.market,
      district: group.district,
      state: group.state,
      priceUnit: group.priceUnit,
      series,
      change,
      changePercent: first.modalPrice > 0 ? (change / first.modalPrice) * 100 : null
    }];
  });
}

function normalizeMarketDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isValidDate(text) ? text : null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return isValidDate(date) ? date : null;
}

function isValidDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
