import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCache, setCache, delCache, getOrSetCache, getCacheHealth, closeCache
} from '../src/services/cache.js';

test('cache stores and retrieves values with in-memory fallback', async () => {
  await setCache('test:key1', { message: 'hello world' }, 10);
  const result = await getCache('test:key1');
  assert.deepEqual(result, { message: 'hello world' });
});

test('cache returns null for non-existent key', async () => {
  const result = await getCache('test:missing_key');
  assert.equal(result, null);
});

test('delCache deletes cached values', async () => {
  await setCache('test:del_key', 'value_to_delete', 10);
  assert.equal(await getCache('test:del_key'), 'value_to_delete');
  await delCache('test:del_key');
  assert.equal(await getCache('test:del_key'), null);
});

test('getOrSetCache fetches on miss and returns cached on hit', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { data: 'computed_data' };
  };

  const first = await getOrSetCache('test:memo', fetcher, 10);
  assert.equal(calls, 1);
  assert.deepEqual(first, { data: 'computed_data' });

  const second = await getOrSetCache('test:memo', fetcher, 10);
  assert.equal(calls, 1); // Not called again!
  assert.deepEqual(second, { data: 'computed_data' });

  await delCache('test:memo');
});

test('getCacheHealth returns health metadata without crashing', async () => {
  const health = getCacheHealth();
  assert.ok(health.provider === 'redis' || health.provider === 'in-memory-fallback');
  assert.equal(typeof health.connected, 'boolean');
  assert.equal(typeof health.redisConfigured, 'boolean');
});
