# Deployment — GitHub + Render + Supabase

## A. Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run `supabase/schema.sql`.
4. Open **Authentication** and enable Email/Password.
5. Create the users who should be allowed into the site.
6. For a private login-only site, disable public new-user signup.
7. Optional: enable the GitHub provider if you want **Continue with GitHub**.
8. Copy these values from project settings:
   - Project URL
   - anon/public key
   - service role key

### GitHub OAuth callback

When configuring the GitHub provider, use the callback URL shown by Supabase for that provider. After Render deploys the site, add the Render site URL to the Supabase Auth site/redirect URL settings so the OAuth flow can return to the website.

## B. GitHub

1. Extract this ZIP.
2. Open **GitHub Desktop**.
3. **File > Add local repository** and choose the extracted folder.
4. If GitHub Desktop says it is not a repository, choose **create a repository here**.
5. Commit all files.
6. Publish the repository to GitHub.
7. Keep `.env` private. It is already in `.gitignore`.

## C. Render

1. In Render, create a new **Blueprint** from your GitHub repo. `render.yaml` is already included.
2. Enter these secret environment values when Render asks:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `API_FOOTBALL_KEY`
3. Keep `API_FOOTBALL_BASE=https://v3.football.api-sports.io` unless your provider requires a different endpoint.
4. Deploy.
5. Open `/api/health` on your Render domain. It should return `{ "ok": true, ... }`.
6. Open the main site and sign in with a Supabase user.
7. Choose a date and press **Refresh real data**.

## D. What a successful refresh does

1. Downloads the selected date's real fixtures.
2. Loads league standings.
3. Calculates position, season PPG, season goals scored/game and conceded/game.
4. Downloads each team's recent completed matches.
5. Calculates Last-5 win/loss form and Last-10 O/U hit rates.
6. Loads real 1X2 odds where available from API-Football.
7. Runs the modular filters and contradiction checks.
8. Separates Single / 2 / 3+ filters.
9. Stores the full board snapshot in Supabase.
10. If a later refresh fails, returns the last good Supabase snapshot instead of clearing the board.

## E. API limits

`MAX_FIXTURES_PER_REFRESH` defaults to `60`. Reduce this if your API plan has a small daily request allowance. The server also caches identical API requests in memory for `CACHE_TTL_SECONDS` (default 900 seconds).
