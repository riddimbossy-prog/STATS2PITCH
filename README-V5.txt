STATS2PITCH FILTER TIPS V5 — GOAL SAFETY UPDATE
================================================

Purpose
- Tighten Over 1.5 publication so a short bookmaker price cannot override weak goal-production evidence.
- Specifically reduce 1-0 / 0-1 losses where one side is only 60% on the relevant venue split and the supporting U3.5 price is marginal.

V5 RULES
1. O1.5 still has to pass the existing V2 router first.
2. U3.5 must now be at least 1.45 for O1.5 to publish.
3. Strong recent venue support = both teams at least 80% O1.5 over the last five split home/away matches.
4. A 60%-79% side is conditional, not strong. Conditional support requires U3.5 at least 1.50.
5. Both venue samples must contain five completed matches and the published pick must have its validation score/consensus populated.
6. Severe deterioration is a veto when recent venue support falls below 80% of its longer baseline.
7. One-goal trap veto: if the priced favourite scores exactly once in at least 60% of its venue sample, scores 2+ in under 40%, and the opponent blanks in at least 60%, O1.5 is rejected.
8. The public engine id stays sporty-filter-v2 for compatibility, while board metadata and picks expose rulesVersion=v5 and safetyRevision=v5.0-one-goal-trap.

EXAMPLE NOW REJECTED
- Home O1.5 venue support: 60%
- Away O1.5 venue support: 80%
- O1.5: 1.20
- U3.5: 1.42
Result: SKIP (v5-over15-market-confirmation)

Implementation
- server/filterEngineV2.js preserves the previous router unchanged.
- server/filterEngine.js is now the V5 safety overlay used by all existing imports.
- test/filterEngineV5.test.js covers marginal 60/80 rejection, strong 80/80 acceptance, and the 1-0/0-1 trap veto.
