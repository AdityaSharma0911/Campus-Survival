# Campus Survival

Ask in plain English, get a plan that actually fits the time you have.

> "I have 25 minutes between my classes and I'm hungry. I'm at North Hall and my next class is at Innovation Hall."
>
> "Help, I'm screwed — 4 minutes to get from Campus Center to Innovation Hall."

## What it does

Google Maps can tell you how far away something is. It can't tell you whether
you have time for it. The gap between two classes isn't a routing problem — it's
a constraint problem, and the constraints are walking time, service time,
opening hours, and how late you're willing to be.

Campus Survival solves that. You describe your situation in a sentence and it
returns a real route — where you are, where you're stopping, where you're headed
— with the full time breakdown and how much buffer you're left with. It also
shows what it *ruled out* and why: "Chick-fil-A: needs 34 min, you have 25."

## Panic mode

When the budget is impossible, the app doesn't give up — it returns tradeoffs.
What makes it, what doesn't, how late each option lands, and what accepting two
more minutes actually buys you.

It also knows where the **vending machines** are, which Google Maps doesn't. When
you have eight minutes, a vending machine on your route is often the right
answer, and the app says so plainly.

## How it works

Three stages:

1. **Intent** (`backend/src/intent.js`) — Gemini turns the sentence into
   structured JSON against a strict schema. Unknown building ids are thrown out.
   If Gemini is missing, slow or rate-limited, a rule-based parser handles the
   same sentences, so **the demo works with no API key at all.**
2. **Math** (`backend/src/planner.js`) — walking times, lunch-rush lines,
   opening hours, buffers. Pure JavaScript over verified campus coordinates,
   in Indianapolis time.
3. **Narration** (`backend/src/narrate.js`) — Gemini writes the recommendation
   over the computed numbers and is instructed never to change them. Template
   fallback if it fails.

`backend/src/contract.js` validates every response before it leaves the server:
total equals the sum of the steps, buffer equals available minus total, and risk
is screwed below 0, tight at 0–3, safe at 4+. **Every number the app shows you
was computed, not generated.**

## Running it

Two processes. Node 18.17+ (22 LTS recommended).

```sh
# terminal 1 — the planner (zero dependencies, no npm install)
cd backend
cp .env.example .env     # optional: paste a Google AI Studio key
npm start                # http://localhost:8787/api/health

# terminal 2 — the app
cd frontend
npm ci
npm run dev              # http://localhost:4173
```

Vite proxies `/api` to the planner, so the Gemini key stays on the server and
never reaches the browser.

Without a key the rule-based parser handles every demo sentence. Set
`DEMO_MODE=1` in `backend/.env` to freeze the clock at Wednesday 12:15 PM if you
are demoing outside dining hours.

```sh
cd backend
npm test      # 43 tests, no key or network needed
npm run check # sample questions; add -- "your sentence" to ask anything
```

## Layout

| Path | Role |
| --- | --- |
| `backend/src/campus.js` | Buildings, dining, vending, study spots — coordinates and hours |
| `backend/src/planner.js` | All math, directory, campus status, data validator |
| `backend/src/intent.js` · `narrate.js` · `gemini.js` | The AI layer, with fallbacks |
| `backend/src/survive.js` | Sentence in, full recommendation out |
| `backend/src/app.js` · `server.js` | HTTP routes / startup |
| `frontend/src/data/survivalApi.ts` | Typed client; validates every response at the boundary |
| `frontend/src/` | React + Vite + Tailwind app |
| `legacy/` | Superseded prototypes, kept for reference |

## Data

Campus coordinates and vendor hours were collected by hand from IU Indy
facilities listings, LibCal and the Campus Center's published hours, with each
entry carrying a `verified` flag. Five coordinates remain estimated from street
addresses and are marked as such — `npm start` reports the count on boot. The
dataset is static, so the app makes no location API calls at runtime.
