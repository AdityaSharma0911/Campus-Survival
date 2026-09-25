// npm run check                      -> data check + sample questions
// npm run check -- "your sentence"   -> ask anything
// Uses Gemini if GEMINI_API_KEY is in backend/.env, otherwise the rule-based parser.
import { loadEnv } from "../src/env.js";
loadEnv(new URL("../.env", import.meta.url));
const { survive } = await import("../src/survive.js");
const { validateCampus } = await import("../src/planner.js");
const { demoNowFromEnv } = await import("../src/app.js");

const v = validateCampus();
console.log(`Data: ${v.ok ? "valid" : "INVALID"}`);
v.errors.forEach(e => console.log("  error:", e));
v.warnings.forEach(w => console.log("  warn: ", w));
console.log(`Gemini: ${process.env.GEMINI_API_KEY ? "on" : "off (no key in backend/.env)"}`);

const now = demoNowFromEnv() ?? { day: 3, hour: "12:15pm" };
const asked = process.argv.slice(2).join(" ").trim();
const questions = asked ? [asked] : [
  "I have 30 min between CS 180 in SL 112 and my next class in ET and I'm hungry",
  "I have 22 minutes to find coffee.",
  "leaving tower in half an hour for ET, need a quiet spot to study",
  "I have 8 minutes, I'm in North Hall, class in SL, starving",
  "help im screwed, 4 min to get from campus center to innovation hall"
];

for (const q of questions) {
  try {
    const r = await survive({ query: q, now });
    console.log(`\n> ${q}`);
    console.log(`  ${r.mode.toUpperCase()}: ${r.location}  |  ${r.totalMinutes} min total, ${r.bufferMinutes} min buffer, ${r.risk}`);
    console.log(`  ${r.steps.map(s => `${s.label} (${s.minutes})`).join("  →  ")}`);
    if (r.panic) console.log(`  YOUR MOVE: ${r.panic.yourMove.title}`);
    console.log(`  "${r.narration}"`);
    console.log(`  [intent: ${r.ai.intent}, narration: ${r.ai.narration}]${r.ai.errors.length ? "  " + r.ai.errors.join(" | ") : ""}`);
  } catch (e) {
    console.log(`\n> ${q}\n  ${e.message}`);
  }
}
