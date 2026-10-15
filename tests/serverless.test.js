import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from '../backend/database.js';
import { createServerlessHandler, SERVERLESS_PAYLOAD_BYTES } from '../backend/serverless.js';
import { createRateLimiter } from '../backend/rate-limit.js';

const environment = () => ({ TURSO_DATABASE_URL: 'libsql://test.invalid', TURSO_AUTH_TOKEN: 'test-token', FINANCAS_USER: 'owner', FINANCAS_PASSWORD: 'owner-test-password' });
const document = description => ({ version: 5, customCategories: [], transactions: [{ id: 'one', description, amount: 12, rawDate: '2026-10-15', type: 'expense', paid: true }] });
async function listen(t, handler, parse = false) {
  const server = createServer(async (req, res) => {
    if (parse && ['POST', 'PUT'].includes(req.method)) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      if (req.headers['x-test-body'] === 'buffer') req.body = body;
      else if (req.headers['x-test-body'] === 'string') req.body = body.toString('utf8');
      else { try { req.body = JSON.parse(body.toString('utf8')); } catch { req.body = body.toString('utf8'); } }
    }
    await handler(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
async function fixture(t, parse = false) {
  const dir = await mkdtemp(join(tmpdir(), 'financas-serverless-'));
  const stores = [];
  // Register this first so the HTTP servers close before the shared database.
  t.after(async () => { for (const store of stores) store.close(); await rm(dir, { recursive: true }); });
  const make = () => createServerlessHandler({ environment: environment(), openDatabase: async options => {
    assert.match(options.url, /^libsql:\/\//);
    const store = await openStore({ file: join(dir, 'bank.sqlite3') }); stores.push(store); return store;
  } });
  const handler = make();
  const url = await listen(t, handler, parse);
  const post = (path, body, Cookie, extra = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(Cookie ? { Cookie } : {}), ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const owner = async () => {
    const response = await post('/api/login', { username: 'owner', password: 'owner-test-password' });
    assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /; Secure/);
    return response.headers.get('set-cookie').split(';')[0];
  };
  return { stores, make, handler, url, post, owner };
}
test('serverless refuses missing credentials and local database URLs without creating a disk store', async t => {
  const env = {}; let opened = 0;
  const handler = createServerlessHandler({ environment: env, openDatabase: async () => { opened++; throw new Error('test'); } });
  const url = await listen(t, handler);
  for (const config of [{}, { ...environment(), TURSO_DATABASE_URL: 'file:/tmp/not-allowed' }, { ...environment(), TURSO_AUTH_TOKEN: '' }, { ...environment(), FINANCAS_PASSWORD: '' }]) {
    for (const key of Object.keys(env)) delete env[key]; Object.assign(env, config);
    const response = await fetch(url + '/health');
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!(await response.text()).includes('test-token'));
  }
  assert.equal(opened, 0);
});
test('one warm initialization serves concurrent routes and protects pages while exposing PWA assets', async t => {
  const f = await fixture(t);
  const paths = ['/health', '/login.html', '/manifest.webmanifest', '/sw.js', '/icons/apple-touch-icon-v2.png', '/api/state', '/'];
  const replies = await Promise.all(paths.map(path => fetch(f.url + path, { redirect: 'manual' })));
  assert.deepEqual(replies.map(response => response.status), [200, 200, 200, 200, 200, 401, 303]);
  assert.equal(f.stores.length, 1);
  assert.equal(replies[3].headers.get('service-worker-allowed'), '/');
  assert.match(replies[2].headers.get('content-type'), /application\/manifest\+json/);
});
test('serverless accepts already-parsed JSON objects, strings and buffers with origin and size checks', async t => {
  const f = await fixture(t, true);
  for (const format of ['object', 'string', 'buffer']) {
    const response = await f.post('/api/login', { username: 'owner', password: 'owner-test-password' }, null, { 'X-Test-Body': format });
    assert.equal(response.status, 200);
  }
  assert.equal((await f.post('/api/login', '{bad-json')).status, 400);
  assert.equal((await f.post('/api/login', { username: 'x'.repeat(5000), password: 'password' })).status, 413);
  assert.equal((await f.post('/api/login', {}, null, { Origin: 'https://foreign.example' })).status, 403);
});
test('owner and registered accounts keep isolated finances across independent cold instances', async t => {
  const f = await fixture(t, true), ownerCookie = await f.owner();
  await f.stores[0].save(document('Owner'), 0);
  const registration = await f.post('/api/register', { username: 'alice', name: 'Alice', password: 'test-password-123' });
  assert.equal(registration.status, 201);
  const Cookie = registration.headers.get('set-cookie').split(';')[0];
  const profile = await (await fetch(f.url + '/api/session', { headers: { Cookie } })).json();
  assert.equal(profile.maxStateBytes, SERVERLESS_PAYLOAD_BYTES);
  const put = await fetch(f.url + '/api/state', { method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json', 'X-Meu-Bolso-Account': profile.user.id }, body: JSON.stringify({ revision: 0, data: document('Alice') }) });
  assert.equal(put.status, 200);
  const second = await listen(t, f.make());
  const alice = await (await fetch(second + '/api/state', { headers: { Cookie } })).json();
  assert.equal(alice.data.transactions[0].description, 'Alice');
  const owner = await (await fetch(second + '/api/state', { headers: { Cookie: ownerCookie } })).json();
  assert.equal(owner.data.transactions[0].description, 'Owner');
  await f.post('/api/logout', {}, Cookie);
  assert.equal((await fetch(second + '/api/state', { headers: { Cookie } })).status, 401);
});
test('serverless enforces transport payload limits before writing and before oversized responses', async t => {
  const f = await fixture(t, true), Cookie = await f.owner();
  const response = await fetch(f.url + '/api/state', { method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, data: document('x'.repeat(SERVERLESS_PAYLOAD_BYTES)) }) });
  assert.equal(response.status, 413);
  assert.equal((await f.stores[0].read()).revision, 0);
  // A revision growing from one to two digits must not create an unreadable response.
  await f.stores[0].client.execute('UPDATE financas_state SET revision=9 WHERE id=1');
  const padding = SERVERLESS_PAYLOAD_BYTES - Buffer.byteLength(JSON.stringify({ revision: 9, data: document('') }));
  const boundary = await fetch(f.url + '/api/state', { method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 9, data: document('x'.repeat(padding)) }) });
  assert.equal(boundary.status, 413);
  assert.equal((await f.stores[0].read()).revision, 9);
  await f.stores[0].save(document('x'.repeat(SERVERLESS_PAYLOAD_BYTES)), 9);
  const oversized = await fetch(f.url + '/api/state', { headers: { Cookie } });
  assert.equal(oversized.status, 413);
  assert.match((await oversized.json()).error, /limite de resposta/);
});
test('registration limits are shared across newly initialized Functions', async t => {
  const f = await fixture(t); await fetch(f.url + '/health');
  const limits = await createRateLimiter(f.stores[0].client);
  for (let i = 0; i < 10; i++) assert.equal((await limits.take('register', 10)).allowed, true);
  const second = await listen(t, f.make());
  const blocked = await fetch(second + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});
test('a failed initialization is retried and closes an incomplete store', async t => {
  let attempts = 0, closed = 0;
  const handler = createServerlessHandler({ environment: environment(), openDatabase: async () => {
    attempts++; return { client: { execute: async () => { throw new Error('private initialization detail'); } }, close: () => closed++ };
  } });
  const url = await listen(t, handler);
  for (let i = 0; i < 2; i++) { const response = await fetch(url); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private initialization detail')); }
  assert.equal(attempts, 2); assert.equal(closed, 2);
});
test('Vercel configuration routes requests to the Function and packages the protected frontend', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.buildCommand, 'npm run build:vercel');
  assert.equal(config.outputDirectory, 'vercel-public');
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/api/index' }]);
  assert.equal(config.functions['api/index.js'].includeFiles, 'frontend/**');
  const entry = await import('../api/index.js'); assert.equal(typeof entry.default, 'function');
});
