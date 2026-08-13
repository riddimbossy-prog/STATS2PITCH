STATS2PITCH — MARKET SANITIZER + DETAILS UI FIX

Replace:
- server/engine.js
- public/dialogs.js

Fixes:
- Match totals allowed only from 0.5 to 6.5
- First-half totals allowed only from 0.5 to 3.5
- Team totals allowed only from 0.5 to 4.5
- Weird misclassified totals such as 11.5 are rejected
- Keeps odds range 1.20–1.55
- Keeps strict Home >=80% AND Away >=80%
- Details popup now shows Engine rating, Home support, Away support
- Removes old Independent families / Contradiction display

GitHub Desktop:
1. Extract ZIP.
2. Copy the server and public folders into your STATS2PITCH repo.
3. Replace the two files above.
4. Commit and Push origin.
5. Run the board refresh workflow.
