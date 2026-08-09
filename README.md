# Stats2Pitch.com v1.4.0

**From stats to the pitch.**

Stats2Pitch is a login-gated football prediction dashboard. The application uses API-Football for fixtures/form/standings and can enrich each fixture with broader odds markets from TheStatsAPI. Supabase handles accounts and the persisted prediction-board snapshot; Render hosts the Node application.

## v1.4.0 interface

The site now uses the supplied black, white and green Stats2Pitch identity throughout. The login screen is football-first, account creation goes directly into the app without an email-verification step, and GitHub sign-in is not included.

The Prediction Board has Market, Minimum Filters, Fixture Date, Choose Filters and Sort By controls. Chosen filters appear as removable chips. Inside Choose Filters you can use **Match any**, **Match all**, and **Put one selected filter first** to sort around a specific filter. User-facing reasons are written in normal football language rather than backend/statistical shorthand.

Each fixture can open **View details** to show its reasons and the available market prices that were collected for that match. Provider/admin information is deliberately not shown in the normal UI.

## Run

```bash
npm ci
npm start
```

Health check: `GET /api/health`

Engine check:

```bash
npm run check
```

## Required Render secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEY`

For extra odds/markets:

- `STATS_API_KEY`
- `STATS_API_BASE_URL=https://api.thestatsapi.com/api`

The Supabase URL may be entered either as the full `https://...supabase.co` URL or as the Supabase hostname; v1.4.0 normalizes it server-side.

See `SETUP_GITHUB_RENDER_SUPABASE.md` for deployment steps.
