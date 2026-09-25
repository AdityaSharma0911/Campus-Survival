// ============================================================
// CAMPUS SURVIVAL ASSISTANT — backend / logic layer
// Gemini parses intent and narrates. All math happens here.
// ============================================================

import { CAMPUS } from "./campus.js";

// >>> SET THIS FIRST <<<
// Check aistudio.google.com for the current free-tier Flash model id.
// A wrong string returns a 404 that looks like an auth error.
const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const WALK_MS   = 1.4;   // avg walking speed, m/s
const HUSTLE_MS = 2.2;   // fast walk / light jog
const DETOUR    = 1.3;   // straight-line -> real path multiplier
const CORRIDOR  = 1.35;  // a stop is "on the way" if it costs < 35% extra

// Anywhere you can obtain food: dining halls + vending machines.
const foodSpots = () => [...CAMPUS.dining, ...CAMPUS.vending];
const allPlaces = () => [...CAMPUS.buildings, ...CAMPUS.dining, ...CAMPUS.vending];

// ============================================================
// GEOMETRY + TIME
// ============================================================

function metersBetween(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function walkMinutes(a, b, speed = WALK_MS) {
  return (metersBetween(a, b) * DETOUR) / speed / 60;
}

function isOpen(spot, now = new Date()) {
  const window = spot.hours?.[now.getDay()];
  if (!window) return false;
  const hour = now.getHours() + now.getMinutes() / 60;
  return hour >= window[0] && hour < window[1];
}

function minutesUntilClose(spot, now = new Date()) {
  const window = spot.hours?.[now.getDay()];
  if (!window) return 0;
  return (window[1] - (now.getHours() + now.getMinutes() / 60)) * 60;
}

function findPlace(query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return null;
  return allPlaces().find(p =>
    p.id.toLowerCase() === q ||
    p.name.toLowerCase().includes(q) ||
    (p.aliases || []).some(a => a.toLowerCase() === q)
  ) || null;
}

// ============================================================
// GEMINI CALL
// ============================================================

async function callGemini(apiKey, prompt, asJson = false) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: asJson
      ? { responseMimeType: "application/json", temperature: 0.1 }
      : { temperature: 0.6 }
  };

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  return asJson ? JSON.parse(text) : text;
}

// ============================================================
// INTENT PARSER  (Gemini -> structured JSON)
// ============================================================

function intentPrompt(query) {
  const places = allPlaces()
    .map(p => `${p.id} = ${p.name}${p.kind === "vending" ? " (vending machine)" : ""}`)
    .join("\n");

  return `Extract structured intent from a campus navigation request.

Known places:
${places}

Request: "${query}"

Return JSON only:
{
  "start": "place id or null",
  "end": "place id or null",
  "minutesAvailable": number or null,
  "goal": "food" | "travel" | "both",
  "mode": "normal" | "panic"
}

Rules:
- Use exact place ids from the list above. If a place isn't listed, use null.
- mode is "panic" if the request implies urgency, lateness, or an
  impossible-sounding time budget. Otherwise "normal".
- Do not compute times or distances. Extract only what is stated.`;
}

// ============================================================
// FEASIBILITY ENGINE  (pure JS — the real work)
// ============================================================

function planFoodStop(intent, now = new Date()) {
  const start = findPlace(intent.start);
  const end   = findPlace(intent.end) || start;
  if (!start) return [];

  const budget = intent.minutesAvailable ?? 30;

  return foodSpots()
    .filter(spot => isOpen(spot, now))
    .map(spot => {
      const there = walkMinutes(start, spot);
      const back  = walkMinutes(spot, end);
      const eat   = spot.serviceMin;
      const total = there + eat + back;
      return {
        name: spot.name,
        kind: spot.kind,
        walkTo: Math.round(there),
        eat,
        walkOn: Math.round(back),
        total: Math.round(total),
        buffer: Math.round(budget - total),
        feasible: total <= budget && minutesUntilClose(spot, now) > there + 5,
        tags: spot.tags
      };
    })
    .sort((a, b) => b.buffer - a.buffer);
}

function planPanic(intent, now = new Date()) {
  const start = findPlace(intent.start);
  const end   = findPlace(intent.end);
  if (!start || !end) return [];

  const budget = intent.minutesAvailable ?? 8;
  const normal = walkMinutes(start, end);
  const hustle = walkMinutes(start, end, HUSTLE_MS);
  const direct = metersBetween(start, end);

  const options = [
    {
      label: "Normal pace",
      kind: "route",
      minutes: Math.round(normal),
      delta: Math.round(budget - normal),
      note: "Walking how you'd normally walk."
    },
    {
      label: "Hustle",
      kind: "route",
      minutes: Math.round(hustle),
      delta: Math.round(budget - hustle),
      note: "Fast walk. You will arrive warm."
    }
  ];

  // What can you grab without meaningfully costing you time?
  foodSpots()
    .filter(spot => isOpen(spot, now))
    .forEach(spot => {
      const viaDist = metersBetween(start, spot) + metersBetween(spot, end);
      if (viaDist > direct * CORRIDOR) return;

      const grab = spot.kind === "vending" ? spot.serviceMin : 4;
      const via  = walkMinutes(start, spot, HUSTLE_MS)
                 + grab
                 + walkMinutes(spot, end, HUSTLE_MS);

      options.push({
        label: spot.kind === "vending"
          ? `Hustle + vending at ${spot.name}`
          : `Hustle + grab from ${spot.name}`,
        kind: spot.kind,
        minutes: Math.round(via),
        delta: Math.round(budget - via),
        note: spot.kind === "vending"
          ? `On your path. ${grab}-minute stop.`
          : `Roughly on your path. Assumes a ${grab}-minute grab-and-go.`
      });
    });

  return options
    .map(o => ({ ...o, makesIt: o.delta >= 0 }))
    .sort((a, b) => b.delta - a.delta);
}

// ============================================================
// NARRATOR  (Gemini writes over computed numbers)
// ============================================================

function narratorPrompt(query, intent, options) {
  return `You are a campus assistant. A student asked: "${query}"

These options were computed from real distances and opening hours.
The numbers are correct — never recalculate or change them.

${JSON.stringify(options, null, 2)}

Write a short recommendation:
- Lead with the single best option and why.
- Give its time breakdown using the exact numbers above.
- Mention one runner-up and the tradeoff.
${intent.mode === "panic"
  ? "- This is urgent. If nothing makes it in time, say so directly and give the least-late option."
  : "- Note the leftover buffer so they know how much slack they have."}

If a vending machine is the only option that fits the time budget, recommend it
plainly. It is a real answer, not a consolation prize. Do not apologize for it.

Be concise and direct. No preamble, no lists longer than three items.
Do not invent places, times, or menu items.`;
}

// ============================================================
// ORCHESTRATOR — the one function the UI calls
// ============================================================

async function ask(query, apiKey) {
  const intent = await callGemini(apiKey, intentPrompt(query), true);

  const options = intent.mode === "panic"
    ? planPanic(intent)
    : planFoodStop(intent);

  if (!options.length) {
    return {
      intent,
      options: [],
      answer: "I couldn't match that to places I know on campus. Try naming the building directly."
    };
  }

  const answer = await callGemini(
    apiKey,
    narratorPrompt(query, intent, options.slice(0, 4)),
    false
  );

  return { intent, options, answer };
}

export { ask, planPanic, planFoodStop, findPlace, walkMinutes, CAMPUS };
