# Stats2Pitch

Generator for Stats2Pitch boards and sporty.codes Elite.

## Boards

- **All Picks** — consensus engine (`stats2pitch-consensus-v4-over25`). Last-5 home/away form comes from SportyBet / Sportradar stats.
- **Filter Tips** — Perfect Split (`perfect-split-v1`). Last-5 venue form: a market publishes only when both sides post a 5/5 split. Successor to sporty-filter-v2. Does not feed Elite.
- **VAR Tips** — dedicated board (`away-fav-streak-v1`) for home and away favourites. This is the feed for sporty.codes Elite.
- **Goals Bankers** — V5 team-goal ladder (`goals-bankers-v5.4`). One pick per match from team 2+, Over 2.5 or GG. At least one team must sit in the overall Top 5. Skip is a valid result. Does not feed Elite.
- **Combo** — SportyBet Combo OR markets (`combo-v3.3-best-two`). Best two qualifying markets per match after hard odds gates. A match with only one survivor publishes that one option. Does not feed Elite.

Public pages show fixture, teams, logos, league, kickoff, market, pick and odds. Engine method is not published on the site.

## Refresh

Boards refresh automatically every three hours, plus a 04:07 Accra run. Each run fills the public date strip (today through six days ahead, and the past six days) so upcoming dates already have picks.
