# Campus Survival

A frontend-only hackathon MVP that helps students decide whether food, coffee, or studying fits between classes. The demo uses Purdue University in Indianapolis location names and a black-and-gold visual theme. It is not an official university service.

## Quick start

Use Node.js 22 LTS and npm. Run these commands from this frontend's directory:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (port 4173 by default).

```sh
npm run build
```

The build runs TypeScript checking and creates static assets in `dist/`. No backend, database, credentials, or environment variables are required.

## Demo

1. Click **Try Demo** to fill the situation input.
2. Click **SURVIVE**. A mock request displays a loading state for about one second.
3. The food recommendation shows Campus Café: 5 minutes walking, 10 minutes eating, and 6 minutes to Innovation Hall. Total: 21 minutes; buffer: 4 minutes.
4. Select **View route** for detailed steps, or **Show AI reasoning** for the mock explanation.
5. Click **I'm Screwed** to compare detours against an 8-minute deadline. **Take direct route** returns the 6-minute class route with a 2-minute buffer.
6. Try the food, class, coffee, and study shortcuts; browse **Campus** and **Places**; select an alternative recommendation.

The initial result is a labeled sample preview. The application does not contact an AI provider.

## Stack and structure

React 19, Vite 6, TypeScript, Tailwind CSS 4, and Lucide React.

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | View selection, query and result state, submission, optional WebMCP registration |
| `src/components/` | Header, situation input, shortcuts, results, risk, route, timeline, reasoning, alternatives, emergency comparison, and campus status |
| `src/data/mockCampus.ts` | Campus location catalog, demo query, deterministic recommendation calculation, async mock API |
| `src/types/campus.ts` | Shared location, route step, recommendation, and risk types |
| `src/style.css` | Theme, layout, responsive styling, and motion preferences |
| `public/favicon.svg` | Custom Campus Survival icon |

## Teammate handoff

Read [backend integration](docs/BACKEND_INTEGRATION.md) before connecting a service and [validation](docs/VALIDATION.md) for checks and limitations. Keep changes scoped to the frontend directory when integrating into a shared repository; do not replace the repository's root configuration or other teammates' code.

No secrets belong in frontend code. Browser-delivered environment variables and compiled JavaScript are public to anyone who can load the app.

## Running inside Hackathon_Project

This app lives in `frontend/`. From the repository root, run `cd frontend` before the quick-start commands. The root `README.md` and `engine.js` belong to the shared project and are preserved. The frontend uses mock data until the team connects the engine through a backend endpoint; see the engine-specific notes in the integration guide.
