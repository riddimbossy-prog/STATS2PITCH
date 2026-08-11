# Stats2Pitch 2.0 — Simple Engine Reset

This is a clean replacement of the accumulated Stats2Pitch codebase. There are no legacy board renderers, compatibility boot scripts, service-worker cache layers, duplicated safety engines, or historical version wrappers.

## Engine

- Overall league maturity: every team in the standings plus both fixture teams must have at least 4 overall league games.
- HOME team analysis is HOME-only; AWAY team analysis is AWAY-only.
- Split table ranking needs 3 venue matches and ranks by PPG, GD/game, GF/game, win rate, then points/tiebreakers.
- Strict Last-5 venue form needs 5 matches; Last-10 is confirmation only.
- Team-result markets are Top-3-only in the relevant split. Position 4+ can never be rescued by Win/DNB/DC.
- HIGH contradiction removes team results. MODERATE can only use a safer market when original win odds are above 2.00.
- Straight wins require 60%+ split win rate unless the relevant opponent is last with 5+ split games or concedes more than 2.30 per split game.
- Goal markets require both HOME/AWAY hit rates >=60% plus matching attack/defence profile confirmation.
- GG requires both split BTTS rates >=60%, both teams scoring and conceding at least 1.0, and is vetoed by FTS >=40% or clean sheets >=60%.
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
