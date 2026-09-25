import { test } from "node:test";
import assert from "node:assert/strict";
import { survive, NeedsInfoError } from "../src/survive.js";
import { checkResponse } from "../src/contract.js";

const W = { day: 3, hour: "12:15pm" };

// Fake Gemini in its real generateContent response format.
function fakeGemini(intentJson, narration = "Go to Tower Dining.") {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const isIntent = Boolean(body.generationConfig.responseSchema);
    const text = isIntent ? JSON.stringify(intentJson) : narration;
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }) };
  };
  return { fetchImpl, calls };
}

const FRONTEND_QUERIES = [
  "I have 25 minutes between my classes and I'm hungry. I'm at University Hall and my next class is at Innovation Hall.",
  "I have 25 minutes and I'm hungry.",
  "I have 22 minutes to find coffee.",
  "I have 30 minutes to study.",
  "I have 30 minutes between classes in SL and I'm hungry.",
  "I have 8 minutes to get from the library to SL.",
  "I have 8 minutes, I'm in North Hall, class in SL, starving",
  "help im screwed, 4 min to get from campus center to innovation hall",
  "I have 30 minutes for food at Chick-fil-A.",
  "can I get tower dining before my 12:45 class in ET? im in SL"
];

for (const q of FRONTEND_QUERIES) {
  test(`contract holds (no AI): ${q.slice(0, 48)}`, async () => {
    const r = await survive({ query: q, now: W, skipAI: true });
    assert.deepEqual(checkResponse(r), []);
    assert.ok(r.narration.length > 0);
    assert.ok(r.campusStatus.length === 4 && r.origin.id && r.destination.id);
  });
}

test("Gemini path: header key, schema intent, narration used, numbers untouched", async () => {
  const g = fakeGemini({ origin: "SL", destination: "ET", minutesAvailable: 30, classTime: null, goal: "food", urgent: false, wants: [], avoids: [], usesCurrentLocation: false },
    "Tower Dining fits: 7 min walk, 14 min meal, 4 min to ET, 5 min buffer.");
  const r = await survive({ query: "30 min between SL and ET, hungry", now: W, apiKey: "k", fetchImpl: g.fetchImpl });
  assert.equal(g.calls.length, 2);
  assert.equal(g.calls[0].headers["x-goog-api-key"], "k");
  assert.ok(!g.calls[0].url.includes("key="), "key must not be in the URL");
  assert.equal(r.ai.intent, "gemini");
  assert.equal(r.ai.narration, "gemini");
  assert.equal(r.location, "Tower Dining");
  assert.equal(r.totalMinutes, 25);
  assert.deepEqual(checkResponse(r), []);
});

test("Gemini down (HTTP 500): falls back to rules + template, still a valid plan", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: "backend error" } }) });
  const r = await survive({ query: "I have 30 min between CS 180 in SL and my next class in ET and I'm hungry", now: W, apiKey: "k", fetchImpl });
  assert.equal(r.ai.intent, "rules");
  assert.equal(r.ai.narration, "template");
  assert.equal(r.location, "Tower Dining");
  assert.ok(r.ai.errors.length === 2);
});

test("Gemini hallucinates a building: ignored, rules fill in", async () => {
  const g = fakeGemini({ origin: "Hogwarts", destination: "ET", minutesAvailable: 30, goal: "food", urgent: false, wants: [], avoids: [], usesCurrentLocation: false });
  const r = await survive({ query: "in SL, 30 min, next class ET, hungry", now: W, apiKey: "k", fetchImpl: g.fetchImpl });
  assert.equal(r.origin.id, "SL");
});

test("panic mode fills the I'm Screwed panel", async () => {
  const r = await survive({ query: "I have 8 minutes, I'm in North Hall, class in SL, starving", now: W, skipAI: true });
  assert.equal(r.mode, "panic");
  assert.ok(r.panic.options.length >= 3);
  assert.equal(r.panic.options.filter(o => o.recommended).length, 1);
  assert.ok(r.panic.yourMove.title.length > 0);
});

test("GPS location is used when no building is named", async () => {
  const r = await survive({ query: "I have 25 minutes and I'm hungry", location: { lat: 39.7762, lng: -86.1728 }, now: W, skipAI: true });
  assert.equal(r.origin.short, "North Hall");
});

test("missing destination for travel -> clear 422-style error", async () => {
  await assert.rejects(survive({ query: "I have 10 minutes to get to class.", now: W, skipAI: true }), NeedsInfoError);
});

test("empty query -> NeedsInfoError", async () => {
  await assert.rejects(survive({ query: "   ", now: W, skipAI: true }), NeedsInfoError);
});
