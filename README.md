# Stats2Pitch.com

**From stats to the pitch.**

Stats2Pitch.com v1.3.0 is a login-gated football intelligence website built for GitHub, Render and Supabase, with live enrichment from API-Football / API-Sports v3 plus TheStatsAPI for broader odds and market coverage.

## Brand

The production UI is fully rebranded around the supplied Stats2Pitch logo:

- Stats2Pitch wordmark on the login screen and dashboard
- Stats2Pitch favicon and install icons derived from the supplied emblem
- Deep navy / black interface with Stats2Pitch green accents
- `stats2pitch` package and Render service naming
- Stats2Pitch metadata and web-app manifest

## Authentication

The entire prediction board remains protected behind Supabase authentication.

Supported access:

- Email + password sign in
- Email + password account creation (controlled by `ALLOW_PUBLIC_SIGNUP`)
- JWT verification on every protected Render API request
- Refresh-token session renewal
- Server-side sign-out + local token cleanup

### IMPORTANT — no email verification

To allow a new email/password account to enter Stats2Pitch immediately without clicking a verification email:

Stats2Pitch v1.1.1 no longer depends on Supabase email-confirmation settings for website signup. The Render server uses the Supabase service-role API to create each website account as **already confirmed**, then the browser signs in immediately. No verification email is required. The service-role key never reaches the browser.

If you want the site to be invite/admin-created users only, set `ALLOW_PUBLIC_SIGNUP=false` on Render. Existing confirmed users can still sign in.

## Football data already built

- Real fixtures for the selected date from API-Football
- League position and PPG
- Season goals scored/conceded per match
- Last-5 win/loss rates
- Last-10 O/U 1.5, 2.5 and 3.5 hit rates
- Real 1X2 + draw odds merged from API-Football and TheStatsAPI where available
- Broader market prices preserved from both providers, including totals, BTTS, double chance and any additional market containers returned
- Goal picks now show their real available market price when found
- Per-match **See markets** view with all normalized available prices
- Filter picker that can show matches meeting **any** or **all** selected conditions
- Sorting by selected filters, most reasons, lowest price, kickoff time or team name
- Plain-English user-facing explanations; provider/backend diagnostics stay off the public board
- Single / 2 / 3+ modular classification
- Opponent-weakness logic
- Contradiction grading
- Priority prediction list
- Team crests and country/league imagery when supplied by the API
- Responsive desktop, tablet and mobile dashboard
- Supabase prediction snapshot persistence
- Last-known-good fallback so a failed API refresh does not blank the board

## Supabase database

Run `supabase/schema.sql` once in the Supabase SQL Editor.

The browser never receives the Supabase service-role key. Prediction snapshots are read/written only by the Render server after the user's JWT is verified.

## Local test

Copy `.env.example` to `.env`, add your private values to your shell or environment, then run:

```bash
npm install
npm run check
npm start
```

Open: `http://localhost:3000`

Health check: `http://localhost:3000/api/health`

## GitHub

Create a repository named something like `stats2pitch`, commit this whole folder and publish it with GitHub Desktop.

Do not commit `.env`.

## Render

The repository includes `render.yaml` with the service name `stats2pitch`.

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEY`
- `STATS_API_KEY` (recommended for broader odds/market coverage)

Useful switches:

- `ALLOW_PUBLIC_SIGNUP=true`
- `ALLOW_MANUAL_REFRESH=true`
- `MAX_FIXTURES_PER_REFRESH=60`
- `CACHE_TTL_SECONDS=900`

## Football data usage

API-Football remains the canonical fixture, standings and recent-form source. Its odds feed is also parsed for every market it returns.

TheStatsAPI is an additive odds source using `https://api.thestatsapi.com/api`. The server matches Stats API competitions and fixtures to the canonical API-Football fixture, requests `/football/matches/<matchId>/odds`, normalizes every market it can safely identify, and merges the best available price for each choice. The integration is fail-safe: if Stats API is unavailable or a fixture cannot be matched, the API-Football data remains usable.

The `STATS_API_KEY` is server-side only and is never sent to the browser. Missing data is never invented.

## Board stability

Every successful refresh is stored in `prediction_snapshots` in Supabase. If API-Football temporarily fails, `/api/refresh` returns the last known good snapshot instead of an empty board.
