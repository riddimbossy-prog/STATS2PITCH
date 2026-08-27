STATS2PITCH v4 — FULL PRODUCT BUILD
==================================

PUBLIC PAGES
- /                 All Picks
- /filter-tips.html Filter Tips
- /var-tips.html    VAR Tips
- /results.html     Daily proof + 30-day performance
- /admin.html       Private admin screen (not linked publicly)

WHAT V4 ADDS
1. Kickoff order: every board is earliest kickoff to latest kickoff.
2. Match status: Upcoming / Live / Settled filters, live score and minute, final result.
3. Country / League / Market filters plus clickable country flag shortcuts.
4. League line is flag + league name only. Country names are kept in filters.
5. Bankers page: requires Home 100% + Away 100% AND the final safety checks.
6. Straight-win banker safety: a venue split-table position must be available and the selected team cannot be bottom three.
7. Plain-English "Why this tip?" popup using the actual last-five home/away support.
8. Original-pick preservation: once a pick/odd is first published for a fixture it is kept in the daily snapshot and is not silently replaced by a later refresh.
9. Automatic settlement for Match Winner, Double Chance, Draw No Bet, BTTS, full-match goals, team goals and supported first-half markets.
10. Results page: Picks / Won / Lost / Void / Success %, with breakdown by Market, Country, League and Confidence.
11. Today dashboard: Total Picks / Upcoming / Live / Settled / Bankers.
12. Learning layer: waits for meaningful settled samples, then can require 100% agreement or temporarily hold historically weak country+league+market profiles.
13. PWA: install prompt, Stats2Pitch icon, offline shell, cache cleanup and mobile bottom navigation.
14. Mobile / tablet / Galaxy Z Fold breakpoints are included.
15. Private admin: data health, raw home/away support, learning profiles and optional manual GitHub Actions refresh.

DEPLOYMENT
- The existing GitHub Pages workflow publishes public/**.
- The Supabase Functions workflow deploys stats2pitch-api and stats2pitch-auth.
- The Refresh Boards workflow creates boards and then settles published picks.
- Existing prediction_snapshots storage is reused; no new database migration is required for v4.

OPTIONAL ADMIN SECRETS
- STATS2PITCH_ADMIN_EMAILS: comma-separated admin email address(es), OR set app_metadata.role=admin in Supabase Auth.
- STATS2PITCH_GITHUB_TOKEN: fine-grained GitHub token with Actions write access if you want the admin "Run board refresh" button.

AUTOMATIC REFRESH STILL WORKS WITHOUT THE OPTIONAL GITHUB TOKEN.

V4.0.2 STRICT TIER RULE
- Home home-split tier is compared with away away-split tier.
- Tiers are quartiles: A top 25%, B next 25%, C next 25%, D bottom 25%.
- Same-tier fixtures are rejected before any market is evaluated and never enter the public board.
- If either tier cannot be verified, the fixture is also skipped.
