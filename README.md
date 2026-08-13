# Stats2Pitch Fresh Engine v3

This repository is a clean replacement for the previous Stats2Pitch engine stack.

## Only one prediction rule

1. Read every supported market from the odds provider.
2. The decimal odd must be **1.20–1.55 inclusive**.
3. Use the home team's **last 5 HOME** matches.
4. Use the away team's **last 5 AWAY** matches.
5. The exact same market event must be supported by **at least 80% for the home profile AND at least 80% for the away profile**.
6. Anything failing either gate is discarded.
7. One strongest qualifying market is shown as the Best Pick for each fixture.

Supported translations include full-time 1X2, double chance, DNB, BTTS Yes/No, match totals, first-half 1X2, first-half totals, and home/away team totals when the provider identifies them exactly.

## Odds verification

API-Football is the primary feed. When TheStatsAPI is configured, matching selections are compared. By default, two prices must be within 15% relative difference to be marked cross-source verified. Set `ODDS_REQUIRE_CROSS_SOURCE=true` to reject every single-source selection.

## Clean cache behavior

Supabase snapshots are loaded only when their `engineVersion` exactly equals `stats2pitch-consensus-v3`. Old engine snapshots are ignored automatically.

## GitHub Desktop replacement

Delete the old repository contents **except the hidden `.git` folder**, then copy everything from this ZIP into the repository folder. Commit all changes and Push origin.

Keep your GitHub repository secrets. They are not stored in this ZIP.

Required secrets:
- API_FOOTBALL_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Recommended:
- STATS_API_KEY
- STATS_API_BASE_URL

Run `npm run check` before pushing.
