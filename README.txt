STATS2PITCH — ALL-MARKET REFRESH GATE FIX

Replace:
  server/refresh.js

What this fixes:
- Stops refresh.js from requiring the old canonical market set before a fixture can be analyzed.
- A fixture is now considered priced when ANY parsed market outcome is between 1.20 and 1.55.
- Stats API fallback now runs when there is no usable 1.20-1.55 market outcome.
- Keeps the strict 80/80 consensus rule unchanged.
- Prevents settled picks from an older engineVersion from being merged back into the new board.

GitHub Desktop:
1. Extract ZIP.
2. Copy the server folder into your STATS2PITCH repo and replace server/refresh.js.
3. In GitHub Desktop, review the single changed file.
4. Commit.
5. Push origin.
6. Run your board refresh workflow.
