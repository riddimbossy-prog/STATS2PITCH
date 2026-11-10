import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Match } from '../domain';
import { localDate } from '../format';
import { chooseSchedule, inspectSporty, kickoffMs, sportyLine, upcomingPath } from './sporty-read';

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

test('upcoming query carries the web client params', () => {
  const path = upcomingPath(2, true);
  assert.match(path, /^\/factsCenter\/pcUpcomingEvents\?/);
  assert.match(path, /sportId=sr%3Asport%3A1/);
  assert.match(path, /marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100/);
  assert.match(path, /pageSize=100/);
  assert.match(path, /pageNum=2/);
  assert.match(path, /todayGames=true/);
  assert.match(path, /timeline=0/);
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
  assert.equal(sportyLine({ httpStatus: 200, path: '/factsCenter/pcUpcomingEvents', bizCode: 10000, message: null, tournaments: 2, events: 1, kept: 1, scope: 'today' }), 'SportyBet OK: 1 events parsed from 2 tournaments');

  const empty = inspectSporty({ bizCode: 10000, data: { tournaments: Array.from({ length: 12 }, () => ({ events: [] })) } });
  assert.equal(empty.tournaments, 12);
  assert.equal(empty.events.length, 0);
  assert.equal(
    sportyLine({ httpStatus: 200, path: '/factsCenter/pcUpcomingEvents?pageNum=1', bizCode: 10000, message: null, tournaments: 12, events: 0, kept: 0, scope: 'upcoming' }),
    'SportyBet OK: 0 events parsed from 12 tournaments',
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
  assert.equal(line, 'SportyBet: bizCode 19000 on pcUpcomingEvents (invalid)');
  assert.equal(sportyLine({ httpStatus: 403, path: '/factsCenter/pcUpcomingEvents', bizCode: null, message: null, tournaments: 0, events: 0, kept: 0, scope: 'today' }), 'SportyBet: HTTP 403 on pcUpcomingEvents');
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
