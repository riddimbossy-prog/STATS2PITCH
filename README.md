# Stats2Pitch 2.1 — HOME/AWAY Form Table Engine

Stats2Pitch uses one canonical football profile source: the recent venue Form Table.

## Engine source of truth

- HOME team calculations come only from the HOME Form Table.
- AWAY team calculations come only from the AWAY Form Table.
- The Form Table sample is the most recent 5 finished league matches at the relevant venue.
- PPG is calculated directly from that Form Table: `(wins × 3 + draws) / 5`.
- Form Table position is ranked by PPG, then goal difference per game, goals scored per game, win rate and points/tiebreakers.
- The relevant group Form Table must be complete before it can produce engine calculations. Stats2Pitch does not substitute normal-table numbers when the Form Table is incomplete.
- API-Football normal standings are used only to identify competition/group membership. Normal-table rank, PPG, W/D/L, goals and form are never used as prediction inputs.

That same HOME/AWAY Form Table now supplies all football calculations used by the engine:

- PPG and Top-3 / Bottom-3 position;
- wins, losses and result safety;
- goals scored and conceded per game;
- Over/Under 1.5, 2.5 and 3.5 hit rates;
- BTTS/GG rate;
- failed-to-score rate;
- clean-sheet rate;
- opponent-strength and opponent-weakness signals;
- contradiction checks;
- Win/DNB/DC eligibility;
- goal-market and GG confirmation.

There is no Last-10 or normal-season fallback in engine calculations.

## Market safety

- Team-result markets are Top-3-only in the relevant HOME/AWAY Form Table. Position 4+ can never be rescued by Win/DNB/DC.
- HIGH contradiction removes team results. MODERATE can use a safer market only when the original win odd is above 2.00 and a coherent DNB/DC price exists.
- Straight wins normally require a 60%+ Form Table win rate, with the existing last-place/heavy-concede opponent exceptions evaluated from the same Form Table.
- Goal markets require both HOME/AWAY Form Table hit rates >=60% plus matching Form Table attack/defence confirmation.
- GG requires both Form Table BTTS rates >=60%, both teams scoring and conceding at least 1.0 per game, and is vetoed by FTS >=40% or clean sheets >=60%.
- Every published market requires a real coherent bookmaker price.
- Best Picks contains one strongest market per fixture.

## Stack

- Node 22, no runtime npm dependencies.
- API-Football primary football source.
- TheStatsAPI optional odds fallback.
- Supabase email/password auth and snapshot storage.
- Render deployment via `render.yaml`.

## Setup

1. Run `supabase/schema.sql` once in Supabase SQL Editor.
2. Set Render environment variables from `.env.example`.
3. Disable Supabase email confirmation if immediate account access is desired.
4. Deploy the repository.

Health check: `/api/health`
