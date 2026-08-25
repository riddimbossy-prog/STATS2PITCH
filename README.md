# Stats2Pitch Away-Fav Streak Engine

This repository is the live generator for sporty.codes Elite Picks.

## Only one Elite rule

The previous consensus Elite path is gone. Elite now uses **Away-Fav Streak v1** only.

1. Universe: published Goals Streak 2+ **Yes** priced **1.10–1.49**. Favourite is always the **away** team. Missing streak odds fail closed — there is no proxy.
2. Required published odds: streak Yes, away team goals Over 0.5, away team goals Over 1.5, home team goals Over 0.5.
3. Skip: both teams top 5, both teams bottom 3, early-season venue samples under 5, similar split form (PPG, GF and GA all close).
4. First match wins:
   - both Over 0.5 **< 1.30** → **BTTS Yes**
   - away Over 1.5 **< 1.50** and home Over 0.5 **> 1.60** and away 1X2 **≤ 1.55** → **Away win**
   - away Over 1.5 **< 1.50** and home Over 0.5 **> 1.60** → **Away team goals Over 1.5**
   - away Over 1.5 **< 1.50** and home Over 0.5 **≤ 1.60** → **Total Over 1.5**
5. Never home-favourite Over 2.5. Never BTTS for a home favourite. One pick per fixture. Max 10 per day.
6. Strong ≥ 78, Supported ≥ 64, anything lower is dropped.

Bankers stay on their own page and do not feed Elite.

## Odds verification

API-Football is the primary feed. When TheStatsAPI is configured, matching selections are compared. Goals Streak 2+ must be published by the provider. If that market is absent, the fixture is skipped.

## Clean cache behavior

Supabase snapshots are loaded only when `engineVersion` equals `away-fav-streak-v1`. Older consensus snapshots are ignored. A version change does not merge leftover consensus picks into the new board.

Required secrets:
- API_FOOTBALL_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STATS2PITCH_ELITE_FEED_TOKEN (Sporty Elite export)

Recommended:
- STATS_API_KEY
- STATS_API_BASE_URL

Run `npm run check` before pushing.
