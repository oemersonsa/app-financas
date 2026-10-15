import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../backend/database.js';
import { createRateLimiter } from '../backend/rate-limit.js';

test('atomic authentication reservations are shared by parallel clients and expire without a timer', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'financas-limit-'));
  const first = await openStore({ file: join(directory, 'bank.sqlite3') });
  const second = await openStore({ file: join(directory, 'bank.sqlite3') });
  t.after(async () => { first.close(); second.close(); await rm(directory, { recursive: true }); });
  let time = 100000;
  const limits = await Promise.all([first, second].map(store => createRateLimiter(store.client, () => time)));
  const results = await Promise.all(Array.from({ length: 35 }, (_, index) => limits[index % 2].take('login', 30)));
  assert.equal(results.filter(result => result.allowed).length, 30);
  assert.equal((await limits[0].take('login', 30)).allowed, false);
  time += 60001;
  assert.equal((await limits[1].take('login', 30)).allowed, true);
  // A successful old reservation cannot decrement a newer window.
  await results.find(result => result.allowed).release();
  assert.equal((await first.client.execute("SELECT attempts FROM financas_auth_limits WHERE bucket='login'")).rows[0].attempts, 1);
  const success = await limits[0].take('login', 30);
  await success.release(); await success.release();
  assert.equal((await first.client.execute("SELECT attempts FROM financas_auth_limits WHERE bucket='login'")).rows[0].attempts, 1);
});
