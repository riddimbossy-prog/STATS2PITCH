# Stats2Pitch.com — GitHub + Render + Supabase Setup

## 1. Supabase: create the project

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run `supabase/schema.sql`.
4. Open **Authentication → Providers → Email**.
5. Enable Email/Password authentication.
6. Turn **Confirm email / Email confirmations OFF**. This is the key setting that lets users create an account and log in immediately without verifying an email address.
7. If you want users to register themselves, keep Supabase new-user signup enabled and leave Render `ALLOW_PUBLIC_SIGNUP=true`.
8. If you want only admin-created/invited users, set Render `ALLOW_PUBLIC_SIGNUP=false`.
9. Copy your project URL, anon/public key and service-role key.


## 2. GitHub

1. Extract the Stats2Pitch ZIP.
2. Open GitHub Desktop.
3. **File → Add local repository** and choose the extracted folder.
4. If needed, choose **Create a repository here**.
5. Name it `stats2pitch` (recommended).
6. Commit all files.
7. Publish to GitHub.
8. Do not commit `.env`.

## 3. Render

1. Render → **New → Blueprint**.
2. Select the Stats2Pitch GitHub repository.
3. `render.yaml` creates the `stats2pitch` web service.
4. Add these secret values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `API_FOOTBALL_KEY`
   - `STATS_API_KEY`
5. Keep `API_FOOTBALL_BASE=https://v3.football.api-sports.io`.
6. Keep `STATS_API_BASE_URL=https://api.thestatsapi.com/api`.
7. Deploy.
8. Open `/api/health` on the Render domain. It should return JSON with `"ok": true` and version `1.4.0`.
9. Open the main site and use **Create account** or **Sign in**.

### Quick login test with no verification

With Supabase **Confirm email OFF**:

1. Open Stats2Pitch.
2. Click **Create account**.
3. Enter an email and password.
4. Submit.
5. You should enter the prediction board immediately — no verification email step.

If the site says Supabase is still requiring email verification, return to **Authentication → Providers → Email** and turn confirmation off.

## 4. Connect Stats2Pitch.com

After the Render service works on its temporary Render URL:

1. Render service → **Settings → Custom Domains**.
2. Add `stats2pitch.com`.
3. Add `www.stats2pitch.com` if you want the www version too.
4. Render will display the DNS records required at your domain registrar/DNS provider.
5. Add those records exactly.
6. In Supabase Auth URL Configuration, set the Site URL to `https://stats2pitch.com` and include the Render URL as an allowed redirect during migration/testing.

## 5. What a successful football refresh does

1. Downloads the selected date's real fixtures.
2. Loads league standings.
3. Calculates position, season PPG, season goals scored/game and conceded/game.
4. Downloads each team's recent completed matches.
5. Calculates Last-5 win/loss form and Last-10 O/U hit rates.
6. Loads API-Football odds and every available market returned.
7. Uses TheStatsAPI as an additive odds source, matches the same fixture and loads its available markets.
8. Merges the available prices without inventing missing data.
9. Runs the modular filters and consistency checks.
10. Separates one-reason, two-reason and strong multi-reason matches.
11. Stores the board in Supabase.
12. If a later refresh fails, keeps the last good board instead of clearing it.

## 6. Data-service limits

`MAX_FIXTURES_PER_REFRESH` defaults to `60`. Reduce it if your API-Football plan has a lower request allowance. Identical API-Football requests are cached for `CACHE_TTL_SECONDS` (default `900`).

TheStatsAPI defaults to `40` requests per minute and a `300ms` minimum spacing, with a `1800` second value cache. You can tune `STATS_API_REQUESTS_PER_MINUTE`, `STATS_API_MIN_INTERVAL_MS`, `STATS_VALUE_CACHE_TTL_SECONDS`, `STATS_API_COMPETITION_PAGES`, and `STATS_API_MAX_MATCH_PAGES` on Render if your plan needs different limits.


## v1.4.0 UI and login notes

The v1.4.0 build is email/password only and does not contain a GitHub login button. Account creation uses the server-side Supabase Admin endpoint with `email_confirm: true`, so a newly created account can sign in immediately without email verification. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Render.

The board UI intentionally hides provider, API, cache, snapshot and admin information. Users only see football-facing labels, filters, predictions, reasons and available market prices.

After replacing an older frontend, use **Render → Manual Deploy → Clear build cache & deploy**. Then verify `/api/health` reports `1.4.0`.
