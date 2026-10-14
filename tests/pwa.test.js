import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../backend/database.js';
import { createApplication } from '../backend/http.js';
import { pwaAssets } from '../backend/pwa.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'financas-pwa-'));
  const store = await openStore({ file: join(directory, 'bank.sqlite3') });
  const server = await createApplication(store, { password: 'pwa-test-password', secureCookies: false });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); await rm(directory, { recursive: true }); });
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`, { redirect: 'manual' });
}
test('PWA installation and offline assets are public while financial pages stay protected', async t => {
  const get = await fixture(t);
  for (const path of [...pwaAssets, '/sw.js']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  assert.equal((await get('/api/state')).status, 401);
  assert.equal((await get('/')).status, 303);
  assert.equal((await get('/build/app.js')).status, 303);
  const worker = await get('/sw.js');
  assert.equal(worker.headers.get('service-worker-allowed'), '/');
  assert.match(worker.headers.get('content-type'), /text\/javascript/);
  assert.equal(worker.headers.get('cache-control'), 'no-store');
});
test('standalone manifest and iPhone icons have correct MIME types and dimensions', async t => {
  const get = await fixture(t);
  const response = await get('/manifest.webmanifest');
  assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
  const manifest = await response.json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.purpose.includes('maskable')));
  for (const [path, size] of [['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512], ['/icons/apple-touch-icon.png', 180]]) {
    const icon = await get(path);
    assert.equal(icon.headers.get('content-type'), 'image/png');
    const bytes = Buffer.from(await icon.arrayBuffer());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await (await get('/login.html')).text();
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon/);
});
