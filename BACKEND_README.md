# Campus Survival — backend

Node 18.17+ (22 LTS recommended). **No npm install needed**: zero dependencies.

```sh
cd backend
cp .env.example .env        # then paste your Google AI Studio key into .env
npm start                   # http://localhost:8787/api/health
npm test                    # 43 tests, no key or internet needed
npm run check               # sample questions; add -- "your sentence" to ask anything
```

`.env` is git-ignored. The key never leaves the server and never goes in the URL.

## How it works

Same three stages as the project README:

1. **Intent** (`src/intent.js`): Gemini turns the sentence into structured JSON with a strict schema. Bad building ids are thrown out. If Gemini is down, slow, rate-limited, or the key is missing, a rule-based parser handles the same sentences, so **the demo still works without AI**.
2. **Math** (`src/planner.js`): walking times, lunch-rush lines, opening hours, buffers. Pure JavaScript, Indianapolis time zone.
3. **Narration** (`src/narrate.js`): Gemini writes the recommendation over the computed numbers and is told never to change them. Template fallback if Gemini fails.

`src/contract.js` checks every response against the frontend's rules before it's sent. Those rules are: total = sum of steps, buffer = available − total, and risk is screwed below 0, tight at 0–3, and safe at 4+.

| File | What it does |
|---|---|
| `src/campus.js` | Buildings, dining, vending, study spots |
| `src/planner.js` | All math, directory, campus status, data validator |
| `src/intent.js` / `src/narrate.js` / `src/gemini.js` | The AI layer |
| `src/survive.js` | Sentence in, `SurvivalRecommendation` out |
| `src/app.js` / `server.js` | HTTP routes / startup |
| `client/survivalApi.ts` | Drop-in client for the frontend |

## API

### `POST /api/survive`

```json
{ "query": "I have 30 min between CS 180 in SL 112 and my next class in ET and I'm hungry",
  "location": { "lat": 39.7762, "lng": -86.1728 },
  "demoNow": { "day": 3, "hour": "12:15pm" } }
```

`location` and `demoNow` are optional. GPS is only used when no building is named and the user is on campus.

The response is the frontend's `SurvivalRecommendation` (`location`, `totalMinutes`, `bufferMinutes`, `risk`, `reason`, `steps`) plus:

| Field | Use it for |
|---|---|
| `mode` | `food` / `coffee` / `study` / `travel` / `panic` |
| `origin.short`, `destination.short` | Route card "YOU ARE HERE" / "NEXT CLASS" |
| `stop` | Pit stop (`name`, `closesAt`, `kind`). `null` = direct route |
| `narration` | Gemini's recommendation, shown as a paragraph |
| `alternatives[]` | "Other options" cards: `title`, `detail`, `badge`, and a full plan to `setResult()` on click |
| `panic` | I'm Screwed panel: `yourMove {title, detail}` and `options[]` (`label`, `detail`, `minutes`, `makesIt`, `recommended`, `steps`) |
| `campusStatus[]` | `{label, value, busy}` for the status panel |
| `rejected[]` | Places skipped and why ("closed at 7:00 PM", "needs 32 min, you have 30") |
| `mapsUrl` | Google Maps walking directions |
| `assumptions[]` | e.g. "Assumed you're starting in SL" |
| `steps[].kind` | Icon hint: `food`, `coffee`, `vending`, `study`, `dining` |
| `ai` | Whether Gemini or the fallback handled intent and narration |

Errors: **422** `{error, needs}` when something essential is missing (the message says exactly what to type). **400** means bad JSON, and **500** means an unexpected failure.

### `GET /api/places`, `GET /api/status`, `GET /api/health`

- `/api/places` is the directory for the Campus / Places views: `id`, `name`, `type` (academic | food | coffee | study), `status` ("Open until 7:00 PM"), and `hoursToday`.
- `/api/status` returns the campus status panel.
- `/api/health` reports whether the key is set, whether demo time is on, and whether the data is valid.

## For the UI teammate

Nothing in `frontend/` was changed. To wire it up:

1. Copy `backend/client/survivalApi.ts` to `frontend/src/data/survivalApi.ts`. It already passes `tsc -b` and `vite build` against the current frontend.
2. In `frontend/vite.config.ts`, add the proxy:
   ```ts
   export default defineConfig({ plugins: [tailwindcss()], server: { proxy: { '/api': 'http://localhost:8787' } } });
   ```
3. In `App.tsx`, import `getSurvivalRecommendation` from `./data/survivalApi` instead of `./data/mockCampus`. Show `err.message` in the error state; it's written for users.

| Component | Hardcoded today | Use instead |
|---|---|---|
| `SurvivalResult` | "Open in demo" | `stop?.closesAt`, `narration` |
| `RouteCard` | University Hall → Innovation Hall | `origin.short`, `stop?.name`, `destination.short`. Direct route when `stop` is null. Link `mapsUrl` |
| `Timeline` | icon by `type` | same, plus `step.kind` for coffee/study/vending icons |
| `AIReasoning` | mock bullets | `reason[]` (computed facts); show `narration` separately |
| Other options | 3 fixed cards | `alternatives[]` → `title`, `detail`, `badge`; click → `setResult(alt)` |
| `ScrewedMode` | fixed 8-min options | `panic.options[]`, `panic.yourMove`. "Take direct route" → `setResult` from that option's `steps`, no second request |
| `CampusStatus` | fixed values | `campusStatus[]` or `GET /api/status` |
| Places / Campus | `locations` in mockCampus | `GET /api/places` |
| "MOCK DATA" tags | | remove; show `assumptions[]` as a small note |

**Quick actions that work without GPS.** A trip with no destination returns a 422 asking which building.

| Button | Query |
|---|---|
| Try Demo | `I have 30 min between CS 180 in SL 112 and my next class in ET, and I'm hungry.` |
| Find Food | `I have 25 minutes in SL and I'm hungry.` |
| Get to Class | `I have 10 minutes to get from North Hall to SL.` |
| Find Coffee | `I have 30 minutes in the Campus Center and want coffee.` |
| Find a Study Spot | `I have 45 minutes before my next class in ET and want to study.` |

Optional: call `getCurrentLocation()` and pass `{ location }` so "I'm hungry, 25 minutes" starts from wherever the student is standing.

## Data status (fix before judging)

- **5 building coordinates are estimates** (`verified: false`): SL, ET, LD, UL, IO. In Google Maps, right-click the building and click the coordinates to copy them. Paste them into `src/campus.js`, set `verified: true`, and run `npm test`. The project README says coordinates were verified by hand, so this matters.
- **Dining hours are unverified** except Tea's Me. Check dineoncampus.com/iuindy. Library and Campus Center building hours are verified.
- Set `DEMO_MODE=1` in `.env` for judging. Most dining is closed in the evening; demo mode freezes the clock at Wednesday 12:15 PM.
