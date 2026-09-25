// ============================================================
// survive.js — the one function behind POST /api/survive.
//   1. intent.js   : sentence -> structured intent (Gemini, rules fallback)
//   2. planner.js  : all math (walks, lines, hours, buffers)
//   3. narrate.js  : Gemini writes over the computed numbers
// Output = the frontend's SurvivalRecommendation, plus extra fields that
// replace the UI's hardcoded route card, alternatives, and panic panel.
// ============================================================
import {
  planMeal, planStudy, rushRoute, panicPlan, getPlace, resolvePlace, whereAmI, displayName,
  toClock, clockLabel, upcomingTime, campusStatus, mapsUrl
} from "./planner.js";
import { parseIntent } from "./intent.js";
import { narrate } from "./narrate.js";
import { riskOf, checkResponse } from "./contract.js";

export class NeedsInfoError extends Error {
  constructor(message, needs) { super(message); this.name = "NeedsInfoError"; this.needs = needs; this.status = 422; }
}

const DEFAULT_MINUTES = { food: 30, coffee: 20, study: 45, travel: 15 };
const COFFEE_TAGS = ["coffee", "tea", "espresso"];
const nrm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const label = p => (p.kind === "point" ? (p.building ? displayName(getPlace(p.building)) : "your location") : displayName(p));
const placeRef = p => ({ id: p.id, name: p.name, short: label(p), lat: p.lat, lng: p.lng });
const stopRef = (id, extra = {}) => {
  const p = getPlace(id);
  return { id: p.id, name: displayName(p), fullName: p.name, kind: p.kind, building: p.building ?? null, tags: p.tags ?? [], ...extra };
};
const wantHit = (id, wants) => {
  const p = getPlace(id);
  const hay = nrm([p.name, ...(p.tags ?? []), ...(p.aliases ?? [])].join(" "));
  return wants.some(w => nrm(w) && hay.includes(nrm(w)));
};
const badgeFor = (r, isVending) => r.risk === "screwed" ? "TOO RISKY" : r.risk === "tight" ? "TIGHT" : isVending ? "QUICK SNACK" : "GOOD OPTION";

/** Builds a contract-valid recommendation: total = sum(steps), buffer = available - total, risk from buffer. */
function build({ location, steps, available, mode, stop = null, reason = [], extra = {} }) {
  const s = steps.map(x => ({ ...x, minutes: Math.max(0, Math.round(x.minutes)) }));
  const total = s.reduce((a, x) => a + x.minutes, 0);
  const buffer = available - total;
  return { location, totalMinutes: total, bufferMinutes: buffer, risk: riskOf(buffer), reason: reason.filter(Boolean), steps: s, mode, availableMinutes: available, stop, ...extra };
}

function mealSteps(o, destLabel, goal) {
  const p = getPlace(o.id);
  const isCoffee = goal === "coffee" && p.tags?.some(t => COFFEE_TAGS.includes(t));
  const stopLabel = p.kind === "vending" ? (goal === "coffee" ? "Grab a drink from the machine" : "Grab a snack from the machine")
    : isCoffee ? "Grab your coffee" : o.toGo ? "Grab it to go" : "Grab a bite";
  return [
    { type: "walk", label: `Walk to ${displayName(p)}`, minutes: o.walkToMin },
    { type: "food", kind: p.kind === "vending" ? "vending" : isCoffee ? "coffee" : "food", label: stopLabel, minutes: o.serviceMin + o.eatMin },
    { type: "walk", label: `Walk ${destLabel}`, minutes: o.walkFromMin }
  ];
}
const stepDetail = steps => steps.length === 3
  ? `${steps[0].minutes} min walk · ${steps[1].minutes} min stop · ${steps[2].minutes} min to class`
  : `${steps[0].minutes} min ${steps[0].label.toLowerCase().startsWith("speed") ? "fast walk" : "walk"}`;

// ---------- resolve who/where/how long ----------
function resolveContext(intent, location, clock, assumptions) {
  let origin = intent.origin ? getPlace(intent.origin) : null;
  if (!origin && location) {
    const ok = Number.isFinite(location.lat) && Number.isFinite(location.lng);
    if (ok && whereAmI(location.lat, location.lng).onCampus) origin = resolvePlace({ lat: location.lat, lng: location.lng });
    else if (ok) assumptions.push("Your GPS puts you off campus, so it wasn't used.");
  }
  if (!origin) {
    origin = getPlace(process.env.DEFAULT_ORIGIN || "SL");
    assumptions.push(`Couldn't tell where you are, so I assumed ${label(origin)}. Name your building for an exact plan.`);
  }

  let dest = intent.destination ? getPlace(intent.destination) : null;
  if (dest && dest.id === origin.id) dest = origin;
  if (!dest) {
    if (intent.goal === "travel") {
      throw new NeedsInfoError(`Which building is your class in? Try: "I have 10 minutes to get from ${label(origin)} to ET."`, ["destination"]);
    }
    dest = origin;
    assumptions.push(`Assumed your next class is back in ${label(origin)}.`);
  }

  let available = intent.minutesAvailable;
  if (available == null && intent.classTime) {
    try { available = Math.round((upcomingTime(intent.classTime, clock) - clock.hour) * 60); } catch { available = null; }
    if (available != null && available <= 0) throw new NeedsInfoError(`Your ${intent.classTime} class has already started. Tell me how many minutes you have.`, ["minutesAvailable"]);
  }
  if (available == null) {
    available = DEFAULT_MINUTES[intent.goal];
    assumptions.push(`Assumed you have ${available} minutes. Say how long you have for an exact plan.`);
  }
  if (available > 240) { available = 240; assumptions.push("Capped the plan at 4 hours."); }
  return { origin, dest, available };
}

// ---------- modes ----------
function mealMode({ intent, origin, dest, available, now, assumptions }) {
  const destLabel = dest === origin ? `back to ${label(dest)}` : `to ${label(dest)}`;
  const only = intent.goal === "coffee" ? COFFEE_TAGS : [];
  let plan = planMeal({ from: origin, to: dest, freeMin: available, now, want: intent.wants, avoid: intent.avoids, only });
  if (intent.goal === "coffee" && !plan.options.length) {
    const drinks = planMeal({ from: origin, to: dest, freeMin: available, now, avoid: intent.avoids, only: ["drinks"] });
    if (drinks.options.length) {
      assumptions.push("No coffee spot fits in time, so here's the fastest drink instead.");
      plan = { ...drinks, rejected: [...plan.rejected, ...drinks.rejected.filter(r => !plan.rejected.some(x => x.id === r.id))] };
    }
  }
  const best = plan.options[0];
  if (!best || (intent.urgent && best.bufferMin < 4)) return null; // -> panic mode

  const rejected = plan.rejected;
  const checked = plan.options.length + rejected.length;
  const closed = rejected.filter(r => r.code === "closed").length;
  const skip = rejected.find(r => r.code !== "closed" && wantHit(r.id, intent.wants)) ?? rejected.find(r => r.code === "no_time");
  const p = getPlace(best.id);

  const main = build({
    location: displayName(p), steps: mealSteps(best, destLabel, intent.goal), available, mode: intent.goal,
    stop: stopRef(best.id, { closesAt: best.closesAt, lunchRush: best.lunchRush, toGo: best.toGo }),
    reason: [
      null, // filled below once the buffer is known
      p.kind === "vending" ? "Vending machines never close" : best.closesAt ? `${displayName(p)} is open until ${best.closesAt}` : null,
      best.lunchRush ? `Lunch rush: line time estimated at ${best.serviceMin} min` : null,
      best.toGo && p.kind !== "vending" ? "Not enough time to sit down, so take it to go" : null,
      best.matchedWants?.length ? `Matches what you asked for (${best.matchedWants.join(", ")})` : null,
      skip ? `Skipped ${displayName(getPlace(skip.id))}: ${skip.reason}` : null,
      `Checked ${checked} places: ${checked - closed} open, ${plan.options.length} fit your time`
    ]
  });
  main.reason.unshift(main.bufferMinutes >= 0
    ? `Fits your ${available}-minute window with ${main.bufferMinutes} min to spare`
    : `Runs ${-main.bufferMinutes} min past your ${available}-minute window`);

  const altSources = [...plan.options.slice(1, 4), ...rejected.filter(r => r.code === "no_time" && Number.isFinite(r.totalMin))].slice(0, 3);
  const alternatives = altSources.map(o => {
    const q = getPlace(o.id);
    const r = build({
      location: displayName(q), steps: mealSteps(o, destLabel, intent.goal), available, mode: intent.goal,
      stop: stopRef(o.id, { closesAt: o.closesAt, lunchRush: o.lunchRush, toGo: o.toGo }),
      reason: [o.feasible ? `Fits with ${o.bufferMin} min to spare` : `Won't fit: ${o.reason}`, o.closesAt && q.kind !== "vending" ? `Open until ${o.closesAt}` : null]
    });
    return { ...r, title: displayName(q), badge: badgeFor(r, q.kind === "vending"), detail: stepDetail(r.steps) };
  });

  return {
    main, alternatives, panic: null,
    rejected: rejected.map(r => ({ id: r.id, location: displayName(getPlace(r.id)), code: r.code, reason: r.reason })),
    mapsTo: p
  };
}

function panicMode({ intent, origin, dest, available, now, hungry }) {
  const pp = panicPlan({ from: origin, to: dest, freeMin: available, now, hungry, want: intent.wants });
  const direct = pp.options.find(o => o.kind === "direct");
  const meals = pp.options.filter(o => o.kind === "meal");
  const destName = label(dest);
  const toRec = (o, reason) => build({
    location: o.location ?? destName, steps: o.steps, available, mode: "panic",
    stop: o.id ? stopRef(o.id) : null, reason
  });

  const main = toRec(pp.pick, [
    `You have ${available} min. Walking straight to ${destName} takes ${direct.minutes} min`,
    hungry && meals.length ? `A sit-down meal needs at least ${Math.min(...meals.map(m => m.minutes))} min` : null,
    pp.pick.note,
    `${pp.options.filter(o => o.makesIt).length} of ${pp.options.length} options get you there on time`
  ]);
  const alternatives = pp.options.filter(o => !o.recommended).slice(0, 3).map(o => {
    const r = toRec(o, [o.note]);
    return { ...r, title: o.label, badge: badgeFor(r, o.kind === "vending"), detail: o.detail };
  });
  return {
    main, alternatives, rejected: [],
    panic: {
      availableMinutes: available, yourMove: pp.yourMove,
      options: pp.options.map(o => ({
        label: o.label, detail: o.detail, minutes: o.minutes, delta: o.delta, makesIt: o.makesIt,
        recommended: o.recommended, note: o.note, kind: o.kind, location: o.location ?? destName, steps: o.steps
      }))
    },
    mapsTo: pp.pick.id ? getPlace(pp.pick.id) : dest
  };
}

function travelMode({ intent, origin, dest, available, now }) {
  const rr = rushRoute({ from: origin, to: dest, minutesLeft: available, now });
  const verb = rr.pace === "walk" ? "Walk" : rr.pace === "jog" ? "Jog" : "Speed-walk";
  const main = build({
    location: label(dest), available, mode: "travel",
    steps: [{ type: "walk", label: `${verb} to ${label(dest)}`, minutes: rr.minutes }],
    reason: [
      rr.meters ? `About ${rr.meters} m on foot: ${rr.walkMin} min at a normal pace` : `You're already in ${label(dest)}`,
      rr.pace !== "walk" ? `Speed-walking cuts it to ${rr.briskMin} min` : null,
      rr.verdict === "late" ? `Even speed-walking, you'll be about ${rr.lateByMin} min late. Go now.` : null
    ]
  });
  main.reason.push(main.bufferMinutes >= 0 ? `Leaves ${main.bufferMinutes} min to spare` : "Send your professor a heads-up");

  let panic = null, alternatives = [];
  if (intent.urgent || main.bufferMinutes < 4) {
    const pm = panicMode({ intent, origin, dest, available, now, hungry: false });
    panic = pm.panic;
    alternatives = pm.alternatives.filter(a => a.totalMinutes !== main.totalMinutes || a.steps[0].label !== main.steps[0].label);
  }
  return { main, alternatives, panic, rejected: [], mapsTo: dest };
}

function studyMode({ origin, dest, available, now }) {
  const destLabel = dest === origin ? `back to ${label(dest)}` : `to ${label(dest)}`;
  const sp = planStudy({ from: origin, to: dest, freeMin: available, now });
  const rejected = sp.rejected.map(r => ({ id: r.id, location: displayName(getPlace(r.id)), code: r.code, reason: r.reason }));
  const toRec = o => build({
    location: displayName(getPlace(o.id)), available, mode: "study",
    stop: stopRef(o.id, { closesAt: o.closesAt }),
    steps: [
      { type: "walk", label: `Walk to ${displayName(getPlace(o.id))}`, minutes: o.walkToMin },
      { type: "food", kind: "study", label: "Settle in and study", minutes: o.stopMin },
      { type: "walk", label: `Walk ${destLabel}`, minutes: o.walkFromMin }
    ],
    reason: [
      `${o.studyMin} min of actual study time`,
      o.closesAt ? `${displayName(getPlace(o.id))} is open until ${o.closesAt}` : null,
      o.tags.includes("quiet") ? "Quiet study space" : o.tags.includes("food nearby") ? "Food is steps away if you get hungry" : null
    ]
  });

  if (!sp.options.length) {
    const rr = rushRoute({ from: origin, to: dest, now });
    const main = build({
      location: label(dest), available, mode: "study",
      steps: [{ type: "walk", label: `Walk ${destLabel}`, minutes: rr.walkMin }],
      reason: [`No study spot gives you at least 10 minutes right now`, ...rejected.map(r => `${r.location}: ${r.reason}`)]
    });
    return { main, alternatives: [], panic: null, rejected, mapsTo: dest };
  }
  const main = toRec(sp.options[0]);
  const second = sp.options[1];
  if (second) main.reason.push(`${displayName(getPlace(second.id))} would give you ${second.studyMin} min`);
  const alternatives = sp.options.slice(1).map(o => { const r = toRec(o); return { ...r, title: r.location, badge: badgeFor(r, false), detail: stepDetail(r.steps) }; });
  return { main, alternatives, panic: null, rejected, mapsTo: getPlace(sp.options[0].id) };
}

// ---------- entry point ----------
/**
 * survive({ query, location?, now?, apiKey?, fetchImpl?, skipAI? })
 *   location: {lat, lng} from the browser, optional
 *   now:      {day: 0-6, hour: "12:15pm"} to freeze time for a demo, optional
 */
export async function survive({ query, location = null, now, apiKey, fetchImpl, skipAI = false } = {}) {
  if (typeof query !== "string" || !query.trim()) throw new NeedsInfoError("Tell me your situation, like \"I have 30 minutes in SL and I'm hungry.\"", ["query"]);
  if (query.length > 500) throw new NeedsInfoError("That's a long one. Keep it under 500 characters.", ["query"]);

  const clock = toClock(now);
  const frozen = { day: clock.day, hour: clock.hour };   // one clock for every calculation in this request
  const { intent, source, error } = await parseIntent(query, { clock, apiKey, fetchImpl, skipAI });
  const assumptions = [];
  const { origin, dest, available } = resolveContext(intent, location, clock, assumptions);
  const ctx = { intent, origin, dest, available, now: frozen, assumptions };

  let out;
  if (intent.goal === "travel") out = travelMode(ctx);
  else if (intent.goal === "study") out = studyMode(ctx);
  else out = mealMode(ctx) ?? panicMode({ ...ctx, hungry: true });

  const response = {
    ...out.main,
    origin: placeRef(origin),
    destination: placeRef(dest),
    narration: "",
    alternatives: out.alternatives,
    rejected: out.rejected,
    panic: out.panic,
    campusStatus: campusStatus(frozen),
    mapsUrl: mapsUrl(origin, out.mapsTo),
    assumptions,
    intent,
    computedAt: clockLabel(clock),
    ai: null
  };

  const n = await narrate(response, { query, apiKey, fetchImpl, skipAI });
  response.narration = n.text;
  response.ai = { intent: source, narration: n.source, errors: [error, n.error].filter(Boolean) };

  const problems = checkResponse(response);
  if (problems.length) throw new Error(`Response failed the frontend contract: ${problems.join("; ")}`);
  return response;
}
