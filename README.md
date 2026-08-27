# Stats2Pitch

Generator for Stats2Pitch boards and sporty.codes Elite.

## Boards

- **All Picks** — consensus engine (`stats2pitch-consensus-v4-over25`). Last-5 home/away form comes from SportyBet / Sportradar stats.
- **VAR Tips** — dedicated board (`away-fav-streak-v1`) for home and away favourites. This is the feed for sporty.codes Elite.
- **Goals Bankers** — one pick per match from favourite win, favourite 2+, Over 2.5 or GG (`goals-bankers-v1`). Does not feed Elite.

Public pages show fixture, teams, logos, league, kickoff, market, pick and odds. Engine method is not published on the site.

## Cache behavior

Supabase snapshots load only when `engineVersion` equals `stats2pitch-v5-var-tips`. A version change does not merge leftover picks from an older engine into the new All Picks or VAR Tips boards.

Required secrets:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STATS2PITCH_ELITE_FEED_TOKEN (Sporty Elite export)

Odds, fixtures, last-5 form, H2H and league tables are read from SportyBet Ghana (`factsCenter` + Sportradar stats). No API-Football key is used.

Run `npm run check` before pushing. Goals Bankers appear after the next board refresh. The snapshot version is unchanged, so live All Picks, VAR Tips, Filter Tips and Elite keep loading.
