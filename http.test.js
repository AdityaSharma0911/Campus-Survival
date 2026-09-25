import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { checkResponse } from "../src/contract.js";

let server, base;
before(async () => {
  server = createApp({ apiKey: "", demoNow: { day: 3, hour: "12:15pm" } });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("GET /api/health", async () => {
  const r = await (await fetch(base + "/api/health")).json();
  assert.equal(r.ok, true);
  assert.equal(r.demoMode, true);
  assert.equal(r.data.valid, true);
});

test("POST /api/survive returns a contract-valid plan", async () => {
  const res = await post("/api/survive", { query: "I have 30 min between CS 180 in SL and my next class in ET and I'm hungry" });
  assert.equal(res.status, 200);
  const r = await res.json();
  assert.deepEqual(checkResponse(r), []);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("POST /api/survive with GPS", async () => {
  const r = await (await post("/api/survive", { query: "hungry, 25 min", location: { lat: 39.7762, lng: -86.1728 } })).json();
  assert.equal(r.origin.short, "North Hall");
});

test("needs-info -> 422 with a helpful message", async () => {
  const res = await post("/api/survive", { query: "I have 10 minutes to get to class." });
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /Which building/);
});

test("bad JSON -> 400, unknown route -> 404, CORS preflight -> 204", async () => {
  assert.equal((await fetch(base + "/api/survive", { method: "POST", body: "{nope" })).status, 400);
  assert.equal((await fetch(base + "/nope")).status, 404);
  assert.equal((await fetch(base + "/api/survive", { method: "OPTIONS" })).status, 204);
});

test("GET /api/places and /api/status", async () => {
  const places = await (await fetch(base + "/api/places")).json();
  assert.ok(places.length >= 20 && places.every(p => p.id && p.name && p.type));
  const status = await (await fetch(base + "/api/status")).json();
  assert.equal(status.length, 4);
});
