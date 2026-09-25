# Campus Survival

Campus Survival helps students decide whether they have time for food, coffee, studying, or a direct walk before their next class. This repository is a hackathon work in progress with an interactive **frontend demo** and a separate **planning engine** that has not yet been connected to the frontend. The interface uses Purdue University in Indianapolis locations and a black-and-gold theme.

## Try the frontend

A [private demo site](https://campus-survival.well-harp-0365.chatgpt.site) is available to its authorized viewers. To run the version committed in this repository locally, install Node.js and npm, then:

```sh
cd frontend
npm ci
npm run dev
```

Open the address printed by Vite (port 4173 by default). Run `npm run build` from `frontend/` to type-check and create production assets in `frontend/dist/`. There is no root `package.json`; run npm commands inside `frontend/`.

For the main demo, click **Try Demo**, then **SURVIVE**. The sample plans a stop at Campus Café between University Hall and Innovation Hall: 5 minutes to the café, 10 minutes for food, and 6 minutes to class, for a **21-minute trip** and **4-minute buffer** within the example's 25-minute window. The **I'm Screwed** control shows an 8-minute scenario comparing two food detours with a 6-minute direct walk. You can also open route steps and reasoning, choose an alternative, use quick actions, and browse the Campus and Places views.

## Repository layout

| Path | Current role |
| --- | --- |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, and Lucide React application. Runs independently with mock recommendations. |
| `frontend/src/data/mockCampus.ts` | Mock location catalog and `getSurvivalRecommendation(query)` function; the intended API integration boundary. |
| `frontend/src/types/campus.ts` | Frontend route and recommendation types. |
| `frontend/docs/BACKEND_INTEGRATION.md` | Detailed interface contract and integration notes for the engine. |
| `frontend/docs/VALIDATION.md` | Completed checks, manual acceptance checklist, and limitations. |
| `engine.js` | Separate JavaScript module for Gemini intent extraction and narration, plus deterministic distance and feasibility calculations. |

## Engine status

`engine.js` exports `ask(query, apiKey)`, `planFoodStop`, `planPanic`, `findPlace`, and `walkMinutes`. Its intended flow is to extract structured intent with Gemini, calculate options in JavaScript from a campus dataset, and use Gemini to narrate the result. It has **not been integrated into the running frontend**.

The engine currently imports `./campus.js`, but **`campus.js` is not in this repository**. Consequently the engine cannot be imported and run as committed. There is also no server endpoint for calling it, no documented server setup, and no automated engine tests. The root README previously described manually verified coordinates and vending machine locations; those claims cannot be verified from the files currently committed.

Before connecting the parts, provide the campus dataset expected by `engine.js`, confirm the configured Gemini model and API access, create a server-owned endpoint, and map the engine's `{ intent, options, answer }` response to the frontend contract. Keep the Gemini key on the server; never expose it through browser code. Food options use `name`, `total`, `buffer`, `walkTo`, `eat`, `walkOn`, and `feasible`. Panic options use `label`, `minutes`, `delta`, and `makesIt`. See the [integration guide](frontend/docs/BACKEND_INTEGRATION.md) for the full handoff.

## Validation so far

The frontend's TypeScript/Vite production build passed during development. Direct checks of the mock recommendation logic covered the 25-minute food example, 8-minute direct-class example, a tight coffee scenario, and an over-budget food scenario. These are development checks, not a committed automated test suite. Browser end-to-end, mobile, and optional WebMCP behavior have not been verified in a working preview environment; see [validation details](frontend/docs/VALIDATION.md).
