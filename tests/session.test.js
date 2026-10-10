import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../backend/database.js';
import { createApplication } from '../backend/http.js';
import { createSessions } from '../backend/sessions.js';
import { credentialVersion } from '../backend/auth.js';
async function setup(t, secureCookies = false) {
  const dir = await mkdtemp(join(tmpdir(), 'financas-login-'));
  const file = join(dir, 'bank.sqlite3');
  const store = await openStore({ file });
  const server = await createApplication(store, { username: 'emerson', password: 'secret-test', secureCookies });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); await rm(dir, { recursive: true }); });
  const post = (path, body, headers = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { store, file, url, post, login: (remember = true) => post('/api/login', { username: 'emerson', password: 'secret-test', remember }) };
}
test('login page public, no browser auth challenge, API protected', async t => {
  const f = await setup(t);
  const home = await fetch(f.url, { redirect: 'manual' });
  assert.equal(home.status, 303); assert.equal(home.headers.get('location'), '/login.html');
  assert.equal((await fetch(f.url + '/login.html')).status, 200);
  const denied = await fetch(f.url + '/api/state');
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('www-authenticate'), null);
  for (const asset of ['/styles/base.css', '/styles/login.css', '/js/login.js']) assert.equal((await fetch(f.url + asset)).status, 200);
});
test('wrong credentials and foreign-origin login cannot create sessions', async t => {
  const f = await setup(t);
  assert.equal((await f.post('/api/login', { username: 'emerson', password: 'wrong' })).status, 401);
  assert.equal((await f.post('/api/login', { username: 'emerson', password: 'secret-test' }, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await f.store.client.execute('SELECT COUNT(*) AS n FROM financas_sessions')).rows[0].n, 0);
});
test('remember cookie uses HttpOnly SameSite Secure; database never stores raw token', async t => {
  const f = await setup(t, true);
  const login = await f.login(); assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  for (const value of ['HttpOnly', 'SameSite=Lax', 'Secure', 'Max-Age=2592000']) assert.ok(cookie.includes(value));
  const authCookie = cookie.split(';')[0];
  assert.equal((await fetch(f.url + '/api/state', { headers: { Cookie: authCookie } })).status, 200);
  const rows = (await f.store.client.execute('SELECT token_hash FROM financas_sessions')).rows;
  assert.notEqual(rows[0].token_hash, authCookie.split('=')[1]);
  const tampered = authCookie.slice(0, -1) + (authCookie.endsWith('a') ? 'b' : 'a');
  assert.equal((await fetch(f.url + '/api/state', { headers: { Cookie: tampered } })).status, 401);
});
test('logout revokes session server-side and blocks foreign origin', async t => {
  const f = await setup(t);
  const Cookie = (await f.login()).headers.get('set-cookie').split(';')[0];
  assert.equal((await f.post('/api/logout', {}, { Cookie, Origin: 'https://foreign.example' })).status, 403);
  const out = await f.post('/api/logout', {}, { Cookie });
  assert.equal(out.status, 200); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(f.url + '/api/state', { headers: { Cookie } })).status, 401);
});
test('expired sessions rejected and password changes invalidate existing sessions', async t => {
  const f = await setup(t);
  const Cookie = (await f.login(false)).headers.get('set-cookie').split(';')[0];
  const sessions = await createSessions(f.store.client, credentialVersion('emerson', 'new-password'));
  assert.equal(await sessions.valid(Cookie.split('=')[1]), false);
  await f.store.client.execute('UPDATE financas_sessions SET expires_at=0');
  assert.equal((await fetch(f.url + '/api/state', { headers: { Cookie } })).status, 401);
});
test('session survives reopening database and unremembered cookie lasts one day', async t => {
  const f = await setup(t);
  const response = await f.login(false);
  assert.match(response.headers.get('set-cookie'), /Max-Age=86400/);
  const token = response.headers.get('set-cookie').split(';')[0].split('=')[1];
  const reopened = await openStore({ file: f.file });
  try {
    const sessions = await createSessions(reopened.client, credentialVersion('emerson', 'secret-test'));
    assert.equal(await sessions.valid(token), true);
  } finally { reopened.close(); }
});
test('repeated wrong passwords are throttled', async t => {
  const f = await setup(t);
  for (let i = 0; i < 30; i++) assert.equal((await f.post('/api/login', { username: 'emerson', password: 'wrong' })).status, 401);
  assert.equal((await f.login()).status, 429);
});
