// ============================================================
// narrate.js — stage 3: Gemini writes the recommendation over numbers
// that were already computed. It is told never to change them.
// ============================================================
import { callGemini } from "./gemini.js";

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SYSTEM = `You are the Campus Survival Assistant for Purdue University in Indianapolis.
The app already computed every number below from real distances and opening hours. They are correct.
Never change, recompute, round, or add numbers. Never invent places, menu items, or hours.
Write 2 or 3 short sentences, at most 60 words, plain text only: no markdown, no lists, no emoji.
Lead with the pick and its time breakdown. Then give one runner-up, or say why a place the student asked for was skipped.
If a vending machine is the pick, recommend it plainly; it's a real answer, not a consolation prize.
If the student will be late, say so directly and calmly and tell them to go now.`;

function summarize(rec, query) {
  return {
    studentAsked: query,
    mode: rec.mode,
    minutesAvailable: rec.availableMinutes,
    from: rec.origin?.name, to: rec.destination?.name,
    pick: {
      name: rec.location, risk: rec.risk, totalMinutes: rec.totalMinutes, bufferMinutes: rec.bufferMinutes,
      steps: rec.steps.map(s => `${s.label}: ${s.minutes} min`), closesAt: rec.stop?.closesAt ?? null
    },
    runnerUp: rec.alternatives?.[0]
      ? { name: rec.alternatives[0].location, totalMinutes: rec.alternatives[0].totalMinutes, bufferMinutes: rec.alternatives[0].bufferMinutes }
      : null,
    skipped: (rec.rejected ?? []).slice(0, 3).map(r => `${r.location}: ${r.reason}`),
    panic: rec.panic ? { yourMove: rec.panic.yourMove, options: rec.panic.options.map(o => `${o.label}: ${o.minutes} min, ${o.note}`) } : null,
    assumptions: rec.assumptions
  };
}

export function fallbackNarration(rec) {
  const [a, b, c] = rec.steps;
  const alt = rec.alternatives?.[0];
  if (rec.mode === "panic" && rec.panic) {
    const m = rec.panic.yourMove;
    return `${m.title.charAt(0)}${m.title.slice(1).toLowerCase()}. ${m.detail}`;
  }
  if (rec.mode === "travel") {
    const extra = rec.bufferMinutes < 0 ? ` You'll be about ${-rec.bufferMinutes} min late, so go now.` : ` That leaves ${rec.bufferMinutes} min to spare.`;
    return `${a.label}: ${a.minutes} min.${extra}`;
  }
  if (!b) return `${a.label}: ${a.minutes} min, with ${rec.bufferMinutes} min to spare.`;
  const what = rec.mode === "study" ? `${b.minutes} min to settle in and study` : `${b.minutes} min to ${b.label.toLowerCase()}`;
  let text = `Go to ${rec.location}: ${a.minutes} min walk, ${what}, then ${c.minutes} min to class, leaving ${rec.bufferMinutes} min of buffer.`;
  if (alt && alt.bufferMinutes >= 0) text += ` ${cap(alt.location)} also works with ${alt.bufferMinutes} min to spare.`;
  else if (rec.rejected?.[0]) text += ` ${cap(rec.rejected[0].location)} won't work: ${rec.rejected[0].reason}.`;
  return text;
}

export async function narrate(rec, { query, apiKey, fetchImpl, skipAI = false } = {}) {
  if (skipAI || !(apiKey ?? process.env.GEMINI_API_KEY)) {
    return { text: fallbackNarration(rec), source: "template", error: skipAI ? null : "GEMINI_API_KEY not set" };
  }
  try {
    const text = await callGemini({
      apiKey, fetchImpl, system: SYSTEM, temperature: 0.5,
      prompt: `Computed plan (JSON):\n${JSON.stringify(summarize(rec, query), null, 2)}\n\nWrite the recommendation.`
    });
    return { text: text.replace(/\*\*/g, "").trim(), source: "gemini", error: null };
  } catch (e) {
    return { text: fallbackNarration(rec), source: "template", error: `narration: ${e.message}` };
  }
}
