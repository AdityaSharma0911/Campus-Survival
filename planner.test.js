import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/planner.js";

const W = { day: 3, hour: "12:15pm" };

test("campus data passes every rule", () => {
  const v = P.validateCampus();
  assert.deepEqual(v.errors, []);
});

test("rooms, aliases and codes resolve", () => {
  for (const [q, id] of [["SL 112", "SL"], ["ET215", "ET"], ["tower", "UT"], ["tower dining", "TD"], ["library", "UL"], ["north hall", "NH"]])
    assert.equal(P.resolvePlace(q)?.id, id, q);
  assert.equal(P.resolveBuilding("tower dining").id, "UT");
});

test("times: '1' at 12:15 means 1 PM", () => {
  assert.equal(P.upcomingTime("1", { day: 3, hour: 12.25 }), 13);
  assert.equal(P.parseTime("12:45pm"), 12.75);
  assert.throws(() => P.parseTime("25:00"));
});

test("30 min SL -> ET at lunch: Tower Dining sit-down with a real buffer", () => {
  const m = P.planMeal({ from: "SL", to: "ET", freeMin: 30, now: W });
  assert.equal(m.options[0].id, "TD");
  assert.ok(m.options[0].bufferMin >= 4);
  assert.equal(m.options[0].eatMin > 0, true);
});

test("closed places are rejected with a reason", () => {
  const m = P.planMeal({ from: "SL", freeMin: 20, now: { day: 3, hour: "11:30pm" } });
  assert.ok(m.options.every(o => o.kind === "vending"));
  assert.ok(m.rejected.some(r => r.id === "TD" && r.code === "closed"));
});

test("study: library gives real study time and respects closing", () => {
  const s = P.planStudy({ from: "UT", to: "ET", freeMin: 30, now: W });
  assert.equal(s.options[0].id, "S_UL");
  assert.ok(s.options[0].studyMin >= 10);
  const late = P.planStudy({ from: "SL", freeMin: 60, now: { day: 5, hour: "5:50pm" } }); // library closes 6 PM Friday
  assert.ok(!late.options.some(o => o.id === "S_UL"));
});

test("panic: 8 min NH -> SL, hungry: straight to class, snack only if you accept lateness", () => {
  const p = P.panicPlan({ from: "NH", to: "SL", freeMin: 8, now: W });
  assert.equal(p.pick.kind, "direct");
  assert.ok(p.options.some(o => o.kind === "vending"));
  assert.ok(p.options.every(o => o.delta === 8 - o.minutes && o.makesIt === (o.delta >= 0)));
});

test("rush: impossible trip reports how late", () => {
  const r = P.rushRoute({ from: "CE", to: "IO", minutesLeft: 4, now: W });
  assert.equal(r.verdict, "late");
  assert.ok(r.lateByMin > 0);
});

test("GPS snaps to the nearest building", () => {
  assert.equal(P.whereAmI(39.7762, -86.1728).id, "NH");
  assert.equal(P.resolvePlace({ lat: 39.7762, lng: -86.1728 }).building, "NH");
});

test("directory and status cover everything", () => {
  const d = P.directory(W);
  assert.ok(d.some(x => x.type === "study") && d.some(x => x.type === "coffee") && d.some(x => x.type === "academic"));
  assert.equal(P.campusStatus(W).length, 4);
});
