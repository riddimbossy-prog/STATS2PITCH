import assert from 'node:assert/strict';
import { test } from 'node:test';
import { picksToLegs } from './book';
import { selectionFor } from './markets';
import { parseSportyPost, parseSportyShare } from './parse';

test('a SportyBet event id books without a name lookup', () => {
  const mapped = picksToLegs(
    [
      {
        id: 'p1',
        matchId: 'sr:match:100',
        eventId: 'sr:match:100',
        market: 'over_2_5',
        side: 'match',
        label: 'Over 2.5',
        home: 'Arsenal',
        away: 'Chelsea',
        kickoff: 1,
        odds: 1.72,
      },
    ],
    [],
  );
  assert.equal(mapped.missed.length, 0);
  assert.equal(mapped.legs[0]?.eventId, 'sr:match:100');
  assert.equal(mapped.legs[0]?.marketId, '18');
  assert.equal(mapped.legs[0]?.outcomeId, '12');
  assert.equal(mapped.legs[0]?.specifier, 'total=2.5');
});

test('selection mapping covers the app markets', () => {
  assert.equal(selectionFor('btts', 'match')?.outcomeId, '74');
  assert.equal(selectionFor('draw', 'match')?.marketId, '1');
  assert.equal(selectionFor('team_win', 'home')?.outcomeId, '1');
  assert.equal(selectionFor('team_win', 'away')?.outcomeId, '3');
  assert.equal(selectionFor('under_2_5', 'match')?.outcomeId, '13');
});

test('parses a SportyBet share post and the code read-back', () => {
  assert.equal(parseSportyPost({ bizCode: 10000, data: { shareCode: 'ABC123' } }).code, 'ABC123');
  assert.match(parseSportyPost({ bizCode: 19000, message: 'unavailable' }).reason ?? '', /unavailable/);
  const share = parseSportyShare({
    data: {
      shareCode: 'ABC123',
      outcomes: [
        {
          eventId: 'sr:match:100',
          homeTeamName: 'Arsenal',
          awayTeamName: 'Chelsea',
          markets: [{ id: '18', specifier: 'total=2.5', outcomes: [{ id: '12', odds: '1.80', desc: 'Over 2.5' }] }],
        },
      ],
    },
  });
  assert.equal(share.code, 'ABC123');
  assert.equal(share.legs[0]?.eventId, 'sr:match:100');
  assert.equal(share.totalOdds, 1.8);
});
