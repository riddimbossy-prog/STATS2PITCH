import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDate } from '../format';
import { createSportyBetSource, mapSportyEvents, mapSportyOdds, mapTeamResults, memoryCache, parseSetScore } from './sportybet';
import { GOAL_HOLD_MS } from './var-hold';

const KICK = Date.parse('2026-11-10T18:00:00.000Z');

const UPCOMING = {
  bizCode: 10000,
  data: {
    tournaments: [
      {
        name: 'England',
        tournament: { id: 'sr:tournament:17', name: 'Premier League' },
        category: { id: 'sr:category:1', name: 'England' },
        events: [
          {
            eventId: 'sr:match:100',
            homeTeamId: 'sr:competitor:42',
            awayTeamId: 'sr:competitor:38',
            homeTeamName: 'Arsenal',
            awayTeamName: 'Chelsea',
            estimateStartTime: KICK,
            matchStatus: 'Not start',
            markets: [
              {
                id: '1',
                specifier: '',
                outcomes: [
                  { id: '1', odds: '1.55', desc: 'Home' },
                  { id: '2', odds: '3.80', desc: 'Draw' },
                  { id: '3', odds: '6.40', desc: 'Away' },
                ],
              },
              {
                id: '18',
                specifier: 'total=2.5',
                outcomes: [
                  { id: '12', odds: '1.72', desc: 'Over 2.5' },
                  { id: '13', odds: '2.05', desc: 'Under 2.5' },
                ],
              },
              { id: '29', specifier: '', outcomes: [{ id: '74', odds: '1.80', desc: 'Yes' }] },
            ],
          },
        ],
      },
    ],
  },
};

const LIVE = {
  bizCode: 10000,
  data: {
    tournaments: [
      {
        events: [
          {
            eventId: 'sr:match:200',
            homeTeamId: 'h1',
            awayTeamId: 'a1',
            homeTeamName: 'Inter',
            awayTeamName: 'Milan',
            estimateStartTime: KICK,
            matchStatus: 'H1',
            playedSeconds: '23:10',
            setScore: '1-0',
            sport: { category: { name: 'Italy', tournament: { name: 'Serie A' } } },
          },
        ],
      },
    ],
  },
};

test('parses a SportyBet set score', () => {
  assert.deepEqual(parseSetScore('2-1'), { home: 2, away: 1 });
  assert.deepEqual(parseSetScore('1:0'), { home: 1, away: 0 });
  assert.equal(parseSetScore(''), null);
});

test('maps an upcoming event, its league and its markets', () => {
  const match = mapSportyEvents(UPCOMING)[0];
  assert.ok(match);
  assert.equal(match.id, 'sr:match:100');
  assert.equal(match.status, 'scheduled');
  assert.equal(match.home.name, 'Arsenal');
  assert.equal(match.competition.name, 'Premier League');
  assert.equal(match.odds?.over_2_5, 1.72);
  assert.equal(match.odds?.['home:team_win'], 1.55);
  assert.equal(match.odds?.draw, 3.8);
  assert.equal(mapSportyOdds(UPCOMING.data.tournaments[0]!.events[0]!).btts, 1.8);
});

test('scheduled and live reads use the factsCenter paths and fall back to a stale cache', async () => {
  const calls: string[] = [];
  let failLive = false;
  const source = createSportyBetSource({
    gapMs: 0,
    baseUrl: 'https://www.sportybet.com/api/gh',
    cache: memoryCache(),
    fetchJson: async (url) => {
      calls.push(url);
      if (url.includes('pcUpcomingEvents')) return UPCOMING;
      if (url.includes('liveOrPrematchEvents')) {
        if (failLive) throw new Error('SportyBet refused the request (403). This network is outside Ghana.');
        return LIVE;
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  const day = await source.scheduled(localDate(new Date(KICK)), true);
  assert.equal(day.ok, true);
  assert.equal(day.data?.[0]?.id, 'sr:match:100');
  assert.match(calls[0] ?? '', /factsCenter\/pcUpcomingEvents/);
  const live = await source.live(true);
  assert.equal(live.data?.[0]?.minute, "23'");
  assert.equal(live.data?.[0]?.feedScore?.home, 1);
  assert.equal(live.data?.[0]?.varPending, false);
  failLive = true;
  const stale = await source.live(true);
  assert.equal(stale.ok, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.data?.[0]?.id, 'sr:match:200');
});

test('a new live goal is held, then confirmed when the score sticks', async () => {
  let now = 1_000_000;
  let score = '1-0';
  const source = createSportyBetSource({
    gapMs: 0,
    now: () => now,
    fetchJson: async (url) => {
      if (!url.includes('liveOrPrematchEvents')) throw new Error(url);
      return {
        data: {
          events: [
            {
              eventId: 'sr:match:9',
              homeTeamName: 'A',
              awayTeamName: 'B',
              homeTeamId: 'a',
              awayTeamId: 'b',
              estimateStartTime: KICK,
              matchStatus: 'H2',
              playedSeconds: '70:00',
              setScore: score,
            },
          ],
        },
      };
    },
  });
  const first = await source.live(true);
  assert.equal(first.data?.[0]?.feedScore?.home, 1);
  score = '2-0';
  now += 5_000;
  const held = await source.live(true);
  assert.equal(held.data?.[0]?.varPending, true);
  assert.equal(held.data?.[0]?.feedScore?.home, 1);
  now += GOAL_HOLD_MS;
  const confirmed = await source.live(true);
  assert.equal(confirmed.data?.[0]?.varPending, false);
  assert.equal(confirmed.data?.[0]?.feedScore?.home, 2);
});

test('a VAR-awarded timeline row confirms the new score immediately', async () => {
  let score = '0-0';
  const source = createSportyBetSource({
    gapMs: 0,
    now: () => 5_000,
    fetchJson: async () => ({
      data: {
        events: [
          {
            eventId: 'sr:match:7',
            homeTeamName: 'A',
            awayTeamName: 'B',
            homeTeamId: 'a',
            awayTeamId: 'b',
            matchStatus: 'H1',
            playedSeconds: '12:00',
            setScore: score,
            comments: [{ type: 'var', text: 'VAR confirmed goal', confirmed: true }],
          },
        ],
      },
    }),
  });
  await source.live(true);
  score = '1-0';
  const next = await source.live(true);
  assert.equal(next.data?.[0]?.varPending, false);
  assert.equal(next.data?.[0]?.feedScore?.home, 1);
});

test('event detail maps score, markets and lineups when SportyBet sends them', async () => {
  const source = createSportyBetSource({
    gapMs: 0,
    fetchJson: async (url) => {
      assert.match(url, /factsCenter\/event\?eventId=sr%3Amatch%3A100&productId=3/);
      return {
        data: {
          eventId: 'sr:match:100',
          homeTeamName: 'Arsenal',
          awayTeamName: 'Chelsea',
          homeTeamId: 'sr:competitor:42',
          awayTeamId: 'sr:competitor:38',
          estimateStartTime: KICK,
          matchStatus: 'Ended',
          setScore: '2-1',
          markets: [{ id: '18', specifier: 'total=2.5', outcomes: [{ id: '12', odds: '1.70' }] }],
          homeLineup: { formation: '4-3-3', players: [{ name: 'Saka', id: 'p1' }] },
          awayLineup: { players: ['Palmer'] },
        },
      };
    },
  });
  const detail = await source.match('sr:match:100', true);
  assert.equal(detail.data?.feedScore?.away, 1);
  assert.equal(detail.data?.odds.over_2_5, 1.7);
  assert.equal(detail.data?.lineups.home?.starters[0]?.name, 'Saka');
  assert.equal(detail.data?.lineups.away?.starters[0]?.name, 'Palmer');
  const lineups = await source.recentLineups('sr:competitor:42');
  assert.deepEqual(lineups.data, []);
});

test('an empty todayGames list falls back to the all-upcoming feed', async () => {
  const calls: string[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  const source = createSportyBetSource({
    gapMs: 0,
    fetchJson: async (url) => {
      calls.push(url);
      if (url.includes('todayGames=true')) {
        return { bizCode: 10000, data: { tournaments: Array.from({ length: 12 }, () => ({ events: [] })) } };
      }
      return {
        bizCode: 10000,
        data: {
          tournaments: [
            {
              name: 'Premier League',
              events: [
                {
                  eventId: 'sr:match:5',
                  homeTeamId: 'h',
                  awayTeamId: 'a',
                  homeTeamName: 'Arsenal',
                  awayTeamName: 'Chelsea',
                  estimateStartTime: tomorrow.getTime(),
                  matchStatus: 'Not start',
                },
              ],
            },
          ],
        },
      };
    },
  });
  const day = await source.scheduled(localDate(), true);
  assert.equal(day.ok, true);
  assert.equal(day.data?.[0]?.id, 'sr:match:5');
  assert.match(day.notice ?? '', /showing the next days/);
  assert.match(calls[0] ?? '', /todayGames=true/);
  assert.equal(calls.some((url) => url.includes('pcUpcomingEvents') && !url.includes('todayGames=true')), true);
});

test('a refused bizCode is the visible error', async () => {
  const source = createSportyBetSource({
    gapMs: 0,
    fetchJson: async () => ({ bizCode: 19000, message: 'invalid', data: {} }),
  });
  const day = await source.scheduled(localDate(), true);
  assert.equal(day.ok, false);
  assert.match(day.error ?? '', /bizCode 19000 on pcUpcomingEvents/);
});

test('team results become home and away rows', () => {
  const rows = mapTeamResults(
    {
      data: {
        events: [
          {
            eventId: 'sr:match:1',
            homeTeamId: 'ars',
            awayTeamId: 'che',
            homeTeamName: 'Arsenal',
            awayTeamName: 'Chelsea',
            matchStatus: 'Ended',
            setScore: '2-0',
            estimateStartTime: 200,
          },
          {
            eventId: 'sr:match:2',
            homeTeamId: 'tot',
            awayTeamId: 'ars',
            homeTeamName: 'Spurs',
            awayTeamName: 'Arsenal',
            matchStatus: 'Ended',
            setScore: '1-1',
            estimateStartTime: 100,
          },
        ],
      },
    },
    'ars',
  );
  assert.deepEqual(rows[0], { goalsFor: 2, goalsAgainst: 0, venue: 'home' });
  assert.deepEqual(rows[1], { goalsFor: 1, goalsAgainst: 1, venue: 'away' });
});
