// ============================================================
// planner.js — every number the app shows comes from here.
// Pure JavaScript, no AI, no network. Gemini never does math.
// ============================================================
import { CAMPUS } from "./campus.js";

export const CONFIG = {
  tz: "America/Indiana/Indianapolis",
  walkMPerMin: 80,      // normal walk (~3 mph)
  briskMPerMin: 100,    // "I'm late" walk
  jogMPerMin: 150,      // jogging with a backpack
  detourFactor: 1.25,   // straight line -> real sidewalks, crossings, doors
  doorMin: 1,           // leaving one building + entering another
  sameBuildingMin: 2,   // reaching a spot inside the building you're already in
  defaultEatMin: 10,
  minEatMin: 5,         // less than this and it's "take it to go"
  comfortBufferMin: 5,  // shrink eating time before cutting buffer below this
  minBufferMin: 2,      // never recommend a plan with less slack than this
  lastCallMin: 5,       // don't send people to a place that closes in < 5 min
  studyBufferMin: 5,
  minStudyMin: 10,      // a study stop shorter than this isn't worth it
  corridorFactor: 1.35, // a snack stop is "on the way" if it adds < 35% distance
  insideRadiusM: 60,
  onCampusRadiusM: 700,
  rush: [               // estimated weekday lines, multiplies dining serviceMin
    { start: 11.5, end: 13.25, factor: 1.6 },
    { start: 17, end: 18.5, factor: 1.3 }
  ]
};

// ---------- places ----------
const BUILDINGS = CAMPUS.buildings.map(b => ({ ...b, kind: "building" }));
const FOOD = [...CAMPUS.dining, ...CAMPUS.vending];
const STUDY = CAMPUS.study ?? [];
const ALL = [...BUILDINGS, ...FOOD, ...STUDY];
const BY_ID = new Map(ALL.map(p => [p.id.toUpperCase(), p]));

export const buildingIds = () => BUILDINGS.map(b => b.id);
export const getPlace = id => BY_ID.get(String(id).toUpperCase()) ?? null;
export const shortName = p => (p?.name ?? "").replace(/\s*\([^)]*\)\s*$/, "");
/** What a person would call it: "Chick-fil-A", "the SL vending machine", "University Library". */
export const displayName = p => p?.kind === "vending" ? `the ${p.building} vending machine` : (p?.short ?? shortName(p));
const buildingOf = p => (p.kind === "building" ? p.id : p.building ?? null);
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9&' ]/g, " ").replace(/\s+/g, " ").trim();
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function listPlaces() {
  return ALL.map(p => ({ id: p.id, name: p.name, kind: p.kind, building: p.building ?? null, aliases: p.aliases ?? [] }));
}

/** id ("SL"), room ("SL 112"), alias ("tower"), name fragment, or GPS {lat, lng}. */
export function resolvePlace(ref) {
  if (ref == null || ref === "") return null;
  if (typeof ref === "object" && typeof ref.lat === "number" && typeof ref.lng === "number") {
    const here = whereAmI(ref.lat, ref.lng);
    return {
      id: "YOU", kind: "point", lat: ref.lat, lng: ref.lng,
      name: here.inside ? here.name : `your location (near ${shortName(getPlace(here.id))})`,
      building: here.inside ? here.id : null
    };
  }
  if (typeof ref === "object" && ref.id) return resolvePlace(ref.id);

  const raw = String(ref).trim();
  const upper = raw.toUpperCase();
  if (BY_ID.has(upper)) return BY_ID.get(upper);
  const room = upper.match(/^([A-Z]{2,3})[\s-]?\d{1,4}[A-Z]?$/);
  if (room && BY_ID.has(room[1])) return BY_ID.get(room[1]);

  const q = norm(raw);
  const exact = ALL.find(p => p.aliases?.some(a => norm(a) === q) || norm(p.name) === q || norm(shortName(p)) === q);
  if (exact) return exact;
  if (q.length >= 3) {
    const partial = ALL.filter(p => norm(p.name).includes(q) || p.aliases?.some(a => norm(a).includes(q)));
    if (partial.length) return partial.find(p => p.kind === "building") ?? partial[0];
  }
  return null;
}

/** Like resolvePlace, but a food/study place resolves to the building it's in. */
export function resolveBuilding(ref) {
  const p = resolvePlace(ref);
  if (!p) return null;
  if (p.kind === "building" || p.kind === "point") return p;
  return getPlace(p.building) ?? p;
}

// ---------- geometry ----------
export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function whereAmI(lat, lng) {
  let best = null;
  for (const b of BUILDINGS) {
    const d = haversineM(lat, lng, b.lat, b.lng);
    if (!best || d < best.d) best = { b, d };
  }
  return {
    id: best.b.id, name: best.b.name, distanceM: Math.round(best.d),
    inside: best.d <= CONFIG.insideRadiusM, onCampus: best.d <= CONFIG.onCampusRadiusM
  };
}

export function walkInfo(a, b, pace = "walk") {
  const ba = buildingOf(a), bb = buildingOf(b);
  if (ba && ba === bb) return { meters: 0, min: a.id === b.id ? 0 : CONFIG.sameBuildingMin, sameBuilding: true };
  const speed = { walk: CONFIG.walkMPerMin, brisk: CONFIG.briskMPerMin, jog: CONFIG.jogMPerMin }[pace];
  if (!speed) throw new Error(`Unknown pace "${pace}"`);
  const meters = haversineM(a.lat, a.lng, b.lat, b.lng) * CONFIG.detourFactor;
  return { meters: Math.round(meters), min: Math.ceil(meters / speed + CONFIG.doorMin), sameBuilding: false };
}

export const mapsUrl = (a, b) =>
  `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=walking`;

// ---------- time ----------
/** "12:30", "12:30pm", "1pm", 12.5 -> 12.5 */
export function parseTime(x) {
  if (typeof x === "number") return x;
  const m = String(x).trim().toLowerCase().replace(/\s+/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) throw new Error(`Can't read time "${x}" (try "12:30pm")`);
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0), ap = m[3]?.[0];
  if (h > 23 || min > 59) throw new Error(`Can't read time "${x}"`);
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return h + min / 60;
}

/** "1" at 12:15 means 1 PM, not 1 AM. */
export function upcomingTime(x, clock) {
  const t = parseTime(x);
  const explicit = typeof x === "number" || /[ap]\.?m/i.test(String(x)) || t >= 12;
  return !explicit && t < clock.hour && t + 12 > clock.hour ? t + 12 : t;
}

/** now: Date | ISO string | {day: 0-6, hour: 12.25 | "12:15pm"} | undefined (= real now, Indy time) */
export function toClock(now) {
  if (now && typeof now === "object" && !(now instanceof Date) && "day" in now) {
    const day = Number(now.day);
    if (!(day >= 0 && day <= 6)) throw new Error("demo day must be 0-6");
    return { day, hour: parseTime(now.hour) };
  }
  const d = now instanceof Date ? now : new Date(now ?? Date.now());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONFIG.tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
  }).formatToParts(d);
  const get = t => parts.find(p => p.type === t)?.value;
  return { day: DAYS.indexOf(get("weekday")), hour: Number(get("hour")) + Number(get("minute")) / 60 };
}

export function addMin({ day, hour }, min) {
  let h = hour + min / 60, d = day;
  while (h >= 24) { h -= 24; d = (d + 1) % 7; }
  return { day: d, hour: h };
}

export function fmtTime(hour) {
  const totalMin = Math.round(hour * 60) % (24 * 60);
  const h24 = Math.floor(totalMin / 60), m = totalMin % 60;
  return `${((h24 + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}
export const clockLabel = c => `${DAYS[c.day]} ${fmtTime(c.hour)}`;

export function openStatus(place, clock) {
  const span = place.hours?.[clock.day];
  if (!span) return { open: false, reason: `closed on ${DAYS[clock.day]}` };
  const [o, c] = span;
  if (clock.hour < o) return { open: false, reason: `opens at ${fmtTime(o)}`, opensAt: fmtTime(o) };
  if (clock.hour >= c) return { open: false, reason: `closed at ${fmtTime(c)}` };
  return { open: true, closesAt: c === 24 ? "24/7" : fmtTime(c), minutesLeft: Math.round((c - clock.hour) * 60) };
}

export function isRushHour(clock) {
  if (clock.day < 1 || clock.day > 5) return false;
  return CONFIG.rush.some(r => clock.hour >= r.start && clock.hour < r.end);
}

function serviceAt(place, clock) {
  const base = place.serviceMin ?? 5;
  if (place.kind === "dining" && clock.day >= 1 && clock.day <= 5) {
    for (const r of CONFIG.rush) if (clock.hour >= r.start && clock.hour < r.end) return { min: Math.ceil(base * r.factor), rush: true };
  }
  return { min: base, rush: false };
}

const isOnTheGo = p => p.kind === "vending" || p.tags?.includes("grab-and-go");
const tagHit = (p, terms) => terms.filter(t => p.tags?.some(tag => norm(tag).includes(t)) || norm(p.name).includes(t) || p.aliases?.some(a => norm(a) === t));

// ---------- core: one food stop between A and B ----------
export function evaluateStop(p, { origin, dest, clock, freeMin, eatMin = CONFIG.defaultEatMin, bufferMin = CONFIG.minBufferMin, pace = "walk", grabOnly = false }) {
  const walkTo = walkInfo(origin, p, pace);
  const arrive = addMin(clock, walkTo.min);
  const status = openStatus(p, arrive);
  const svc = serviceAt(p, arrive);
  const walkFrom = walkInfo(p, dest, pace);
  const fixed = walkTo.min + svc.min + walkFrom.min;

  let eat = 0, toGo = true;
  if (!grabOnly && !isOnTheGo(p)) {
    const comfy = freeMin - fixed - CONFIG.comfortBufferMin;
    const tight = freeMin - fixed - bufferMin;
    const room = comfy >= CONFIG.minEatMin ? comfy : tight;
    const e = Math.min(eatMin, room);
    if (e >= CONFIG.minEatMin) { eat = e; toGo = false; }
  }
  const total = fixed + eat, buffer = freeMin - total;

  let code = "ok", reason = null;
  if (!status.open) { code = "closed"; reason = status.reason; }
  else if (p.kind !== "vending" && status.minutesLeft < CONFIG.lastCallMin) { code = "closing"; reason = `closes at ${status.closesAt}, too close`; }
  else if (buffer < bufferMin) { code = "no_time"; reason = `needs ${total + bufferMin} min, you have ${freeMin}`; }

  return {
    id: p.id, name: p.name, kind: p.kind, building: p.building, tags: p.tags ?? [],
    walkToMin: walkTo.min, serviceMin: svc.min, eatMin: eat, walkFromMin: walkFrom.min,
    totalMin: total, bufferMin: buffer, toGo, lunchRush: svc.rush,
    closesAt: status.closesAt ?? null, feasible: code === "ok", code, reason,
    mapsUrl: mapsUrl(origin, p)
  };
}

function freeMinutes({ freeMin, nextClassAt }, clock) {
  let m = freeMin;
  if (nextClassAt != null) m = Math.round((upcomingTime(nextClassAt, clock) - clock.hour) * 60);
  if (typeof m !== "number" || !Number.isFinite(m)) throw new Error("Need freeMin or nextClassAt.");
  return m;
}

function mustResolve(ref, label) {
  const p = typeof ref === "object" && ref?.kind ? ref : resolveBuilding(ref);
  if (!p) throw new Error(`Couldn't find ${label} "${typeof ref === "object" ? JSON.stringify(ref) : ref}". Known buildings: ${buildingIds().join(", ")}.`);
  return p;
}

// ---------- 1) food / coffee ----------
/** planMeal({ from, to, freeMin | nextClassAt, now, want, avoid, only, eatMin, includeVending }) */
export function planMeal(opts = {}) {
  const { from, to, now, eatMin = CONFIG.defaultEatMin, want = [], avoid = [], only = [], includeVending = true } = opts;
  const origin = mustResolve(from, "starting point");
  const dest = to != null ? mustResolve(to, "next class") : origin;
  const clock = toClock(now);
  const freeMin = freeMinutes(opts, clock);

  const wantT = want.map(norm).filter(Boolean), avoidT = avoid.map(norm).filter(Boolean), onlyT = only.map(norm).filter(Boolean);
  let pool = includeVending ? FOOD : CAMPUS.dining;
  if (onlyT.length) pool = pool.filter(p => tagHit(p, onlyT).length);

  const options = [], rejected = [];
  for (const p of pool) {
    if (tagHit(p, avoidT).length) { rejected.push({ id: p.id, name: p.name, code: "avoided", reason: "you said to skip this" }); continue; }
    const e = evaluateStop(p, { origin, dest, clock, freeMin: Math.max(freeMin, 0), eatMin });
    if (!e.feasible) { rejected.push({ ...e, reason: e.reason }); continue; }
    const hits = tagHit(p, wantT);
    const base = p.kind === "vending" ? 30 : p.tags?.includes("grab-and-go") ? 60 : e.toGo ? 70 : 100;
    options.push({ ...e, matchedWants: hits, score: base + hits.length * 40 + Math.min(e.bufferMin, 10) - (e.lunchRush ? 3 : 0) });
  }
  options.sort((a, b) => b.score - a.score || b.bufferMin - a.bufferMin);
  return { clock, freeMin, origin, dest, options, rejected };
}

// ---------- 2) study ----------
export function planStudy(opts = {}) {
  const { from, to, now } = opts;
  const origin = mustResolve(from, "starting point");
  const dest = to != null ? mustResolve(to, "next class") : origin;
  const clock = toClock(now);
  const freeMin = freeMinutes(opts, clock);

  const options = [], rejected = [];
  for (const p of STUDY) {
    const walkTo = walkInfo(origin, p), walkFrom = walkInfo(p, dest);
    const arrive = addMin(clock, walkTo.min);
    const st = openStatus(p, arrive);
    const settle = p.serviceMin ?? 2;
    let studyMin = freeMin - walkTo.min - settle - walkFrom.min - CONFIG.studyBufferMin;
    if (st.open) studyMin = Math.min(studyMin, st.minutesLeft - settle);
    const base = { id: p.id, name: p.name, kind: p.kind, building: p.building, tags: p.tags ?? [], closesAt: st.closesAt ?? null, mapsUrl: mapsUrl(origin, p) };
    if (!st.open) { rejected.push({ ...base, code: "closed", reason: st.reason }); continue; }
    if (studyMin < CONFIG.minStudyMin) {
      rejected.push({ ...base, code: "no_time", reason: `only ${Math.max(studyMin, 0)} min of study time, not worth the walk` }); continue;
    }
    const stopMin = settle + studyMin, total = walkTo.min + stopMin + walkFrom.min;
    options.push({
      ...base, walkToMin: walkTo.min, serviceMin: settle, studyMin, stopMin, walkFromMin: walkFrom.min,
      totalMin: total, bufferMin: freeMin - total, feasible: true,
      score: studyMin + (p.tags?.includes("quiet") ? 3 : 0)
    });
  }
  options.sort((a, b) => b.score - a.score);
  return { clock, freeMin, origin, dest, options, rejected };
}

// ---------- 3) getting somewhere ----------
export function rushRoute(opts = {}) {
  const { from, to, now } = opts;
  const origin = mustResolve(from, "starting point");
  const dest = mustResolve(to, "destination");
  const clock = toClock(now);
  const minutesLeft = opts.minutesLeft != null || opts.arriveBy != null
    ? freeMinutes({ freeMin: opts.minutesLeft, nextClassAt: opts.arriveBy }, clock) : null;

  const walk = walkInfo(origin, dest, "walk"), brisk = walkInfo(origin, dest, "brisk"), jog = walkInfo(origin, dest, "jog");
  let verdict = "walk", pace = "walk", minutes = walk.min, lateByMin = 0;
  if (minutesLeft != null && walk.min > minutesLeft) {
    if (brisk.min <= minutesLeft) { verdict = "speed-walk"; pace = "brisk"; minutes = brisk.min; }
    else if (jog.min <= minutesLeft) { verdict = "jog"; pace = "jog"; minutes = jog.min; }
    else { verdict = "late"; pace = "brisk"; minutes = brisk.min; lateByMin = brisk.min - minutesLeft; }
  }
  return {
    clock, origin, dest, minutesLeft, meters: walk.meters,
    walkMin: walk.min, briskMin: brisk.min, jogMin: jog.min,
    verdict, pace, minutes, lateByMin, mapsUrl: mapsUrl(origin, dest)
  };
}

// ---------- 4) "I'm screwed": compare every choice against the deadline ----------
export function panicPlan(opts = {}) {
  const { from, to, now, hungry = true, want = [] } = opts;
  const origin = mustResolve(from, "starting point");
  const dest = mustResolve(to ?? from, "next class");
  const clock = toClock(now);
  const freeMin = freeMinutes(opts, clock);
  const route = rushRoute({ from: origin, to: dest, now: clock.day != null ? { day: clock.day, hour: clock.hour } : now });
  const destName = dest.kind === "point" ? "class" : displayName(dest);

  const options = [];
  const push = o => options.push({ ...o, delta: freeMin - o.minutes, makesIt: freeMin - o.minutes >= 0 });

  push({
    kind: "direct", label: "Go directly to class", minutes: route.walkMin,
    detail: `${route.walkMin} min walk`, steps: [{ type: "walk", label: `Walk to ${destName}`, minutes: route.walkMin }]
  });
  if (route.briskMin < route.walkMin) push({
    kind: "hustle", label: "Speed-walk to class", minutes: route.briskMin,
    detail: `${route.briskMin} min fast walk`, steps: [{ type: "walk", label: `Speed-walk to ${destName}`, minutes: route.briskMin }]
  });

  if (hungry) {
    const direct = haversineM(origin.lat, origin.lng, dest.lat, dest.lng);
    const snacks = FOOD.filter(isOnTheGo).map(p => {
      const e = evaluateStop(p, { origin, dest, clock, freeMin, pace: "brisk", grabOnly: true, bufferMin: 0 });
      const via = haversineM(origin.lat, origin.lng, p.lat, p.lng) + haversineM(p.lat, p.lng, dest.lat, dest.lng);
      const onRoute = buildingOf(p) === buildingOf(origin) || buildingOf(p) === buildingOf(dest) || via <= Math.max(direct, 50) * CONFIG.corridorFactor;
      return { p, e, onRoute };
    }).filter(x => x.e.code !== "closed" && x.e.code !== "closing" && x.onRoute)
      .sort((a, b) => a.e.totalMin - b.e.totalMin).slice(0, 2);

    for (const { p, e } of snacks) push({
      kind: p.kind === "vending" ? "vending" : "grab", id: p.id, location: displayName(p),
      label: p.kind === "vending" ? `Speed-walk + snack from ${displayName(p)}` : `Speed-walk + grab from ${displayName(p)}`,
      minutes: e.totalMin,
      detail: `${e.walkToMin} min walk + ${e.serviceMin} min grab + ${e.walkFromMin} min to class`,
      steps: [
        { type: "walk", label: `Walk to ${displayName(p)}`, minutes: e.walkToMin },
        { type: "food", kind: p.kind, label: p.kind === "vending" ? "Grab a snack from the machine" : "Grab it to go", minutes: e.serviceMin },
        { type: "walk", label: `Walk to ${destName}`, minutes: e.walkFromMin }
      ]
    });

    const meals = CAMPUS.dining.filter(p => !isOnTheGo(p))
      .map(p => evaluateStop(p, { origin, dest, clock, freeMin: 999, eatMin: CONFIG.defaultEatMin }))
      .filter(e => e.code !== "closed" && e.code !== "closing")
      .sort((a, b) => (tagHit(getPlace(b.id), want.map(norm)).length - tagHit(getPlace(a.id), want.map(norm)).length) || a.totalMin - b.totalMin)
      .slice(0, 2);
    for (const e of meals) {
      const eat = e.serviceMin + CONFIG.defaultEatMin;
      const minutes = e.walkToMin + eat + e.walkFromMin;
      push({
        kind: "meal", id: e.id, location: shortName(getPlace(e.id)), label: shortName(getPlace(e.id)), minutes,
        detail: `${e.walkToMin} min walk + ${eat} min eating + ${e.walkFromMin} min to class`,
        steps: [
          { type: "walk", label: `Walk to ${shortName(getPlace(e.id))}`, minutes: e.walkToMin },
          { type: "food", kind: "dining", label: "Grab a bite", minutes: eat },
          { type: "walk", label: `Walk to ${destName}`, minutes: e.walkFromMin }
        ]
      });
    }
  }

  for (const o of options) {
    if (!o.makesIt && (o.kind === "vending" || o.kind === "grab" || o.kind === "meal") && o.delta >= -2) {
      o.note = `Only worth it if you can be ${-o.delta} min late.`;
    } else if (o.makesIt) {
      o.note = o.delta === 0 ? "Zero slack. Don't stop for anything." : `${o.delta} min to spare.`;
    } else {
      o.note = `${-o.delta} min late.`;
    }
  }

  // Pick: food that makes it (if hungry) > direct > hustle > least late.
  const fits = options.filter(o => o.makesIt);
  const foodFit = hungry ? fits.filter(o => o.kind !== "direct" && o.kind !== "hustle").sort((a, b) => b.delta - a.delta)[0] : null;
  const moveFit = fits.find(o => o.kind === "direct") ?? fits.find(o => o.kind === "hustle");
  const pick = foodFit ?? moveFit ?? [...options].sort((a, b) => b.delta - a.delta)[0];
  options.forEach(o => { o.recommended = o === pick; });

  let yourMove;
  if (!pick.makesIt) yourMove = { title: `GO NOW. YOU'LL BE ~${-pick.delta} MIN LATE`, detail: "Send your professor a quick heads-up and skip every stop." };
  else if (pick.kind === "vending") yourMove = { title: `HIT ${pick.location.toUpperCase()} ON THE WAY`, detail: `It's on your route and you still arrive with ${pick.delta} min to spare.` };
  else if (pick.kind === "grab") yourMove = { title: `GRAB ${pick.location.toUpperCase()} TO GO`, detail: `It's on your route and you still arrive with ${pick.delta} min to spare.` };
  else if (pick.kind === "meal") yourMove = { title: `EAT AT ${pick.location.toUpperCase()}`, detail: `You actually have time. ${pick.delta} min to spare.` };
  else if (pick.kind === "hustle") yourMove = { title: "SPEED-WALK TO CLASS", detail: hungry ? "No time for food. Eat after class." : "Leave now and keep moving." };
  else yourMove = { title: "HEAD STRAIGHT TO CLASS", detail: hungry ? "Food won't fit. Eat after class." : `You'll have ${pick.delta} min to spare.` };

  options.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.delta - a.delta);
  return { clock, freeMin, origin, dest, options, pick, yourMove, mapsUrl: route.mapsUrl };
}

// ---------- directory + live campus status ----------
export function directory(now) {
  const clock = toClock(now);
  const typeOf = p => p.kind === "building" ? "academic"
    : p.kind === "study" ? "study"
    : p.tags?.some(t => ["coffee", "tea", "espresso"].includes(t)) ? "coffee" : "food";
  return ALL.map(p => {
    const st = p.hours ? openStatus(p, clock) : null;
    const span = p.hours?.[clock.day];
    return {
      id: p.id, name: shortName(p), fullName: p.name, abbreviation: p.kind === "building" ? p.id : undefined,
      type: typeOf(p), kind: p.kind, building: p.building ?? null,
      residence: p.kind === "building" && ["NH", "UT"].includes(p.id),
      openNow: st ? st.open : null,
      status: st ? (st.open ? (st.closesAt === "24/7" ? "Open 24/7" : `Open until ${st.closesAt}`) : st.reason) : null,
      hoursToday: p.hours ? (span ? (span[0] === 0 && span[1] === 24 ? "24/7" : `${fmtTime(span[0])} – ${fmtTime(span[1])}`) : "Closed today") : null,
      tags: p.tags ?? [], verified: p.kind === "building" ? p.verified !== false : undefined
    };
  });
}

export function campusStatus(now) {
  const clock = toClock(now);
  const openDining = CAMPUS.dining.filter(p => openStatus(p, clock).open).length;
  const openStudy = STUDY.filter(p => openStatus(p, clock).open).length;
  const rush = isRushHour(clock);
  return [
    { label: "Dining", value: openDining ? `${openDining} of ${CAMPUS.dining.length} open` : "All closed", busy: openDining === 0 },
    { label: "Lines", value: rush ? "Busy" : "Normal", busy: rush },
    { label: "Vending", value: `${CAMPUS.vending.length} machines`, busy: false },
    { label: "Study spaces", value: openStudy ? `${openStudy} open` : "Closed", busy: openStudy === 0 }
  ];
}

// ---------- data validator (run before the demo) ----------
export function validateCampus() {
  const errors = [], warnings = [];
  const seen = new Map();
  const ids = new Set(CAMPUS.buildings.map(b => b.id));
  const inBounds = (lat, lng) => lat > 39.765 && lat < 39.785 && lng > -86.185 && lng < -86.160;

  for (const [arr, list] of Object.entries(CAMPUS)) {
    for (const p of list) {
      const tag = `${arr}/${p.id}`;
      if (seen.has(p.id)) errors.push(`${tag}: id also used in ${seen.get(p.id)}`);
      seen.set(p.id, arr);
      if (!p.lat || !p.lng) errors.push(`${tag}: lat/lng missing or 0`);
      else if (!inBounds(p.lat, p.lng)) errors.push(`${tag}: coordinates are off campus (${p.lat}, ${p.lng})`);
      if (p.verified === false) warnings.push(`${tag}: coordinates are ESTIMATED`);
      if (arr === "buildings") continue;

      if (p.building && !ids.has(p.building)) errors.push(`${tag}: building "${p.building}" doesn't exist`);
      else if (p.building) {
        const b = CAMPUS.buildings.find(x => x.id === p.building);
        if (b.lat !== p.lat || b.lng !== p.lng) warnings.push(`${tag}: coordinates differ from its building ${p.building} (fine if intentional)`);
      }
      if (!(p.serviceMin > 0)) errors.push(`${tag}: serviceMin must be > 0`);
      for (let d = 0; d <= 6; d++) {
        const span = p.hours?.[d];
        if (span === undefined) { errors.push(`${tag}: hours missing day ${d} (use null for closed)`); continue; }
        if (span === null) continue;
        const [o, c] = span;
        if (!(o >= 0 && c <= 24 && o < c)) errors.push(`${tag}: bad hours on day ${d}: [${span}]`);
        if (arr === "vending" && (o !== 0 || c !== 24)) errors.push(`${tag}: vending must be [0, 24] every day`);
      }
    }
  }
  const owner = new Map();
  for (const p of ALL) for (const a of p.aliases ?? []) {
    const k = norm(a);
    if (owner.has(k) && owner.get(k) !== p.id) warnings.push(`alias "${a}" used by both ${owner.get(k)} and ${p.id}`);
    else owner.set(k, p.id);
  }
  return { ok: errors.length === 0, errors, warnings };
}
