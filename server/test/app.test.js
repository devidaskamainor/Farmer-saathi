import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

process.env.CLIENT_ORIGIN = 'http://farmer-saathi.test';
process.env.CLIENT_URL = 'http://farmer-saathi.test';

const { default: app } = await import('../src/app.js');
process.env.DATABASE_URL = '';
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('health endpoint reports an unconfigured database explicitly', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'not_configured');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test('registration reports missing PostgreSQL configuration instead of succeeding', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Ravi',
      email: 'ravi@example.test',
      password: 'secure-password',
      preferredLanguage: 'en'
    })
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /DATABASE_URL/);
});

test('registration rejects language identifiers outside the supported allowlist', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Ravi',
      email: 'ravi@example.test',
      password: 'secure-password',
      preferredLanguage: 'xx'
    })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /supported list/);
});

test('registration checks SMTP configuration before writing an account', async () => {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
  const saved = new Map(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ravi',
        email: 'ravi@example.test',
        password: 'secure-password',
        preferredLanguage: 'en'
      })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /Email verification is not configured/);
  } finally {
    for (const key of keys) {
      if (saved.get(key) === undefined) delete process.env[key];
      else process.env[key] = saved.get(key);
    }
  }
});

test('protected profile API requires an authenticated session cookie', async () => {
  const response = await fetch(`${baseUrl}/api/farmers/profile`);
  assert.equal(response.status, 401);
});

test('planner and farm history endpoints require an authenticated session', async () => {
  const planner = await fetch(`${baseUrl}/api/planner`);
  const history = await fetch(`${baseUrl}/api/farmers/history`);
  assert.equal(planner.status, 401);
  assert.equal(history.status, 401);
});

test('voice transcription and playback endpoints require an authenticated session', async () => {
  const transcription = await fetch(`${baseUrl}/api/voice/transcribe`, { method: 'POST' });
  const playback = await fetch(`${baseUrl}/api/voice/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Hello' })
  });
  assert.equal(transcription.status, 401);
  assert.equal(playback.status, 401);
});

test('legacy verification links redirect to the configured frontend without consuming the token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/verify?token=valid-test-token`, { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'http://farmer-saathi.test/verify-email?token=valid-test-token');
});

test('verification POST accepts the configured frontend origin and requires PostgreSQL', async () => {
  const response = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://farmer-saathi.test' },
    body: JSON.stringify({ token: 'valid-test-token' })
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://farmer-saathi.test');
  assert.match((await response.json()).message, /DATABASE_URL/);
});

test('verification POST rejects a malformed token before database access', async () => {
  const response = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://farmer-saathi.test' },
    body: JSON.stringify({ token: 'bad token' })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /invalid or expired/);
});

test('password reset requests are rate limited', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${baseUrl}/api/auth/password/forgot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    assert.equal(response.status, 400);
  }

  const limitedResponse = await fetch(`${baseUrl}/api/auth/password/forgot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' })
  });
  assert.equal(limitedResponse.status, 429);
  assert.match((await limitedResponse.json()).message, /Too many password reset requests/);
});

test('state-changing requests reject untrusted browser origins', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://untrusted.example' },
    body: JSON.stringify({ email: 'ravi@example.test', password: 'secure-password' })
  });
  assert.equal(response.status, 403);
});

test('local Vite clients on private network addresses can make credentialed requests in development', async () => {
  const origin = 'http://192.168.137.1:5174';
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: 'ravi@example.test', password: 'secure-password' })
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

test('local Vite network origins are rejected in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://192.168.137.1:5173' },
      body: JSON.stringify({ email: 'ravi@example.test', password: 'secure-password' })
    });
    assert.equal(response.status, 403);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
