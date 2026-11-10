import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOAL_HOLD_MS, stepScore } from './var-hold';

test('the first SportyBet score is accepted without a VAR check', () => {
  const step = stepScore(undefined, { home: 1, away: 0 }, 1_000);
  assert.equal(step.varPending, false);
  assert.deepEqual(step.state.confirmed, { home: 1, away: 0 });
  assert.equal(step.incidents.length, 0);
});

test('a new goal is held as VAR until the score sticks', () => {
  const first = stepScore(undefined, { home: 1, away: 0 }, 1_000);
  const held = stepScore(first.state, { home: 2, away: 0 }, 1_000 + 5_000);
  assert.equal(held.varPending, true);
  assert.deepEqual(held.state.confirmed, { home: 1, away: 0 });
  assert.equal(held.incidents[0]?.type, 'var');
  const confirmed = stepScore(held.state, { home: 2, away: 0 }, 1_000 + 5_000 + GOAL_HOLD_MS);
  assert.equal(confirmed.varPending, false);
  assert.deepEqual(confirmed.state.confirmed, { home: 2, away: 0 });
  assert.equal(confirmed.incidents[0]?.type, 'goal');
});

test('a reversed score disallows the VAR check', () => {
  const first = stepScore(undefined, { home: 1, away: 0 }, 1_000);
  const held = stepScore(first.state, { home: 2, away: 0 }, 2_000);
  const reversed = stepScore(held.state, { home: 1, away: 0 }, 3_000);
  assert.equal(reversed.varPending, false);
  assert.equal(reversed.incidents[0]?.varState, 'disallowed');
  assert.deepEqual(reversed.state.confirmed, { home: 1, away: 0 });
});
