import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../backend/database.js';
import { createApplication } from '../backend/http.js';
const document = name => ({ version: 5, transactions: [{ id: 'same-id', description: name, amount: 12, type: 'expense', rawDate: '2026-10-14', paid: false }], customCategories: [] });
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'financas-users-'));
  const file = join(directory, 'bank.sqlite3');
  const store = await openStore({ file });
  const server = await createApplication(store, { username: 'owner', password: 'owner-test-password', secureCookies: false });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); await rm(directory, { recursive: true }); });
  const identities = new Map();
  const post = (path, body, Cookie, extra = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(Cookie ? { Cookie } : {}), ...extra }, body: JSON.stringify(body) });
  const get = (Cookie, extra = {}) => fetch(url + '/api/state', { headers: { Cookie, ...extra } });
  const put = (Cookie, data, revision, extra = {}) => fetch(url + '/api/state', { method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json', ...(identities.has(Cookie) ? { 'X-Meu-Bolso-Account': identities.get(Cookie) } : {}), ...extra }, body: JSON.stringify({ data, revision }) });
  const register = async username => {
    const response = await post('/api/register', { username, name: 'Nome ' + username, password: 'test-password-123' });
    assert.equal(response.status, 201);
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const session = await (await fetch(url + '/api/session', { headers: { Cookie } })).json();
    identities.set(Cookie, session.user.id);
    return Cookie;
  };
  return { store, file, url, post, get, put, register };
}
test('registered accounts use salted password hashes, private sessions and normalized usernames', async t => {
  const f = await fixture(t), Cookie = await f.register('Alice');
  const user = (await f.store.client.execute('SELECT * FROM financas_users')).rows[0];
  assert.equal(user.username, 'alice');
  assert.match(user.password_hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.ok(!user.password_hash.includes('test-password-123'));
  const stored = (await f.store.client.execute('SELECT token_hash FROM financas_user_sessions')).rows[0];
  assert.notEqual(stored.token_hash, Cookie.split('=')[1]);
  const profile = await (await fetch(f.url + '/api/session', { headers: { Cookie } })).json();
  assert.equal(profile.user.id, user.id); assert.equal(profile.accountType, 'registered');
  assert.equal((await f.post('/api/login', { username: 'ALICE', password: 'test-password-123', remember: true })).status, 200);
  assert.equal((await f.post('/api/login', { username: 'alice', password: 'wrong' })).status, 401);
});
test('two accounts cannot read or overwrite each other or the existing owner finances', async t => {
  const f = await fixture(t);
  await f.store.save(document('Owner before registration'), 0);
  const alice = await f.register('alice'), bob = await f.register('bob');
  assert.equal((await (await f.get(alice)).json()).data.transactions.length, 0);
  assert.equal((await f.put(alice, document('Alice'), 0)).status, 200);
  assert.equal((await f.put(bob, document('Bob'), 0)).status, 200);
  assert.equal((await (await f.get(alice)).json()).data.transactions[0].description, 'Alice');
  assert.equal((await (await f.get(bob)).json()).data.transactions[0].description, 'Bob');
  assert.equal((await f.store.read()).data.transactions[0].description, 'Owner before registration');
  const owner = (await f.post('/api/login', { username: 'owner', password: 'owner-test-password' })).headers.get('set-cookie').split(';')[0];
  assert.equal((await (await f.get(owner)).json()).data.transactions[0].description, 'Owner before registration');
  const aliceId = (await f.store.client.execute("SELECT id FROM financas_users WHERE username='alice'")).rows[0].id;
  assert.equal((await f.put(bob, document('Spoof'), 1, { 'X-Meu-Bolso-Account': aliceId })).status, 409);
  assert.equal((await f.put(bob, document('Old bundle'), 1, { 'X-Meu-Bolso-Account': '' })).status, 409);
  assert.equal((await (await f.get(bob)).json()).data.transactions[0].description, 'Bob');
});
test('registration validates input, reserves the owner name and rejects duplicates and foreign origins', async t => {
  const f = await fixture(t), body = { username: 'alice', name: 'Alice', password: 'test-password-123' };
  assert.equal((await f.post('/api/register', body, null, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await f.post('/api/register', { ...body, password: 'short' })).status, 400);
  assert.equal((await f.post('/api/register', { ...body, username: 'a b' })).status, 400);
  assert.equal((await f.post('/api/register', { ...body, username: 'OWNER' })).status, 409);
  await f.register('alice');
  assert.equal((await f.post('/api/register', body)).status, 409);
  assert.equal((await f.store.client.execute('SELECT COUNT(*) AS n FROM financas_users')).rows[0].n, 1);
});
test('registered session survives reopening the database and logout revokes it', async t => {
  const f = await fixture(t), Cookie = await f.register('alice');
  await f.put(Cookie, document('Persistent'), 0);
  const reopened = await openStore({ file: f.file });
  const second = await createApplication(reopened, { username: 'owner', password: 'owner-test-password', secureCookies: false });
  second.listen(0, '127.0.0.1'); await once(second, 'listening');
  try {
    const result = await fetch(`http://127.0.0.1:${second.address().port}/api/state`, { headers: { Cookie } });
    assert.equal(result.status, 200); assert.equal((await result.json()).data.transactions[0].description, 'Persistent');
  } finally { await new Promise(resolve => second.close(resolve)); reopened.close(); }
  assert.equal((await f.post('/api/logout', {}, Cookie)).status, 200);
  assert.equal((await f.get(Cookie)).status, 401);
});
test('private revisions reject stale writes and backup failures roll back data', async t => {
  const f = await fixture(t), Cookie = await f.register('alice');
  const results = await Promise.all([f.put(Cookie, document('One'), 0), f.put(Cookie, document('Two'), 0)]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  const before = await (await f.get(Cookie)).json();
  await f.store.client.execute("CREATE TRIGGER fail_private_backup BEFORE INSERT ON financas_user_backups BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.equal((await f.put(Cookie, document('Failed'), 1)).status, 503);
  assert.deepEqual(await (await f.get(Cookie)).json(), before);
});
test('backup retention is limited separately for each account', async t => {
  const f = await fixture(t), alice = await f.register('alice'), bob = await f.register('bob');
  await f.put(bob, document('Bob'), 0);
  for (let revision = 0; revision < 32; revision++) assert.equal((await f.put(alice, document('Alice'), revision)).status, 200);
  const rows = (await f.store.client.execute('SELECT u.username,COUNT(*) AS n FROM financas_user_backups b JOIN financas_users u ON u.id=b.user_id GROUP BY u.username ORDER BY u.username')).rows;
  assert.equal(rows[0].n, 30); assert.equal(rows[1].n, 2);
});
test('registration attempts are bounded and expired private sessions cannot access data', async t => {
  const f = await fixture(t), Cookie = await f.register('alice');
  await f.store.client.execute('UPDATE financas_user_sessions SET expires_at=0');
  assert.equal((await f.get(Cookie)).status, 401);
  for (let i = 0; i < 9; i++) assert.equal((await f.post('/api/register', {})).status, 400);
  assert.equal((await f.post('/api/register', {})).status, 429);
});
