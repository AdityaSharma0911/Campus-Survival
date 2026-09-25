// ============================================================
// server.js — startup. Loads .env, then listens.
//   npm start          -> http://localhost:8787
//   DEMO_MODE=1 npm start   -> freezes "now" at Wed 12:15 PM
// ============================================================
import { loadEnv } from "./src/env.js";
loadEnv(new URL("./.env", import.meta.url));

const { createApp, demoNowFromEnv } = await import("./src/app.js");
const { validateCampus, clockLabel, toClock } = await import("./src/planner.js");

const PORT = Number(process.env.PORT) || 8787;
const demoNow = demoNowFromEnv();

const v = validateCampus();
if (!v.ok) {
  console.error("Campus data is INVALID. Fix these before demoing:");
  v.errors.forEach(e => console.error("  error:", e));
}
const estimated = v.warnings.filter(w => w.includes("ESTIMATED")).length;

createApp({ demoNow }).listen(PORT, () => {
  console.log(`\n  Campus Survival API  ->  http://localhost:${PORT}`);
  console.log(`  health               ->  http://localhost:${PORT}/api/health`);
  console.log(`  Gemini    ${process.env.GEMINI_API_KEY ? "on" : "OFF — rule-based parser, demo still works"}`);
  console.log(`  Data      ${v.ok ? "valid" : "INVALID"}${estimated ? `, ${estimated} estimated coordinate(s)` : ""}`);
  console.log(`  Clock     ${clockLabel(toClock(demoNow ?? undefined))}${demoNow ? "  (DEMO_MODE)" : ""}\n`);
});
