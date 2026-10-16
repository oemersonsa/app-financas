import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../frontend/js/core/api.js";

test("transport reads the current account on every request and preserves JSON headers", async () => {
  let identity = "alice";
  const requests = [];
  const request = createApi({ accountId: () => identity, fetchImpl: async (url, options) => {
    requests.push({ url, options }); return new Response('{}');
  } });
  await request("/api/state", { method: "PUT", body: "{}", headers: { "Content-Type": "application/json" } });
  identity = "bob";
  await request("/api/state");
  await request("/api/session");
  assert.equal(requests[0].options.headers['X-Meu-Bolso-Account'], "alice");
  assert.equal(requests[0].options.headers['Content-Type'], "application/json");
  assert.equal(requests[1].options.headers['X-Meu-Bolso-Account'], "bob");
  assert.equal(requests[2].options.headers['X-Meu-Bolso-Account'], undefined);
  assert.equal(requests[0].options.cache, "no-store");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
});

test("account changes and expired sessions trigger distinct handlers; revision conflicts stay readable", async () => {
  const events = [];
  let response = new Response('{"code":"account_changed"}', { status: 409 });
  const request = createApi({ accountId: () => "alice", fetchImpl: async () => response,
    onAccountChanged: () => events.push("account"), onUnauthorized: () => events.push("session") });
  await assert.rejects(request("/api/state"), /account changed/);
  response = new Response('{}', { status: 401 });
  await assert.rejects(request("/api/state"), /session/);
  response = new Response('{"error":"stale"}', { status: 409 });
  const conflict = await request("/api/state");
  assert.deepEqual(await conflict.json(), { error: "stale" });
  assert.deepEqual(events, ["account", "session"]);
});
