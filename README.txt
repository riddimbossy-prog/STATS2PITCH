STATS2PITCH — MARKET LABEL UI FIX

Problem:
The engine stores marketName correctly, but the main board only displayed selection.
So a First-half goals pick appeared as:
  Over 0.5
instead of:
  1H · Over 0.5

This patch updates public/boardView.js to display market context.

Examples after patch:
- First-half goals -> 1H · Over 0.5
- First-half winner -> 1H Result · Home
- Home team goals -> Home Team · Over 0.5
- Away team goals -> Away Team · Over 0.5
- BTTS -> BTTS · Yes
- Double chance -> Double Chance · Home or draw
- DNB -> DNB · Home
- 1X2 -> 1X2 · Home
- Normal full-time totals remain Over/Under X.X

INSTALL:
1. Extract this ZIP into your STATS2PITCH repo root.
2. Open PowerShell/Terminal in the repo.
3. Run:
   node patch-board-labels.mjs
4. Run:
   npm run check
5. Commit and Push with GitHub Desktop.
6. Refresh the site.

Only the board label display changes. Engine odds and 80/80 logic are untouched.
