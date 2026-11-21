import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMandiTrends } from '../src/services/mandi.js';

test('mandi trends compare only records with matching market, variety, grade, and unit', () => {
  const trends = buildMandiTrends([
    { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', market: 'A', district: 'X', state: 'Karnataka', marketDate: '01/11/2026', modalPrice: 2000, priceUnit: '₹/quintal' },
    { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', market: 'A', district: 'X', state: 'Karnataka', marketDate: '2026-11-02', modalPrice: 2200, priceUnit: '₹/quintal' },
    { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', market: 'B', district: 'X', state: 'Karnataka', marketDate: '2026-11-03', modalPrice: 2400, priceUnit: '₹/quintal' },
    { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', market: 'A', district: 'X', state: 'Karnataka', marketDate: '2026-11-04', modalPrice: 2500, priceUnit: '₹/bag' }
  ]);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].series.length, 2);
  assert.equal(trends[0].change, 200);
  assert.equal(trends[0].changePercent, 10);
});

test('mandi trends omit ambiguous same-date rows and records with unknown units', () => {
  const trends = buildMandiTrends([
    { commodity: 'Rice', market: 'A', marketDate: '2026-11-01', modalPrice: 1000, priceUnit: '₹/quintal' },
    { commodity: 'Rice', market: 'A', marketDate: '2026-11-01', modalPrice: 1050, priceUnit: '₹/quintal' },
    { commodity: 'Rice', market: 'A', marketDate: '2026-11-02', modalPrice: 1100, priceUnit: '₹/quintal' },
    { commodity: 'Rice', market: 'B', marketDate: '2026-11-01', modalPrice: 900, priceUnit: '' },
    { commodity: 'Rice', market: 'B', marketDate: '2026-11-02', modalPrice: 950, priceUnit: '' }
  ]);
  assert.deepEqual(trends, []);
});
