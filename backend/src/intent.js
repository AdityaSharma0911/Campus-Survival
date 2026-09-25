// ============================================================
// intent.js — stage 1: turn a messy sentence into structured intent.
// Gemini does it when available; a rule-based parser takes over if the key
// is missing, the model is slow, or it returns something invalid.
// ============================================================
import { CAMPUS } from "./campus.js";
import { callGemini } from "./gemini.js";
import { getPlace, resolvePlace, clockLabel, parseTime } from "./planner.js";

const GOALS = ["food", "coffee", "study", "travel"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const INTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    origin: { type: "STRING", nullable: true, description: "Building id the student is in or leaving from" },
    destination: { type: "STRING", nullable: true, description: "Building id of the next class or where they must get to" },
    minutesAvailable: { type: "INTEGER", nullable: true, description: "Stated duration in minutes" },
    classTime: { type: "STRING", nullable: true, description: 'Stated start time of the next class, e.g. "12:45pm"' },
    goal: { type: "STRING", format: "enum", enum: GOALS },
    urgent: { type: "BOOLEAN" },
    wants: { type: "ARRAY", items: { type: "STRING" } },
    avoids: { type: "ARRAY", items: { type: "STRING" } },
    usesCurrentLocation: { type: "BOOLEAN" }
  },
  required: ["goal", "urgent", "wants", "avoids", "usesCurrentLocation"]
};

function intentPrompt(query, clock) {
  const buildings = CAMPUS.buildings
    .map(b => `${b.id} = ${b.name} (also called: ${b.aliases.join(", ")})`).join("\n");
  const spots = [...CAMPUS.dining, ...CAMPUS.vending, ...(CAMPUS.study ?? [])].map(p => p.name).join("; ");
  return `Extract structured intent from a student's message to a campus assistant at Purdue University in Indianapolis.
Current time: ${DAY_NAMES[clock.day]} ${clockLabel(clock).split(" ").slice(1).join(" ")}.

Buildings (use these ids exactly for origin/destination):
${buildings}

Food, coffee, vending and study places (never an origin or destination; if the student names one, put it in "wants"):
${spots}

Message: """${query}"""

Rules:
- origin: building the student is in or leaving from. A room like "SL 112" means SL. Course names like "CS 180" are NOT buildings.
- destination: building of the next class, or where they need to get to.
- If a building isn't in the list (e.g. "University Hall"), use null. Never guess.
- minutesAvailable: only a stated duration. "half an hour" = 30.
- classTime: only a stated start time for the next class.
- goal: food (hungry, lunch, eat, snack), coffee (coffee, tea, caffeine, boba), study (study, homework, quiet spot), travel (just getting somewhere).
- urgent: true if they're late, panicking, say "screwed", or the time sounds impossible.
- wants / avoids: specific foods or places they ask for or rule out, lowercase.
- usesCurrentLocation: true only if they say "here", "where I am", or "near me".
- Do not compute times or distances.`;
}

// ---------- validation ----------
const asBuilding = v => {
  if (typeof v !== "string" || !v.trim()) return { id: null };
  const p = resolvePlace(v);
  if (!p) return { id: null };
  if (p.kind === "building") return { id: p.id };
  return { id: null, want: p.name.split(" (")[0].toLowerCase() }; // a food/study place -> it's a "want"
};
const strList = v => Array.isArray(v) ? v.filter(s => typeof s === "string" && s.trim()).map(s => s.trim().toLowerCase()).slice(0, 8) : [];

export function sanitizeIntent(raw) {
  if (!raw || typeof raw !== "object") throw new Error("intent is not an object");
  const o = asBuilding(raw.origin), d = asBuilding(raw.destination);
  let minutes = Number.isFinite(raw.minutesAvailable) ? Math.round(raw.minutesAvailable) : null;
  if (minutes != null && (minutes < 1 || minutes > 600)) minutes = null;
  let classTime = typeof raw.classTime === "string" && raw.classTime.trim() ? raw.classTime.trim() : null;
  if (classTime) { try { parseTime(classTime); } catch { classTime = null; } }
  return {
    origin: o.id,
    destination: d.id,
    minutesAvailable: minutes,
    classTime,
    goal: GOALS.includes(raw.goal) ? raw.goal : "food",
    urgent: raw.urgent === true,
    wants: [...new Set([...strList(raw.wants), ...[o.want, d.want].filter(Boolean)])],
    avoids: strList(raw.avoids),
    usesCurrentLocation: raw.usesCurrentLocation === true
  };
}

// ---------- rule-based fallback ----------
const STOP_ALIASES = new Set(["north", "science", "dorm", "computer science", "engineering", "tea", "coffee", "swipe", "caf", "pizza", "market", "chinese", "food court"]);
const FOOD_WORDS = ["pizza", "chicken", "chinese", "salad", "burger", "burgers", "sandwich", "coffee", "tea", "smoothie", "stir fry", "dessert", "vegetarian", "snack", "boba", "wings", "noodles", "rice"];
const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&': ]/g, " ").replace(/:(?!\d)/g, " ").replace(/\s+/g, " ").trim();

function buildingPhrases() {
  const out = [];
  for (const b of CAMPUS.buildings) {
    for (const a of [b.name.replace(/\s*\([^)]*\)$/, ""), b.short, ...(b.aliases ?? [])]) {
      const n = a && norm(a);
      if (n && n.length > 2 && !STOP_ALIASES.has(n)) out.push({ phrase: n, id: b.id });
    }
  }
  return out.sort((a, b) => b.phrase.length - a.phrase.length);
}
const PHRASES = buildingPhrases();
const CODES = new Set(CAMPUS.buildings.map(b => b.id));

// Food/study place names ("Tower Dining", "Campus Center study") are wants, not buildings: hide them first.
const SPOT_PHRASES = [...CAMPUS.dining, ...CAMPUS.vending, ...(CAMPUS.study ?? [])]
  .flatMap(p => [p.name.replace(/\s*\([^)]*\)$/, ""), ...(p.aliases ?? [])])
  .map(s => norm(s)).filter(s => s.split(" ").length >= 2)
  .sort((a, b) => b.length - a.length);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEST_WORDS = new Set(["class", "lecture", "lab", "next", "exam", "meeting", "headed", "heading", "going", "towards", "toward"]);
const ORIGIN_WORDS = new Set(["from", "at", "in", "leaving", "near", "im", "i'm", "out", "inside"]);

function roleFor(text, index) {
  // Only look inside the current clause: words since the last "and / but / then / so".
  const words = text.slice(0, index).split(" ").filter(Boolean);
  let start = words.length;
  while (start > 0 && !["and", "but", "then", "so"].includes(words[start - 1]) && words.length - start < 8) start--;
  const clause = words.slice(start);
  const lastTwo = clause.slice(-2);
  if (clause.some(w => DEST_WORDS.has(w)) || lastTwo.includes("to") || lastTwo.includes("for")) return "destination";
  if (clause.some(w => ORIGIN_WORDS.has(w))) return "origin";
  return null;
}

function findBuildingMentions(query) {
  let text = norm(query);
  for (const s of SPOT_PHRASES) text = text.replace(new RegExp(`\\b${esc(s)}\\b`, "g"), m => "_".repeat(m.length));
  const found = [];
  const taken = new Array(text.length).fill(false);
  const claim = (start, len, id) => {
    for (let i = start; i < start + len; i++) if (taken[i]) return;
    for (let i = start; i < start + len; i++) taken[i] = true;
    found.push({ id, index: start });
  };
  for (const { phrase, id } of PHRASES) {
    for (const m of text.matchAll(new RegExp(`\\b${esc(phrase)}\\b`, "g"))) claim(m.index, phrase.length, id);
  }
  // Two-letter building codes: "SL", "sl 112", "in sl"
  for (const m of text.matchAll(/\b([a-z]{2})\b(\s*\d{2,4})?/g)) {
    const code = m[1].toUpperCase();
    if (!CODES.has(code)) continue;
    const before = text.slice(0, m.index).split(" ").filter(Boolean).slice(-1)[0];
    const originalIsCaps = new RegExp(`\\b${code}\\b`).test(query);
    if (originalIsCaps || m[2] || ["in", "at", "from", "to", "near", "leaving", "by", "for"].includes(before)) claim(m.index, 2, code);
  }
  return found.sort((a, b) => a.index - b.index).map(f => ({ ...f, role: roleFor(text, f.index) }));
}

function wordsToMinutes(text) {
  const m = text.match(/(\d{1,3})\s*-?\s*(?:min|mins|minute|minutes)\b/);
  if (m) return Number(m[1]);
  if (/\bhalf (?:an )?hour\b/.test(text)) return 30;
  const h = text.match(/(\d{1,2})\s*(?:hr|hrs|hour|hours)\b/);
  if (h) return Number(h[1]) * 60;
  if (/\b(?:an|one) hour\b/.test(text)) return 60;
  if (/\bquarter (?:of an )?hour\b/.test(text)) return 15;
  return null;
}

export function fallbackIntent(query) {
  const text = norm(query);
  const mentions = findBuildingMentions(query);
  let origin = mentions.find(m => m.role === "origin")?.id ?? null;
  let destination = mentions.find(m => m.role === "destination" && m.id !== origin)?.id ?? null;
  const unassigned = mentions.filter(m => m.id !== origin && m.id !== destination);
  if (/\bbetween\b/.test(text) && mentions.length >= 2 && !destination) { origin = mentions[0].id; destination = mentions[1].id; }
  for (const m of unassigned) {
    if (!origin) origin = m.id; else if (!destination && m.id !== origin) destination = m.id;
  }

  const minutesAvailable = wordsToMinutes(text);
  let classTime = null;
  if (minutesAvailable == null) {
    const t = text.match(/\b(?:class|lecture|lab|exam|meeting)\b[^.]*?\b(?:at|by|starts at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/) ||
              text.match(/\bby\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/) ||
              text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\s+(?:class|lecture|lab)\b/);
    if (t) classTime = t[1].replace(/\s+/g, "");
  }

  const wants = [], avoids = [];
  const spotNames = [...CAMPUS.dining, ...(CAMPUS.study ?? [])].flatMap(p => [p.name.split(" (")[0], ...(p.aliases ?? [])]).map(norm);
  for (const w of [...new Set([...spotNames, ...FOOD_WORDS])]) {
    const i = text.search(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (i < 0) continue;
    const before = text.slice(0, i).split(" ").filter(Boolean).slice(-2);
    (before.some(x => ["no", "not", "avoid", "skip", "except", "without", "but", "hate"].includes(x)) ? avoids : wants).push(w);
  }

  const goal =
    /\b(coffee|caffeine|latte|espresso|tea|boba|smoothie)\b/.test(text) ? "coffee" :
    /\b(study|studying|homework|quiet|focus)\b/.test(text) && !/\b(hungry|food|eat|lunch)\b/.test(text) ? "study" :
    /\b(hungry|starving|food|eat|eating|lunch|dinner|breakfast|snack|bite|grab something|famished)\b/.test(text) || wants.length ? "food" :
    "travel";

  return {
    origin, destination, minutesAvailable, classTime, goal,
    urgent: /\b(screwed|late|hurry|rush|asap|panic|panicking|help|running|sprint)\b/.test(text),
    wants: wants.filter(w => !["library"].includes(w)).slice(0, 8), avoids: avoids.slice(0, 8),
    usesCurrentLocation: /\b(here|where i am|near me|my location)\b/.test(text)
  };
}

// ---------- entry point ----------
export async function parseIntent(query, { clock, apiKey, fetchImpl, skipAI = false } = {}) {
  const rules = fallbackIntent(query);
  if (skipAI || !(apiKey ?? process.env.GEMINI_API_KEY)) {
    return { intent: rules, source: "rules", error: skipAI ? null : "GEMINI_API_KEY not set" };
  }
  try {
    const raw = await callGemini({ apiKey, fetchImpl, prompt: intentPrompt(query, clock), schema: INTENT_SCHEMA, temperature: 0.1 });
    const ai = sanitizeIntent(raw);
    // Fill gaps the model left that the rules caught (never override the model).
    return {
      intent: {
        ...ai,
        origin: ai.origin ?? rules.origin,
        destination: ai.destination ?? (rules.destination !== (ai.origin ?? rules.origin) ? rules.destination : null),
        minutesAvailable: ai.minutesAvailable ?? (ai.classTime ? null : rules.minutesAvailable)
      },
      source: "gemini", error: null
    };
  } catch (e) {
    return { intent: rules, source: "rules", error: `intent: ${e.message}` };
  }
}

export const _test = { findBuildingMentions, getPlace };
