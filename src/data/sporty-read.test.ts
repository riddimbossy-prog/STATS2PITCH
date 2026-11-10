import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Match } from '../domain';
import { localDate } from '../format';
import { chooseSchedule, formatLadder, inspectSporty, kickoffMs, morePages, sportyLine, upcomingPath } from './sporty-read';

const day = '2026-11-10';

function match(id: string, kickoff: number): Match {
  return {
    id,
    home: { id: 'h', name: 'Home', shortName: 'HOM' },
    away: { id: 'a', name: 'Away', shortName: 'AWA' },
    competition: { id: 'c', name: 'League' },
    league: { id: 'l', name: 'Country' },
    kickoff,
    status: 'scheduled',
    statusText: 'Not start',
    minute: null,
    feedScore: null,
    varPending: false,
  };
}

test('upcoming query is the proven Predict2u URL', () => {
  const path = upcomingPath(2);
  assert.equal(
    path,
    '/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29&pageSize=100&pageNum=2&option=1',
  );
  assert.doesNotMatch(path, /timeline|todayGames|productId/);
});

test('paging stops when the page is short or totalNum is covered', () => {
  assert.equal(morePages(1, 40, 200), false);
  assert.equal(morePages(1, 100, 100), false);
  assert.equal(morePages(1, 100, 250), true);
  assert.equal(morePages(3, 100, 250), false);
});

test('the diagnostics ladder keeps non-200 bodies', () => {
  const text = formatLadder([
    {
      path: '/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29&pageSize=100&pageNum=1&option=1',
      via: 'direct',
      headerSet: 'plain',
      headerNames: 'Accept, User-Agent',
      httpStatus: 422,
      bizCode: null,
      message: null,
      snippet: 'rejected params',
    },
  ]);
  assert.match(text, /direct\/plain HTTP 422/);
  assert.match(text, /headers: Accept, User-Agent/);
  assert.match(text, /body: rejected params/);
  assert.doesNotMatch(text, /timeline|todayGames/);
});

test('a seconds timestamp is treated as milliseconds', () => {
  assert.equal(kickoffMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(kickoffMs(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(kickoffMs(0), 0);
});

test('reads tournaments, a bare event list, and todayGames', () => {
  const tournaments = inspectSporty({
    bizCode: 10000,
    data: { tournaments: [{ name: 'Premier League', events: [] }, { name: 'Serie A', events: [{ eventId: 'sr:match:1', homeTeamName: 'A', awayTeamName: 'B' }] }] },
  });
  assert.equal(tournaments.tournaments, 2);
  assert.equal(tournaments.events.length, 1);
  assert.equal(sportyLine({ httpStatus: 200, path: '/factsCenter/pcUpcomingEvents', bizCode: 10000, message: null, tournaments: 2, events: 1, kept: 1, scope: 'today' }), '');
  assert.doesNotMatch(sportyLine({ httpStatus: 200, path: '/factsCenter/pcUpcomingEvents', bizCode: 10000, message: null, tournaments: 2, events: 1, kept: 1, scope: 'today' }), /SportyBet|factsCenter|pcUpcoming|bizCode|HTTP/);

  const empty = inspectSporty({ bizCode: 10000, data: { tournaments: Array.from({ length: 12 }, () => ({ events: [] })) } });
  assert.equal(empty.tournaments, 12);
  assert.equal(empty.events.length, 0);
  assert.equal(
    sportyLine({ httpStatus: 200, path: '/factsCenter/pcUpcomingEvents?pageNum=1', bizCode: 10000, message: null, tournaments: 12, events: 0, kept: 0, scope: 'upcoming' }),
    '',
  );

  const listed = inspectSporty({ data: { events: [{ eventId: 'sr:match:9', homeTeamName: 'A', awayTeamName: 'B' }] } });
  assert.equal(listed.events[0]?.eventId, 'sr:match:9');

  const todayGames = inspectSporty({ data: { todayGames: [{ eventId: 'sr:match:3', homeTeamName: 'A', awayTeamName: 'B' }] } });
  assert.equal(todayGames.events[0]?.eventId, 'sr:match:3');
});

test('a refused bizCode is named in the status line', () => {
  const line = sportyLine({
    httpStatus: 200,
    path: '/factsCenter/pcUpcomingEvents',
    bizCode: 19000,
    message: 'invalid',
    tournaments: 0,
    events: 0,
    kept: 0,
    scope: 'today',
  });
  assert.equal(line, "Couldn't load matches");
  assert.doesNotMatch(line, /SportyBet|factsCenter|pcUpcoming|bizCode|HTTP/);
  assert.equal(sportyLine({ httpStatus: 403, path: '/factsCenter/pcUpcomingEvents', bizCode: null, message: null, tournaments: 0, events: 0, kept: 0, scope: 'today' }), "Couldn't load matches");
});

function localMs(isoDay: string, hours: number, dayOffset = 0): number {
  const date = new Date(`${isoDay}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, 0, 0, 0);
  return date.getTime();
}

test('an empty today falls back to the next days, then to every parsed fixture', () => {
  const next = chooseSchedule([match('sr:match:2', localMs(day, 18, 1))], day, localMs(day, 12));
  assert.equal(next.scope, 'next');
  assert.equal(next.matches[0]?.id, 'sr:match:2');
  const all = chooseSchedule([match('sr:match:8', localMs(day, 18, 10))], day, localMs(day, 12));
  assert.equal(all.scope, 'upcoming');
  assert.equal(all.matches.length, 1);
  const kick = localMs(day, 18);
  const today = chooseSchedule([match('sr:match:1', kick)], localDate(new Date(kick)));
  assert.equal(today.scope, 'today');
});
