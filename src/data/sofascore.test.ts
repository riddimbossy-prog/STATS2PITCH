import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSofascoreSource, fractionalToDecimal, mapEvent, mapIncidents, mapOdds, mapTeamResults, memoryCache } from './sofascore';

test('fractional prices become decimal odds', () => {
  assert.equal(fractionalToDecimal('6/4'), 2.5);
  assert.equal(fractionalToDecimal('1/2'), 1.5);
  assert.equal(fractionalToDecimal('even'), null);
});

test('scheduled events, incidents and odds map into the app model', () => {
  const match = mapEvent({
    event: {
      id: 42,
      startTimestamp: 1_700_000_000,
      status: { type: 'inprogress', description: '2nd half' },
      homeTeam: { id: 7, name: 'Arsenal', nameCode: 'ARS' },
      awayTeam: { id: 9, name: 'Chelsea', nameCode: 'CHE' },
      homeScore: { current: 1 },
      awayScore: { current: 0 },
      tournament: {
        name: 'Premier League',
        uniqueTournament: { id: 17, name: 'Premier League' },
        category: { id: 1, name: 'England' },
      },
    },
  });
  assert.equal(match?.id, '42');
  assert.equal(match?.status, 'live');
  assert.equal(match?.home.name, 'Arsenal');
  assert.equal(match?.competition.name, 'Premier League');
  assert.equal(match?.league.name, 'England');
  assert.equal(match?.kickoff, 1_700_000_000_000);
  assert.deepEqual(match?.feedScore, { home: 1, away: 0 });

  const incidents = mapIncidents({
    incidents: [
      { id: 1, incidentType: 'goal', time: 12, isHome: true, player: { name: 'Saka' }, incidentClass: 'regular' },
      { id: 2, incidentType: 'varDecision', time: 70, isHome: false, incidentClass: 'goalAwarded', confirmed: false },
    ],
  });
  assert.equal(incidents[0]?.type, 'goal');
  assert.equal(incidents[0]?.confirmed, true);
  assert.equal(incidents[1]?.type, 'var');
  assert.equal(incidents[1]?.varState, 'pending');

  const odds = mapOdds({
    markets: [
      {
        marketName: 'Match goals',
        choices: [
          { name: 'Over 2.5', fractionalValue: '4/5' },
          { name: 'Under 2.5', decimalValue: 2.05 },
        ],
      },
      {
        marketName: 'Full time',
        choices: [
          { name: '1', fractionalValue: '4/6' },
          { name: 'X', fractionalValue: '5/2' },
          { name: '2', fractionalValue: '4/1' },
        ],
      },
    ],
  });
  assert.equal(odds.over_2_5, 1.8);
  assert.equal(odds.under_2_5, 2.05);
  assert.equal(odds['home:team_win'], 1.67);
  assert.equal(odds.draw, 3.5);
});

test('team history is the team perspective, newest finished match first', () => {
  const rows = mapTeamResults(
    {
      events: [
        {
          id: 1,
          startTimestamp: 10,
          status: { type: 'finished' },
          homeTeam: { id: 7 },
          awayTeam: { id: 3 },
          homeScore: { current: 2 },
          awayScore: { current: 0 },
        },
        {
          id: 2,
          startTimestamp: 20,
          status: { type: 'finished' },
          homeTeam: { id: 4 },
          awayTeam: { id: 7 },
          homeScore: { current: 1 },
          awayScore: { current: 1 },
        },
        {
          id: 3,
          startTimestamp: 30,
          status: { type: 'inprogress' },
          homeTeam: { id: 7 },
          awayTeam: { id: 8 },
          homeScore: { current: 3 },
          awayScore: { current: 0 },
        },
      ],
    },
    '7',
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { goalsFor: 1, goalsAgainst: 1, venue: 'away' });
  assert.deepEqual(rows[1], { goalsFor: 2, goalsAgainst: 0, venue: 'home' });
});

test('a failed read returns the cached board instead of throwing', async () => {
  const cache = memoryCache();
  let calls = 0;
  const source = createSofascoreSource({
    cache,
    gapMs: 0,
    baseUrl: 'https://api.sofascore.com/api/v1',
    fetchJson: async (url) => {
      calls += 1;
      if (calls === 1) {
        assert.match(url, /scheduled-events\/2026-11-09$/);
        return { events: [{ id: 5, startTimestamp: 10, status: { type: 'notstarted' }, homeTeam: { id: 1, name: 'A' }, awayTeam: { id: 2, name: 'B' } }] };
      }
      throw new Error('Sofascore refused the request (403). The unofficial feed sometimes blocks a network.');
    },
  });
  const first = await source.scheduled('2026-11-09');
  assert.equal(first.ok, true);
  assert.equal(first.data?.[0]?.home.name, 'A');
  const second = await source.scheduled('2026-11-09', true);
  assert.equal(second.ok, false);
  assert.equal(second.stale, true);
  assert.equal(second.data?.[0]?.id, '5');
});
