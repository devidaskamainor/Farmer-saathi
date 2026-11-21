import { fetchJson, HttpError } from '../utils/http.js';

const resourceId = () => process.env.AGMARKNET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070';

export async function getMandiPrices(filters = {}) {
  const apiKey = process.env.AGMARKNET_API_KEY;
  if (!apiKey) throw new HttpError(503, 'Official mandi data is not configured yet. Add AGMARKNET_API_KEY on the server.');
  const params = new URLSearchParams({ 'api-key': apiKey, format: 'json', limit: '100' });
  const mapping = { state: 'state', district: 'district', commodity: 'commodity' };
  for (const [key, apiField] of Object.entries(mapping)) {
    const value = String(filters[key] || '').trim();
    if (value) params.set(`filters[${apiField}]`, value);
  }
  const payload = await fetchJson(`https://api.data.gov.in/resource/${resourceId()}?${params}`);
  const records = (payload.records || []).map(record => ({
    commodity: record.commodity || record.Commodity || '',
    market: record.market || record.Market || '',
    district: record.district || record.District || '',
    state: record.state || record.State || '',
    minPrice: numberOrNull(record.min_price ?? record.Min_Price),
    maxPrice: numberOrNull(record.max_price ?? record.Max_Price),
    modalPrice: numberOrNull(record.modal_price ?? record.Modal_Price),
    marketDate: record.arrival_date || record.Arrival_Date || ''
  }));
  return { records, source: 'AGMARKNET via data.gov.in', fetchedAt: new Date().toISOString(), total: payload.total ?? records.length };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

export async function compareMandiPrices(filters = {}) {
  const result = await getMandiPrices(filters);
  return { ...result, records: [...result.records].sort((a, b) => (b.modalPrice ?? -Infinity) - (a.modalPrice ?? -Infinity)) };
}
