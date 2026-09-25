# Backend integration

## Existing boundary

`src/data/mockCampus.ts` exports:

```ts
async function getSurvivalRecommendation(
  query: string
): Promise<SurvivalRecommendation>
```

The current implementation waits roughly one second and calls `makeRecommendation`. Replace the body at the TODO marker with your team's API client. No endpoint or backend protocol has been implemented or agreed yet.

Use `src/types/campus.ts` as the response contract:

```ts
interface SurvivalRecommendation {
  location: string;
  totalMinutes: number;
  bufferMinutes: number;
  risk: 'safe' | 'tight' | 'screwed';
  reason: string[];
  steps: RouteStep[];
}
interface RouteStep {
  type: 'walk' | 'food' | 'class';
  label: string;
  minutes: number;
}
```

Validate incoming JSON at the API boundary: finite numeric durations, supported risk and step values, valid strings, and a valid steps array. Throw a meaningful error on unsuccessful HTTP responses or malformed data so the existing submission error state can handle failure. Keep AI credentials on the backend.

## Timing rules

The mock reads the first number followed by `min` from the query; otherwise the available window defaults to 25 minutes. Total time is the sum of step durations. Buffer equals available time minus total time.

- Negative buffer: `screwed`.
- Zero through three minutes: `tight`.
- Four minutes or more: `safe`.

The 8-minute direct-class scenario therefore has a `tight` result even though it is the recommended choice in the emergency comparison.

## Additional integration points

Replacing the async function alone does not convert every interaction to real data:

- Initial sample, alternative selections, and some directory actions call `makeRecommendation` directly in `App.tsx`.
- Campus status and emergency comparison are hardcoded presentation data.
- Route labels assume University Hall as origin and Innovation Hall as destination. The route card expects a single direct walk or three walk/stop/walk steps.
- Alternative badges are fixed demo labels. Gateway Café selection uses a 22-minute window to demonstrate the tight state.
- Free-form queries use keyword matching, not natural-language understanding. Arbitrary origins and destinations are not resolved.

For live routing, expand the contract to include structured origin, destination, stop, available-time, and opening-hours information, then update route rendering and all direct mock callers together.

## Optional browser agent interface

`App.tsx` feature-detects `document.modelContext` and registers `plan_campus_survival`. It accepts a nonempty `query` string and invokes the same submit action as the form. Registration is cleaned up with an AbortController. Unsupported browsers continue without it. This interface was not validated in a supported browser context.

## Existing Hackathon_Project engine

At integration handoff, the repository root contains `engine.js`, which exports `ask(query, apiKey)` and returns `{ intent, options, answer }`. The frontend intentionally remains a mock-only implementation as requested. Do not import this engine into the browser with a private Gemini key.

Expose the engine through a server-owned endpoint, then adapt its result to the frontend contract. For a food option, map `name` to `location`, `total` to `totalMinutes`, `buffer` to `bufferMinutes`, and `walkTo` / `eat` / `walkOn` to route steps. Panic options use `label`, `minutes`, and `delta` instead. Preserve engine-computed values and account for its `feasible` or `makesIt` fields when deciding whether to recommend a choice; buffer alone does not reflect opening-hours feasibility. Render the returned narration separately rather than pretending it is a structured list of reasons.

The engine imports `./campus.js`; that file was absent from the inspected repository snapshot. The backend teammate must provide the dataset before running the engine. The frontend does not require that file and runs independently. No existing root files are modified by this frontend addition.
