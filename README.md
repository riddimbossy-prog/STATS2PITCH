# Stats2Pitch

Generator for Stats2Pitch boards and sporty.codes Elite.

## Boards

- **All Picks** — consensus engine (`stats2pitch-consensus-v4-over25`). Last-5 home/away form comes from SportyBet / Sportradar stats.
- **VAR Tips** — dedicated board (`away-fav-streak-v1`) for home and away favourites. This is the feed for sporty.codes Elite.
- **Goals Bankers** — V4 team-capability + bookmaker router. One pick per match from favourite win, favourite 2+, Over 2.5 or GG (`goals-bankers-v4`). Skip is a valid result. Does not feed Elite.

Public pages show fixture, teams, logos, league, kickoff, market, pick and odds. Engine method is not published on the site.

## Refresh

Boards refresh automatically every three hours, plus a 04:07 Accra run. Each run fills the public date strip (today through six days ahead, and the past six days) so upcoming dates already have picks.
