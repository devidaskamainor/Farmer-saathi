import { HttpError } from '../utils/http.js';

export const activityTypes = new Set(['sowing', 'irrigation', 'fertilizer', 'observation', 'disease', 'harvest']);
const allowedFields = new Set(['crop', 'eventType', 'eventDate', 'amount', 'unit', 'notes']);

export function validateFarmActivity(input = {}) {
  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) throw new HttpError(400, `The field '${key}' cannot be saved.`);
  }
  const crop = typeof input.crop === 'string' ? input.crop.trim() : '';
  if (!crop || crop.length > 100) throw new HttpError(400, 'Crop must be between 1 and 100 characters.');

  const eventType = input.eventType;
  if (!activityTypes.has(eventType)) throw new HttpError(400, 'Choose a supported farm activity.');

  const eventDate = input.eventDate;
  if (!isDateOnly(eventDate)) throw new HttpError(400, 'Enter a valid activity date.');
  const amount = input.amount === '' || input.amount == null ? null : Number(input.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999.999)) {
    throw new HttpError(400, 'Amount must be a non-negative number.');
  }

  const unit = input.unit == null ? '' : input.unit;
  const notes = input.notes == null ? '' : input.notes;
  if (typeof unit !== 'string' || unit.length > 40) throw new HttpError(400, 'Unit must be 40 characters or fewer.');
  if (typeof notes !== 'string' || notes.length > 1000) throw new HttpError(400, 'Notes must be 1,000 characters or fewer.');

  return { crop, eventType, eventDate, amount, unit: unit.trim(), notes: notes.trim() };
}

export async function listFarmHistory(db, farmerId) {
  const { rows } = await db.query(
    `select id, crop, event_type, event_date, amount, unit, notes, created_at
     from farming_history where farmer_id = $1
     order by event_date desc, created_at desc limit 100`,
    [farmerId]
  );
  return rows.map(mapHistory);
}

export async function createFarmActivity(db, farmerId, activity) {
  const { rows } = await db.query(
    `insert into farming_history
     (farmer_id, crop, event_type, event_date, amount, unit, notes)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, crop, event_type, event_date, amount, unit, notes, created_at`,
    [farmerId, activity.crop, activity.eventType, activity.eventDate, activity.amount, activity.unit, activity.notes]
  );
  return mapHistory(rows[0]);
}

export async function updateFarmActivity(db, farmerId, activityId, activity) {
  const { rows } = await db.query(
    `update farming_history
     set crop = $1, event_type = $2, event_date = $3, amount = $4, unit = $5, notes = $6
     where id = $7 and farmer_id = $8
     returning id, crop, event_type, event_date, amount, unit, notes, created_at`,
    [activity.crop, activity.eventType, activity.eventDate, activity.amount, activity.unit, activity.notes, activityId, farmerId]
  );
  if (!rows[0]) throw new HttpError(404, 'Farm activity not found.');
  return mapHistory(rows[0]);
}

export async function deleteFarmActivity(db, farmerId, activityId) {
  const result = await db.query(
    'delete from farming_history where id = $1 and farmer_id = $2',
    [activityId, farmerId]
  );
  if (!result.rowCount) throw new HttpError(404, 'Farm activity not found.');
}

function mapHistory(row) {
  return {
    id: row.id,
    crop: row.crop,
    eventType: row.event_type,
    eventDate: row.event_date,
    amount: row.amount == null ? null : Number(row.amount),
    unit: row.unit,
    notes: row.notes,
    createdAt: row.created_at
  };
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
