import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackIntent, sanitizeIntent } from "../src/intent.js";

const cases = [
  ["I have 30 min between CS 180 in SL 112 and my next class in ET, want chick-fil-a but no pizza", { origin: "SL", destination: "ET", minutesAvailable: 30, goal: "food" }],
  ["I have 8 minutes to get from the library to SL.", { origin: "UL", destination: "SL", minutesAvailable: 8, goal: "travel" }],
  ["help im so screwed, 4 min to get from campus center to innovation hall", { origin: "CE", destination: "IO", urgent: true, goal: "travel" }],
  ["im in north hall and my class is at 1 in sl, starving", { origin: "NH", destination: "SL", classTime: "1", goal: "food" }],
  ["leaving tower in half an hour for ET, need a quiet spot to study", { origin: "UT", destination: "ET", minutesAvailable: 30, goal: "study" }],
  ["can I get tower dining before my 12:45 class in ET? im in SL", { origin: "SL", destination: "ET", classTime: "12:45", goal: "food" }],
  ["I have 22 minutes to find coffee.", { minutesAvailable: 22, goal: "coffee" }],
  ["I have 25 minutes between my classes and I'm hungry. I'm at University Hall and my next class is at Innovation Hall.", { origin: null, destination: "IO", goal: "food" }]
];

for (const [q, expected] of cases) {
  test(`rules: ${q.slice(0, 50)}`, () => {
    const i = fallbackIntent(q);
    for (const [k, v] of Object.entries(expected)) assert.deepEqual(i[k], v, k);
  });
}

test("wants and avoids", () => {
  const i = fallbackIntent("30 min in SL, want chick-fil-a but no pizza");
  assert.ok(i.wants.includes("chick fil a"));
  assert.ok(i.avoids.includes("pizza"));
});

test("Gemini output is sanitized: bad ids dropped, food places become wants", () => {
  const i = sanitizeIntent({ origin: "University Hall", destination: "TD", minutesAvailable: 9999, goal: "dance", urgent: "yes", wants: [1, "Pizza"], avoids: null, usesCurrentLocation: true });
  assert.equal(i.origin, null);
  assert.equal(i.destination, null);
  assert.ok(i.wants.includes("tower dining") && i.wants.includes("pizza"));
  assert.equal(i.minutesAvailable, null);
  assert.equal(i.goal, "food");
  assert.equal(i.urgent, false);
});
