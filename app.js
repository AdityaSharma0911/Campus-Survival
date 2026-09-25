// ============================================================
// app.js — HTTP routes. No framework, no dependencies.
//   POST /api/survive   { query, location?, demoNow? } -> SurvivalRecommendation (+ extras)
//   GET  /api/places    directory for the Campus / Places views
//   GET  /api/status    live campus status panel
//   GET  /api/health    is the key set, is demo mode on, is the data valid
// ============================================================
import http from "node:http";
import { survive, NeedsInfoError } from "./survive.js";
import { directory, campusStatus, validateCampus, toClock, clockLabel } from "./planner.js";

/** DEMO_MODE=1 -> Wednesday 12:15 PM. DEMO_NOW="3 12:15pm" -> any day (0=Sun) and time. */
export function demoNowFromEnv(env = process.env) {
  if (env.DEMO_NOW) {
    const [day, ...rest] = env.DEMO_NOW.trim().split(/\s+/);
    return { day: Number(day), hour: rest.join("") };
  }
  return env.DEMO_MODE === "1" ? { day: 3, hour: "12:15pm" } : null;
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function readJson(req, limit = 10_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new HttpError(413, "Request body too large.");
  }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Body must be valid JSON."); }
}

export function createApp({
  apiKey = process.env.GEMINI_API_KEY,
  fetchImpl = globalThis.fetch,
  demoNow = demoNowFromEnv(),
  corsOrigin = process.env.CORS_ORIGIN || "*"
} = {}) {
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store"
      });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    const url = new URL(req.url, "http://localhost");
    const route = `${req.method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
    const nowFor = override => {
      if (override == null) return demoNow ?? undefined;
      try { toClock(override); return override; } catch (e) { throw new HttpError(400, `Bad demoNow: ${e.message}`); }
    };

    try {
      if (req.method === "OPTIONS") return send(204);
      switch (route) {
        case "GET /api/health": {
          const v = validateCampus();
          return send(200, {
            ok: true, gemini: Boolean(apiKey), model: process.env.GEMINI_MODEL || "gemini-flash-latest",
            demoMode: Boolean(demoNow), now: clockLabel(toClock(demoNow ?? undefined)),
            data: { valid: v.ok, errors: v.errors, estimatedCoordinates: v.warnings.filter(w => w.includes("ESTIMATED")).length }
          });
        }
        case "GET /api/places":
          return send(200, directory(demoNow ?? undefined));
        case "GET /api/status":
          return send(200, campusStatus(demoNow ?? undefined));
        case "POST /api/survive": {
          const body = await readJson(req);
          const location = body.location && typeof body.location === "object" ? body.location : null;
          const out = await survive({ query: body.query, location, now: nowFor(body.demoNow), apiKey, fetchImpl });
          return send(200, out);
        }
        default:
          return send(404, { error: `No route for ${route}. Use POST /api/survive.` });
      }
    } catch (e) {
      if (e instanceof NeedsInfoError) return send(422, { error: e.message, needs: e.needs });
      if (e instanceof HttpError) return send(e.status, { error: e.message });
      console.error(e);
      return send(500, { error: "Something went wrong planning that. Try again.", detail: e.message });
    }
  });
}
