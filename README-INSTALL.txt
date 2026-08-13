STATS2PITCH — ALL MARKETS CONSENSUS ENGINE v2

WHAT THIS PATCH DOES
- Odds gate: 1.20 through 1.55 inclusive.
- Consensus gate: BOTH teams must individually be >= 80% on the exact translated market.
- Uses HOME team's last 5 HOME matches and AWAY team's last 5 AWAY matches.
- Iterates the real marketOdds produced by Stats2Pitch instead of hard-coding only O/U and BTTS.
- One strongest qualifying selection per fixture is used for Best Picks.
- Old-engine settled picks are blocked from carrying forward after you run the included cache patch.

SUPPORTED EXACT TRANSLATIONS
- Full-time 1X2
- Double chance
- Draw no bet (interpreted as non-loss / non-win because draws void)
- Both Teams To Score YES and NO
- Match total goals (any numeric O/U line supplied by the provider)
- First-half 1X2
- First-half total goals (any numeric O/U line)
- Home team total goals (any numeric O/U line)
- Away team total goals (any numeric O/U line)
- Generic team-goal totals when the outcome explicitly identifies Home or Away

SAFETY RULE
Provider-specific markets that cannot be translated exactly from historical fixture scores are SKIPPED.
The engine never invents an 80% statistic.

INSTALL WITH GITHUB DESKTOP
1. Extract this ZIP.
2. Copy the "server" folder into the root of your existing STATS2PITCH repo and allow it to replace:
   - server/engine.js
   - server/engineConfig.js
   - server/splitEngine.js
3. Copy patch-refresh-cache.mjs into the repo root.
4. Open PowerShell/Terminal inside the repo and run:
      node patch-refresh-cache.mjs
5. Run:
      npm run check
6. In GitHub Desktop, review changes, commit, and Push origin.
7. Run your Stats2Pitch board refresh workflow so snapshots are regenerated.

IMPORTANT
This build uses the market names already recognized by your existing server/oddsV2.js.
It does not fake unsupported provider markets. Adding more exact markets later only requires adding
another mathematically valid translator in consensusFor().
