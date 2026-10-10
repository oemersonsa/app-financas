import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../backend/database.js';
import { createApplication } from '../backend/http.js';
const doc = { version: 5, customCategories: [], transactions: [{ id: 'one', description: 'Mercado', amount: 50, type: 'expense', rawDate: '2026-01-31', paid: true }] };
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'financas-'));
  const file = join(directory, 'bank.sqlite3');
  const store = await openStore({ file });
  const server = await createApplication(store, options);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); await rm(directory, { recursive: true }); });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { store, file, get: path => fetch(url + path), put: (data, revision = 0, headers = {}) => fetch(url + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ data, revision }) }), url };
}
test('state persists across clients and retains versions in database', async t => {
  const f = await fixture(t);
  assert.equal((await f.put(doc)).status, 200);
  const second = await openStore({ file: f.file });
  try { assert.deepEqual(await second.read(), { revision: 1, data: doc }); } finally { second.close(); }
  assert.equal((await f.store.client.execute('SELECT COUNT(*) AS n FROM financas_backups')).rows[0].n, 2);
});
test('stale revision and simultaneous writes cannot overwrite state', async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.put(doc), f.put({ ...doc, transactions: [] })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await f.store.read()).revision, 1);
});
test('invalid dates, amounts and duplicate identifiers rejected', async t => {
  const f = await fixture(t);
  for (const change of [{ rawDate: '2026-02-30' }, { amount: -1 }, { totalInstallments: 361 }, { paid: 'yes' }]) {
    assert.equal((await f.put({ ...doc, transactions: [{ ...doc.transactions[0], ...change }] })).status, 400);
  }
  assert.equal((await f.put({ ...doc, transactions: [doc.transactions[0], doc.transactions[0]] })).status, 400);
  assert.equal((await f.store.read()).revision, 0);
});
test('backup failure rolls back both data and revision', async t => {
  const f = await fixture(t);
  await f.store.client.execute("CREATE TRIGGER fail_backup BEFORE INSERT ON financas_backups BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  assert.equal((await f.put(doc)).status, 503);
  assert.equal((await f.store.read()).revision, 0);
  assert.deepEqual((await f.store.read()).data.transactions, []);
});
test('foreign and invalid origins blocked', async t => {
  const f = await fixture(t);
  for (const Origin of ['https://example.com', 'null']) assert.equal((await f.put(doc, 0, { Origin })).status, 403);
  assert.equal((await f.put(doc, 0, { Origin: f.url })).status, 200);
});
test('only frontend files are public', async t => {
  const f = await fixture(t);
  for (const path of ['/server.js', '/backend/database.js', '/data/meu-bolso.sqlite3', '/.env']) assert.equal((await f.get(path)).status, 404);
  assert.equal((await f.get('/')).status, 200);
  for (const path of ['/js/app.js', '/js/domain/installments.js', '/styles/main.css', '/styles/base.css']) {
    const response = await f.get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), path.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
  }
});
test('authentication protects data and files; health discloses only status', async t => {
  const f = await fixture(t, { password: 'test-secret' });
  assert.equal((await f.get('/')).status, 401);
  assert.equal((await f.get('/api/state')).status, 401);
  assert.deepEqual(await (await f.get('/health')).json(), { status: 'ok' });
  const response = await fetch(f.url + '/api/state', { headers: { Authorization: 'Basic ' + Buffer.from('usuario:test-secret').toString('base64') } });
  assert.equal(response.status, 200);
});
test('retention limits history to thirty versions', async t => {
  const f = await fixture(t);
  for (let revision = 0; revision < 35; revision++) await f.store.save(doc, revision);
  const result = await f.store.client.execute('SELECT COUNT(*) AS n, MIN(revision) AS oldest FROM financas_backups');
  assert.equal(result.rows[0].n, 30); assert.equal(result.rows[0].oldest, 6);
});
test('legacy local SQLite state migrated without losing records', async t => {
  const f = await fixture(t);
  await f.store.client.execute('CREATE TABLE state(id INTEGER PRIMARY KEY, revision INTEGER, document TEXT)');
  await f.store.client.execute({ sql: 'INSERT INTO state VALUES(1,7,?)', args: [JSON.stringify(doc)] });
  const migrated = await openStore({ file: f.file });
  try { assert.deepEqual(await migrated.read(), { revision: 7, data: doc }); } finally { migrated.close(); }
});
