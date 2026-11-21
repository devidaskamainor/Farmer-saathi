import { HttpError } from '../utils/http.js';

export function mapFarmer(row) {
  return {
    _id: row.id,
    name: row.name,
    email: row.email,
    state: row.state || '',
    district: row.district || '',
    village: row.village || '',
    preferredLanguage: row.preferred_language || 'en',
    farmSize: row.farm_size == null ? undefined : Number(row.farm_size),
    soil: row.soil || {},
    farmPlan: row.farm_plan || {},
    irrigationFacilities: row.irrigation_facilities || [],
    currentCrops: row.current_crops || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getFarmerById(db, userId) {
  const { rows } = await db.query('select * from farmers where id = $1', [userId]);
  return rows[0] ? mapFarmer(rows[0]) : null;
}

export function profileUpdates(body = {}) {
  const columnByField = {
    name: 'name',
    state: 'state',
    district: 'district',
    village: 'village',
    preferredLanguage: 'preferred_language',
    farmSize: 'farm_size',
    soil: 'soil',
    farmPlan: 'farm_plan',
    irrigationFacilities: 'irrigation_facilities',
    currentCrops: 'current_crops'
  };
  const updates = [];
  for (const [field, column] of Object.entries(columnByField)) {
    if (!Object.hasOwn(body, field)) continue;
    let value = body[field];
    if (field === 'name' || ['state', 'district', 'village'].includes(field)) value = String(value || '').trim();
    if (field === 'farmSize' && value === '') value = null;
    if (field === 'soil' || field === 'farmPlan') value = JSON.stringify(value);
    updates.push({ column, value });
  }
  return updates;
}

export async function updateFarmerProfile(db, userId, updates) {
  if (!updates.length) {
    const farmer = await getFarmerById(db, userId);
    if (!farmer) throw new HttpError(404, 'Farmer profile not found.');
    return farmer;
  }
  const assignments = updates.map(({ column }, index) => `${column} = $${index + 1}`);
  assignments.push('updated_at = now()');
  const values = updates.map(({ value }) => value);
  values.push(userId);
  const { rows } = await db.query(
    `update farmers set ${assignments.join(', ')} where id = $${values.length} returning *`,
    values
  );
  if (!rows[0]) throw new HttpError(404, 'Farmer profile not found.');
  return mapFarmer(rows[0]);
}
