# Validation and known limitations

## Completed checks

- `npm run build` passed: TypeScript checking and Vite production compilation.
- Executed assertions against the mock recommendation functions:
  - 25-minute hungry scenario: 21-minute total, 4-minute buffer, safe.
  - 8-minute direct-class scenario: 6-minute total, 2-minute buffer.
  - 22-minute coffee scenario: tight.
  - 8-minute hungry scenario: screwed.

These checks were performed during frontend creation. They are not a persistent automated test suite. There is no test or lint script in package.json.

## Browser verification limitation

The browser environment could not access the internal preview. End-to-end click testing, screenshot review, mobile rendering, and WebMCP execution remain unverified. Do not describe these checks as passing.

## Manual acceptance checklist

- Try Demo fills the exact sample query without submitting it.
- SURVIVE shows loading, then Campus Café with 21 minutes total and a 4-minute buffer.
- Enter submits; Shift+Enter inserts a newline. Empty input cannot submit.
- View route expands details; the route-card control collapses them.
- AI reasoning toggles its explanation.
- All four quick actions produce the corresponding mock scenario.
- Emergency mode compares 21-, 26-, and 6-minute choices; direct route shows a 2-minute buffer.
- Alternative cards update results; Campus and Places navigation works.
- Check narrow mobile widths, keyboard focus, long input, and reduced-motion preferences.

## Product limitations

All venue availability, walking durations, explanations, and campus status are illustrative. The diagram is not geographically accurate and must not be used for real navigation. No GPS, authentication, storage, calendar access, dining API, backend, or real AI is implemented. State resets on page refresh. The layout includes responsive CSS, but mobile browser QA remains outstanding.
