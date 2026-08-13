STATS2PITCH — CROSS-SOURCE ODDS VERIFIER v2

Replace:
  server/oddsPolicy.js
  server/refresh.js

What changes:
- TheStatsAPI is now queried for every mature fixture when configured, not only as a last-resort fallback.
- API-Football and TheStatsAPI are normalized to the same market/selection.
- If both sources have the same selection, the price is accepted only when relative disagreement is <= 15% by default.
- Verified outcomes use the midpoint of both source prices.
- Large source disagreements are dropped instead of reaching the engine.
- If only one source has a market, it is still allowed by default (to preserve coverage) but marked single-source.
- Set ODDS_REQUIRE_CROSS_SOURCE=true if you want to reject every single-source outcome.
- Change ODDS_VERIFY_MAX_RELATIVE_DIFF=0.15 to tune the tolerance.
- Keeps your existing 1.20–1.55 engine odds window and 80/80 split consensus rules.
- Keeps stale old-engine snapshot protection.
- Improves row identity when reconciling settled picks.

Recommended environment:
  ODDS_VERIFY_MAX_RELATIVE_DIFF=0.15
  ODDS_REQUIRE_CROSS_SOURCE=false

For maximum strictness:
  ODDS_REQUIRE_CROSS_SOURCE=true

GitHub Desktop:
1. Extract ZIP.
2. Copy the server folder into the repo root.
3. Replace server/oddsPolicy.js and server/refresh.js.
4. Commit and Push origin.
5. Run board refresh.
