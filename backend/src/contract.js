// ============================================================
// contract.js — enforces the frontend's SurvivalRecommendation rules
// (frontend/src/types/campus.ts + docs/BACKEND_INTEGRATION.md) on every
// response, so the UI never receives something it can't render.
// ============================================================
export const RISKS = ["safe", "tight", "screwed"];
export const STEP_TYPES = ["walk", "food", "class"];

/** Frontend timing rule: negative = screwed, 0–3 = tight, 4+ = safe. */
export const riskOf = buffer => (buffer < 0 ? "screwed" : buffer <= 3 ? "tight" : "safe");

export function checkRecommendation(r, path = "response") {
  const errs = [];
  const bad = (field, why) => errs.push(`${path}.${field}: ${why}`);
  if (!r || typeof r !== "object") return [`${path}: not an object`];
  if (typeof r.location !== "string" || !r.location.trim()) bad("location", "must be a nonempty string");
  for (const f of ["totalMinutes", "bufferMinutes"]) if (!Number.isFinite(r[f])) bad(f, "must be a finite number");
  if (!RISKS.includes(r.risk)) bad("risk", `must be one of ${RISKS.join(", ")}`);
  if (!Array.isArray(r.reason) || !r.reason.every(s => typeof s === "string" && s.trim())) bad("reason", "must be an array of nonempty strings");
  if (!Array.isArray(r.steps) || !r.steps.length) bad("steps", "must be a nonempty array");
  else r.steps.forEach((s, i) => {
    if (!STEP_TYPES.includes(s?.type)) bad(`steps[${i}].type`, `must be one of ${STEP_TYPES.join(", ")}`);
    if (typeof s?.label !== "string" || !s.label.trim()) bad(`steps[${i}].label`, "must be a nonempty string");
    if (!Number.isFinite(s?.minutes) || s.minutes < 0) bad(`steps[${i}].minutes`, "must be a finite number >= 0");
  });
  if (!errs.length) {
    const sum = r.steps.reduce((a, s) => a + s.minutes, 0);
    if (sum !== r.totalMinutes) bad("totalMinutes", `must equal the sum of steps (${sum})`);
    if (Number.isFinite(r.availableMinutes) && r.availableMinutes - r.totalMinutes !== r.bufferMinutes) bad("bufferMinutes", "must equal availableMinutes - totalMinutes");
    if (riskOf(r.bufferMinutes) !== r.risk) bad("risk", `must be "${riskOf(r.bufferMinutes)}" for a ${r.bufferMinutes} min buffer`);
  }
  return errs;
}

export function checkResponse(r) {
  const errs = checkRecommendation(r);
  (r?.alternatives ?? []).forEach((a, i) => errs.push(...checkRecommendation(a, `alternatives[${i}]`)));
  (r?.panic?.options ?? []).forEach((o, i) => {
    if (!Number.isFinite(o.minutes) || !Number.isFinite(o.delta) || typeof o.makesIt !== "boolean") errs.push(`panic.options[${i}]: bad numbers`);
  });
  return errs;
}
