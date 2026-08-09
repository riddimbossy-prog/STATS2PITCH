# Modular Football Agent

A private, login-gated football prediction website using:

- **GitHub** — source control
- **Render** — Node web service (zero runtime packages)
- **Supabase** — authentication + persistent prediction snapshots
- **API-Football / API-Sports v3** — real fixtures, standings, recent results and odds

## What is already built

- Login-only Supabase email/password access via Auth REST (no public signup form)
- Supabase GitHub OAuth login
- Entire dashboard protected by Supabase JWT verification on the Render server
- Real fixtures for the selected date from API-Football
- League positions and PPG from standings
- Last-5 win/loss rates
- Season goals scored/conceded per-game averages from standings
- O/U 1.5, 2.5 and 3.5 hit rates derived from each team’s last 10 completed matches
- Real 1X2 and draw odds where API-Football returns them
- Modular Single / 2 / 3+ classification
- Opponent-weakness logic
- Contradiction grading
- Priority prediction list
- Responsive desktop/tablet/mobile UI
- Supabase snapshot persistence and last-known-good fallback

## 1. Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Authentication > Providers**, enable Email. Enable GitHub if you want the GitHub login button to work.
4. For a private site, disable public new-user signup after creating your authorized accounts.
5. Copy:
   - Project URL
   - anon public key
   - service role key

### Optional GitHub OAuth

In Supabase Authentication > Providers > GitHub, configure your GitHub OAuth App. Add your final Render domain to Supabase Auth URL configuration / redirect URLs.

## 2. Local test

Set the environment variables, then run:

```bash
npm install
npm run check
npm start
```

App: http://localhost:3000

## 3. GitHub

Create a new empty GitHub repository and push this whole folder.

Using GitHub Desktop:

1. File > Add local repository
2. Select this folder
3. Publish repository

Do **not** commit `.env`.

## 4. Render

The repo includes `render.yaml`.

1. Render > New > Blueprint
2. Select the GitHub repository
3. Add the secret environment values requested by the Blueprint
4. Deploy

Required values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEY`

## 5. API-Football usage

The server calls API-Sports v3 endpoints for:

- `/fixtures`
- `/standings`
- `/fixtures?team=...&last=10`
- `/odds?fixture=...`

The server caches responses in memory to reduce calls. `MAX_FIXTURES_PER_REFRESH` defaults to 60 to avoid uncontrolled API consumption.

If your API plan does not provide odds for a competition, the fixture can still be analyzed statistically, but the UI displays a dash for missing odds. No odds are invented.

## Persistence / board stability

Every successful refresh is written to `prediction_snapshots` in Supabase. If API-Football temporarily fails, `/api/refresh` returns the last known good snapshot rather than an empty board. This protects predictions from appearing briefly and then disappearing on reload.

## Important production hardening

- Disable public signups in Supabase if this site is for invited users only.
- Or add an allowlist table / admin role before launch.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `API_FOOTBALL_KEY` only on Render.

## Next useful additions

- Admin-only refresh permission
- Scheduled Render Cron refresh
- Settlement engine after FT
- Accuracy history by filter combination, league and market
- Team crests and country flags
- Date selector and multi-day board
- Confidence/market/league filters
