import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFarmActivity, deleteFarmActivity, updateFarmActivity, validateFarmActivity
} from '../src/services/farmHistory.js';

const activity = {
  crop: 'Tomato',
  eventType: 'irrigation',
  eventDate: '2026-11-21',
  amount: '12',
  unit: 'mm',
  notes: 'North plot'
};

test('farm activity validation normalizes values and rejects unknown fields', () => {
  assert.deepEqual(validateFarmActivity(activity), {
    crop: 'Tomato',
    eventType: 'irrigation',
    eventDate: '2026-11-21',
    amount: 12,
    unit: 'mm',
    notes: 'North plot'
  });
  assert.throws(() => validateFarmActivity({ ...activity, ownerId: 'other-user' }), /cannot be saved/);
  assert.throws(() => validateFarmActivity({ ...activity, eventDate: '2026-02-30' }), /valid activity date/);
  assert.throws(() => validateFarmActivity({ ...activity, amount: -1 }), /non-negative number/);
});

test('farm activity updates and deletes are constrained to the authenticated farmer', async () => {
  const calls = [];
  const db = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('update')) return { rows: [] };
      return { rowCount: 0, rows: [] };
    }
  };
  await assert.rejects(() => updateFarmActivity(db, 'farmer-a', 'event-b', validateFarmActivity(activity)), {
    status: 404
  });
  await assert.rejects(() => deleteFarmActivity(db, 'farmer-a', 'event-b'), { status: 404 });
  assert.deepEqual(calls[0].values.slice(-2), ['event-b', 'farmer-a']);
  assert.match(calls[0].sql, /where id = \$7 and farmer_id = \$8/);
  assert.deepEqual(calls[1].values, ['event-b', 'farmer-a']);
  assert.match(calls[1].sql, /where id = \$1 and farmer_id = \$2/);
});

test('farm activity inserts bind the authenticated farmer ID', async () => {
  const db = {
    async query(_sql, values) {
      return { rows: [{
        id: 'event-1', crop: values[1], event_type: values[2], event_date: values[3],
        amount: values[4], unit: values[5], notes: values[6], created_at: '2026-11-21T00:00:00Z'
      }] };
    }
  };
  const saved = await createFarmActivity(db, 'farmer-a', validateFarmActivity(activity));
  assert.equal(saved.crop, 'Tomato');
  assert.equal(saved.amount, 12);
});
