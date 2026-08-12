# Stats2Pitch 2.2 — GitHub + Supabase Architecture

Stats2Pitch keeps the strict HOME/AWAY Form Table engine and runs without Render.

## Production stack

- **GitHub Pages** hosts the HTML/CSS/JS/PWA and brand assets from `public/`.
- **GitHub Actions** runs the prediction engine on a schedule and stores snapshots in Supabase.
- **Supabase Auth** handles email/password sessions.
- **Supabase PostgreSQL** stores `prediction_snapshots`.
- **Supabase Edge Functions** provide authenticated board access, live scores and the Elite machine feed.
- **Render is not part of the production architecture.**

The browser never receives the Supabase service-role key or football-provider keys.

## Engine source of truth

- HOME team calculations come only from the HOME Form Table.
- AWAY team calculations come only from the AWAY Form Table.
- The Form Table sample is the most recent 5 finished league matches at the relevant venue.
- PPG is calculated directly from that Form Table: `(wins × 3 + draws) / 5`.
- Form Table position is ranked by PPG, then goal difference per game, goals scored per game, win rate and points/tiebreakers.
- Normal standings are metadata for competition/group membership only.
- There is no Last-10 or normal-season fallback in engine calculations.

## Market safety

- Team-result markets are Top-3-only in the relevant HOME/AWAY Form Table.
- HIGH contradiction removes team results.
- Straight wins normally require a 60%+ Form Table win rate, subject to the existing last-place/heavy-concede exception from the same split table.
- Goal markets require matching HOME/AWAY Form Table hit rates and attack/defence confirmation.
- GG requires both Form Table BTTS rates >=60%, both teams scoring and conceding at least 1.0 per game, and is vetoed by strong FTS/clean-sheet opposition.
- Every published market requires a coherent bookmaker price.
- Best Picks contains one strongest market per fixture.

## Existing Supabase table

Run `supabase/schema.sql` if the project has not already been initialized. The migration keeps the existing `prediction_snapshots` table, so no replacement database is required.

## GitHub secrets required

Add these in **Repository Settings → Secrets and variables → Actions → Secrets**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `API_FOOTBALL_KEY`
- `STATS_API_KEY` only if the optional TheStatsAPI odds fallback is used
- `STATS2PITCH_ELITE_FEED_TOKEN` only if the machine Elite feed is used

Optional tuning values such as `APP_TIMEZONE`, `AUTO_REFRESH_TTL_MINUTES`, `MAX_FIXTURES_PER_REFRESH`, `REFRESH_CONCURRENCY` and `BOARD_DAYS_FORWARD` belong in GitHub **Actions variables**.

## Workflows

- `.github/workflows/pages.yml` deploys the static site to GitHub Pages and injects the public Supabase URL/anon key into `runtime-config.js` during deployment.
- `.github/workflows/refresh-board.yml` checks the saved snapshot every 30 minutes and runs the engine only when the snapshot is older than the configured TTL. It can also be run manually for any `YYYY-MM-DD` date.
- `.github/workflows/supabase-functions.yml` deploys both Stats2Pitch Edge Functions, syncs API secrets and pins browser CORS to `https://www.stats2pitch.com`.

## Domain

The canonical production domain is `https://www.stats2pitch.com` and `public/CNAME` matches it. GitHub Pages HTTPS covers both `www.stats2pitch.com` and `stats2pitch.com`, with HTTPS enforcement enabled.

The Render service definition has been removed from the repository. After this cleanup is merged and production checks are green, the old Stats2Pitch service can be deleted from the Render dashboard.

## Local checks

```bash
npm ci
npm run check
```

The Node files under `server/` are engine/worker modules used by GitHub Actions and local checks; they are not the production web host.
