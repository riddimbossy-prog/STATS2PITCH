# Stats2Pitch

Generator for Stats2Pitch boards and sporty.codes Elite.

## Boards

- **All Picks** — consensus engine (`stats2pitch-consensus-v4-over25`).
- **VAR Tips** — dedicated board (`away-fav-streak-v1`) for home and away favourites. This is the feed for sporty.codes Elite.
- **Bankers** — split-form banker rules on `/bankers.html`. Bankers do not feed Elite.

Public pages show fixture, teams, logos, league, kickoff, market, pick and odds. Engine method is not published on the site.

## Cache behavior

Supabase snapshots load only when `engineVersion` equals `stats2pitch-v5-var-tips`. A version change does not merge leftover picks from an older engine into the new All Picks or VAR Tips boards.

Required secrets:
- API_FOOTBALL_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STATS2PITCH_ELITE_FEED_TOKEN (Sporty Elite export)

Recommended:
- STATS_API_KEY
- STATS_API_BASE_URL

Run `npm run check` before pushing. After this version bump, run a board refresh so live All Picks, VAR Tips and Elite are not empty.
