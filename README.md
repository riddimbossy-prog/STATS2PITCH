# Stats2Pitch.com v1.14.0

**From stats to the pitch.**

Stats2Pitch is a login-gated football prediction dashboard. The application uses API-Football for fixtures/form/standings and can enrich each fixture with broader odds markets from TheStatsAPI. Supabase handles accounts and the persisted prediction-board snapshot; Render hosts the Node application.

## Interface

The site uses the black, white and green Stats2Pitch identity throughout. The login screen is football-first, account creation goes directly into the app without an email-verification step, and GitHub sign-in is not included.

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

The Supabase URL may be entered either as the full `https://...supabase.co` URL or as the Supabase hostname; the server normalizes it.

See `SETUP_GITHUB_RENDER_SUPABASE.md` for deployment steps.

## Front-end file layout (v1.14.0)

The front end is four files plus the app module. They load in this order and the
order matters:

| File | When it runs | Contains |
| --- | --- | --- |
| `s2p-cache-reset-v1.14.0.js` | head, blocking | one-time storage/cache cleanup, keyed on the build constant |
| `s2p-styles-v1.14.0.css` | head | all 17 former stylesheets, cascade order preserved |
| `s2p-boot-v1.14.0.js` | body, blocking | network guard, deterministic board bootstrap, boot guard, date router |
| `app.v1.5.0.js` | deferred module | the application |
| `s2p-ui-v1.14.0.js` | deferred, after the module | loading surface, UI layers, status clock, board runtime, responsive board, live scores |

Inside each bundle, blocks are separated by `segment:` banners naming the file
they came from, and each block is wrapped in its own try/catch. A failure logs
`[s2p] segment failed: <name>` and the remaining segments still run.

**Making changes:** edit the relevant segment in place inside the bundle. Do not
add a new versioned file to `public/` — `npm run check` will fail if an unbundled
script or stylesheet appears there, which is deliberate: that pattern is what
grew the folder to 60 files. When you change a bundle, bump the version in the
filename, in `index.html`, in `package.json`, in `server/index.js` (`VERSION`),
and in `server/bootBundle.test.js` (`BUILD`) so the cache reset runs once for the
new build.
