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

### Optional GitHub login

If you want the **Continue with GitHub** button:

1. Supabase → Authentication → Providers → GitHub.
2. Enable GitHub and configure its OAuth credentials.
3. Use the callback URL Supabase shows for the GitHub provider.
4. After Render deploys, add the Render URL and then `https://stats2pitch.com` to Supabase Auth URL Configuration / Redirect URLs.
5. Keep Render `ENABLE_GITHUB_LOGIN=true`.

If you do not want GitHub OAuth, set `ENABLE_GITHUB_LOGIN=false`.

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
5. Keep `API_FOOTBALL_BASE=https://v3.football.api-sports.io` unless your provider says otherwise.
6. Deploy.
7. Open `/api/health` on the Render domain. It should return JSON with `"ok": true`.
8. Open the main site and use **Create account** or **Sign in**.

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
6. Loads real 1X2 odds where API-Football provides them.
7. Runs the modular filters and contradiction checks.
8. Separates Single / 2 / 3+ filter matches.
9. Stores the board in Supabase.
10. If a later refresh fails, keeps the last good board instead of clearing it.

## 6. API limits

`MAX_FIXTURES_PER_REFRESH` defaults to `60`. Reduce it if your API plan has a lower request allowance. Identical API requests are cached for `CACHE_TTL_SECONDS` (default `900`).
