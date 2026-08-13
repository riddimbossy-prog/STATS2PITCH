STATS2PITCH — PICK DETAILS IDENTITY FIX

Replace:
  public/dialogs.js

Why this fixes the discrepancy:
- The card displays the fixture's published bestPicks row.
- The old modal searched priority first, so it could open a different qualifying selection
  for the same fixture and market.
- The modal now resolves bestPicks first, so the displayed card and details popup stay identical.
- Saved picks now also use fixture + market + selection + odds as the identity.

Install with GitHub Desktop:
1. Extract this ZIP.
2. Copy the public folder into your STATS2PITCH repo.
3. Replace public/dialogs.js.
4. Commit and Push origin.
5. Refresh the site / board.
