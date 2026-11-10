import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RawIncident, ResultRow } from '../domain';
import { gradePeriod, letterGrade, periodBounds } from './grading';
import { reconcile } from './reconcile';
import { isSuppressed, listRecommendation } from './lists';
import { QUALIFY_RATE, confidenceScore, hit, opponentContribution, rateOf } from './markets';
import { noticesForTransition, slipNotices } from './notify';
import { buildPicks, groupByConfidence, groupByMarket, groupByOdds, sortByOdds } from './picks';
import { suggestSimilar } from './similarity';
import { combinedOdds, marketSettled, settleSlip } from './settlement';
import { assessSquad } from './squad';
import { assessVar } from './var';

const row = (goalsFor: number, goalsAgainst: number, venue: 'home' | 'away' = 'home'): ResultRow => ({
  goalsFor,
  goalsAgainst,
  venue,
});

const team = (id: string, name: string) => ({ id, name, shortName: name.slice(0, 3).toUpperCase() });

test('80% over 2.5 qualifies and 70% does not', () => {
  const eight = Array.from({ length: 8 }, () => row(2, 1)).concat([row(1, 0), row(0, 0)]);
  const seven = Array.from({ length: 7 }, () => row(2, 1)).concat([row(1, 0), row(0, 0), row(1, 0)]);
  const high = rateOf(eight, (item) => hit(item, 'over_2_5'), 10);
  const low = rateOf(seven, (item) => hit(item, 'over_2_5'), 10);
  assert.equal(high.hits, 8);
  assert.equal(high.qualifies, true);
  assert.equal(low.rate, 0.7);
  assert.equal(low.qualifies, false);
  assert.equal(QUALIFY_RATE, 0.8);
});

test('a 4 from 4 run stays unqualified until five matches exist', () => {
  const short = [row(3, 1), row(2, 2), row(4, 0), row(2, 1)];
  const stat = rateOf(short, (item) => hit(item, 'over_2_5'), 10);
  assert.equal(stat.rate, 1);
  assert.equal(stat.qualifies, false);
});

test('venue sample falls back to the overall record when it is shorter than five', () => {
  const rows = [row(2, 1, 'home'), row(2, 1, 'home'), ...Array.from({ length: 8 }, () => row(2, 1, 'away'))];
  const stat = rateOf(rows, (item) => hit(item, 'over_2_5'), 10, 'home');
  assert.equal(stat.scope, 'overall');
  assert.equal(stat.sample, 10);
  assert.equal(stat.qualifies, true);
});

test('opponent support lifts over 2.5 confidence and a contradictory record drops it', () => {
  const supported = confidenceScore(0.8, 0.9);
  const contradicted = confidenceScore(0.8, 0.2);
  const neutral = confidenceScore(0.8, 0.5);
  assert.equal(opponentContribution(0.9), 0.4);
  assert.equal(supported, 1);
  assert.equal(neutral, 0.8);
  assert.ok(Math.abs(contradicted - 0.65) < 1e-9);
  assert.ok(supported > neutral);
  assert.ok(neutral > contradicted);
});

test('form at 80% is a head start when the ten-match trend is not', () => {
  const homeResults = [
    row(2, 1),
    row(3, 1),
    row(2, 2),
    row(4, 0),
    row(1, 2),
    row(1, 0),
    row(0, 0),
    row(1, 0),
    row(0, 1),
    row(1, 0),
  ];
  const awayResults = Array.from({ length: 10 }, () => row(1, 1, 'away'));
  const picks = buildPicks({
    matchId: 'm1',
    home: team('h', 'Brighton'),
    away: team('a', 'Everton'),
    competitionId: 'pl',
    competitionName: 'Premier League',
    leagueId: 'eng',
    leagueName: 'England',
    kickoff: 1,
    homeResults,
    awayResults,
    odds: { over_2_5: 1.95 },
  });
  const over = picks.find((pick) => pick.market === 'over_2_5');
  assert.ok(over);
  assert.equal(over?.headStart, true);
  assert.equal(over?.kind, 'form');
  assert.equal(over?.trendRate, 0.5);
  assert.equal(over?.formRate, 1);
  assert.equal(over?.odds, 1.95);
});

test('both teams qualifying keeps the stronger record as the anchor', () => {
  const homeResults = Array.from({ length: 8 }, () => row(2, 1)).concat([row(0, 0), row(1, 0)]);
  const awayResults = Array.from({ length: 10 }, () => row(3, 1, 'away'));
  const picks = buildPicks({
    matchId: 'm2',
    home: team('h', 'Arsenal'),
    away: team('a', 'Chelsea'),
    competitionId: 'pl',
    competitionName: 'Premier League',
    leagueId: 'eng',
    leagueName: 'England',
    kickoff: 1,
    homeResults,
    awayResults,
  });
  const over = picks.find((pick) => pick.market === 'over_2_5');
  assert.equal(over?.teamName, 'Chelsea');
  assert.equal(over?.teamRate, 1);
  assert.equal(over?.oppRate, 0.8);
  assert.equal(over?.confidence, 1);
  assert.equal(over?.band, 'elite');
});

test('groups picks by confidence, market and odds, with missing prices last', () => {
  const homeHot = Array.from({ length: 10 }, () => row(3, 2));
  const awayQuiet = Array.from({ length: 10 }, () => row(0, 0, 'away'));
  const picks = buildPicks({
    matchId: 'm3',
    home: team('h', 'Arsenal'),
    away: team('a', 'Chelsea'),
    competitionId: 'pl',
    competitionName: 'Premier League',
    leagueId: 'eng',
    leagueName: 'England',
    kickoff: 1,
    homeResults: homeHot,
    awayResults: awayQuiet,
    odds: { over_2_5: 2.4, over_1_5: 1.4, btts: 1.8 },
  });
  const confidence = groupByConfidence(picks);
  assert.ok(confidence.length > 0);
  assert.deepEqual(
    confidence.map((group) => group.picks.every((pick) => pick.band === group.key)),
    confidence.map(() => true),
  );
  const markets = groupByMarket(picks);
  assert.ok(markets.some((group) => group.key === 'over_2_5'));
  const asc = groupByOdds(picks, 'asc');
  const priced = asc.filter((group) => group.key !== 'none');
  assert.deepEqual(
    priced.map((group) => group.key),
    ['short', 'medium', 'long'].filter((key) => priced.some((group) => group.key === key)),
  );
  const flat = sortByOdds(
    picks.map((pick, index) => (index === 0 ? { ...pick, odds: null } : pick)),
    'desc',
  );
  assert.equal(flat.at(-1)?.odds, null);
});

test('squad strength compares today with the usual starters', () => {
  const usual = ['Raya', 'White', 'Saliba', 'Gabriel', 'Calafiori', 'Odegaard', 'Rice', 'Havertz', 'Saka', 'Martinelli', 'Trossard'];
  const recent = [usual, usual, usual, usual, usual];
  const half = ['Raya', 'White', 'Saliba', 'Gabriel', 'Calafiori', 'A', 'B', 'C', 'D', 'E', 'F'];
  const full = [...usual.slice(0, 10), 'A'];
  const halfReport = assessSquad(recent, half);
  assert.equal(halfReport.strength, 'half');
  assert.equal(halfReport.rotationFlag, true);
  assert.equal(halfReport.missing.length, 6);
  const fullReport = assessSquad(recent, full);
  assert.equal(fullReport.strength, 'full');
  assert.equal(fullReport.rotationFlag, false);
  assert.equal(assessSquad(recent.slice(0, 2), full).strength, 'unknown');
  assert.equal(assessSquad(recent, null).strength, 'unknown');
});

test('similarity stays on the same market and ranks the closer record first', () => {
  const anchor = { id: 'a', matchId: 'm1', market: 'over_2_5' as const, confidence: 0.9, teamRate: 0.8, formRate: 0.8 };
  const close = { id: 'b', matchId: 'm2', market: 'over_2_5' as const, confidence: 0.88, teamRate: 0.82, formRate: 0.8 };
  const far = { id: 'c', matchId: 'm3', market: 'over_2_5' as const, confidence: 0.5, teamRate: 0.4, formRate: 0.4 };
  const other = { id: 'd', matchId: 'm4', market: 'btts' as const, confidence: 0.9, teamRate: 0.8, formRate: 0.8 };
  assert.equal(suggestSimilar([anchor], [other]).length, 0);
  const suggestions = suggestSimilar([anchor], [far, close, anchor]);
  assert.equal(suggestions[0]?.pickId, 'b');
  assert.ok((suggestions[0]?.score ?? 0) > 0.72);
  assert.equal(suggestions.some((item) => item.pickId === 'a'), false);
});

test('grades the week, month and year and marks the luckiest group', () => {
  const now = Date.UTC(2026, 10, 9, 15, 0, 0);
  const week = periodBounds('week', now);
  assert.equal(new Date(week.start).getUTCDate(), 9);
  const records = [
    rec('1', 'over_2_5', 'ARS', 'Arsenal', 'pl', 'Premier League', 'won', now - 1000),
    rec('2', 'over_2_5', 'ARS', 'Arsenal', 'pl', 'Premier League', 'won', now - 2000),
    rec('3', 'over_2_5', 'ARS', 'Arsenal', 'pl', 'Premier League', 'won', now - 3000),
    rec('4', 'over_2_5', 'CHE', 'Chelsea', 'pl', 'Premier League', 'lost', now - 4000),
    rec('5', 'btts', 'RMA', 'Real Madrid', 'll', 'La Liga', 'lost', now - 5000),
    rec('6', 'btts', 'RMA', 'Real Madrid', 'll', 'La Liga', 'lost', now - 6000),
    rec('7', 'btts', 'RMA', 'Real Madrid', 'll', 'La Liga', 'lost', now - 7000),
    rec('old', 'over_2_5', 'ARS', 'Arsenal', 'pl', 'Premier League', 'won', Date.UTC(2026, 10, 1)),
  ];
  const report = gradePeriod(records, 'week', now);
  assert.equal(report.overall.wins, 3);
  assert.equal(report.overall.losses, 4);
  assert.equal(report.overall.grade, 'D');
  assert.equal(report.markets.find((row) => row.key === 'over_2_5')?.lucky, true);
  assert.equal(report.teams.find((row) => row.name === 'Arsenal')?.grade, 'A+');
  assert.equal(report.competitions.find((row) => row.name === 'Premier League')?.lucky, true);
  assert.equal(report.landed.length, 3);
  assert.equal(letterGrade(0.75, 4), 'A');
  const month = gradePeriod(records, 'month', now);
  assert.equal(month.overall.wins, 4);
});

test('settles markets during the match and busts an accumulator on one loss', () => {
  assert.equal(marketSettled('over_2_5', 'match', { home: 2, away: 1 }, 'live'), 'won');
  assert.equal(marketSettled('under_2_5', 'match', { home: 2, away: 1 }, 'live'), 'lost');
  assert.equal(marketSettled('draw', 'match', { home: 1, away: 1 }, 'live'), 'pending');
  assert.equal(marketSettled('team_win', 'home', { home: 1, away: 0 }, 'live'), 'pending');
  assert.equal(marketSettled('team_win', 'home', { home: 1, away: 0 }, 'finished'), 'won');
  assert.equal(marketSettled('clean_sheet', 'home', { home: 1, away: 0 }, 'live'), 'pending');
  assert.equal(marketSettled('clean_sheet', 'home', { home: 1, away: 1 }, 'live'), 'lost');
  assert.equal(marketSettled('over_2_5', 'match', { home: 0, away: 0 }, 'postponed'), 'void');
  assert.equal(settleSlip(['won', 'pending']), 'open');
  assert.equal(settleSlip(['won', 'lost']), 'lost');
  assert.equal(settleSlip(['won', 'void']), 'won');
  assert.equal(settleSlip(['void', 'void']), 'void');
  assert.equal(combinedOdds([1.5, 2]), 3);
  assert.equal(combinedOdds([1.5, null]), null);
});

test('VAR holds the goal until it is confirmed', () => {
  const pending: RawIncident[] = [
    { id: 'g1', type: 'goal', minute: 12, isHome: true, player: 'Saka', confirmed: true },
    { id: 'v1', type: 'var', minute: 71, isHome: true, varState: 'pending' },
  ];
  const held = assessVar(pending, { home: 2, away: 0 });
  assert.equal(held.varPending, true);
  assert.deepEqual(held.score, { home: 1, away: 0 });
  assert.equal(held.incidents[1]?.label, 'VAR');
  assert.equal(held.incidents[1]?.countsAsGoal, false);

  const awarded = assessVar(
    [
      { id: 'g1', type: 'goal', minute: 12, isHome: true, player: 'Saka', confirmed: true },
      { id: 'v1', type: 'var', minute: 71, isHome: true, varState: 'awarded' },
    ],
    { home: 1, away: 0 },
  );
  assert.equal(awarded.varPending, false);
  assert.deepEqual(awarded.score, { home: 2, away: 0 });
  assert.equal(awarded.incidents[1]?.label, 'Goal confirmed');

  const disallowed = assessVar(
    [{ id: 'v1', type: 'var', minute: 71, isHome: true, varState: 'disallowed' }],
    { home: 1, away: 0 },
  );
  assert.equal(disallowed.varPending, false);
  assert.equal(disallowed.incidents[0]?.countsAsGoal, false);
  assert.deepEqual(disallowed.score, { home: 1, away: 0 });
});

test('a pending VAR check does not notify a goal, and confirmation does', () => {
  const base = {
    matchId: 'm',
    homeName: 'Arsenal',
    awayName: 'Chelsea',
    tracked: [{ id: 'p1', label: 'Over 2.5', market: 'over_2_5' as const, side: 'match' as const, status: 'pending' as const }],
  };
  const checking = noticesForTransition({
    ...base,
    prev: { score: { home: 1, away: 0 }, varPending: false, status: 'live' },
    next: { score: { home: 1, away: 0 }, varPending: true, status: 'live' },
  });
  assert.deepEqual(
    checking.notices.map((notice) => notice.title),
    ['VAR'],
  );
  const confirmed = noticesForTransition({
    ...base,
    prev: { score: { home: 1, away: 0 }, varPending: true, status: 'live' },
    next: { score: { home: 2, away: 1 }, varPending: false, status: 'live' },
    tracked: [{ id: 'p1', label: 'Over 2.5', market: 'over_2_5', side: 'match', status: 'pending' }],
  });
  assert.ok(confirmed.notices.some((notice) => notice.title === 'Goal confirmed'));
  assert.equal(confirmed.notices.some((notice) => notice.title === 'VAR'), false);
  assert.equal(confirmed.tracked[0]?.status, 'won');
  assert.ok(confirmed.notices.some((notice) => notice.title === 'Tip landed'));
  const firstLook = noticesForTransition({
    ...base,
    prev: null,
    next: { score: { home: 2, away: 1 }, varPending: false, status: 'live' },
  });
  assert.equal(firstLook.notices.some((notice) => notice.tone === 'goal'), false);
});

test('booking-code notices fire when a slip busts or lands', () => {
  const notices = slipNotices({
    slips: [
      { id: 's1', code: 'S2P-SPO-ABC', previous: 'open', next: 'lost' },
      { id: 's2', code: 'S2P-BET-DEF', previous: 'open', next: 'won' },
      { id: 's3', code: null, previous: 'open', next: 'open' },
    ],
  });
  assert.deepEqual(
    notices.map((notice) => notice.title),
    ['Booking bust', 'Booking landed'],
  );
});

test('blacklist and greenlist follow busts and lands', () => {
  assert.equal(listRecommendation(['lost', 'lost', 'lost'])?.kind, 'black');
  assert.equal(listRecommendation(['won', 'won', 'won'])?.kind, 'green');
  assert.equal(listRecommendation(['lost', 'lost', 'won']), null);
  assert.equal(listRecommendation(['lost', 'lost', 'lost', 'lost', 'won'])?.kind, 'black');
  const pick = buildPicks({
    matchId: 'm9',
    home: team('ars', 'Arsenal'),
    away: team('che', 'Chelsea'),
    competitionId: 'pl',
    competitionName: 'Premier League',
    leagueId: 'eng',
    leagueName: 'England',
    kickoff: 1,
    homeResults: Array.from({ length: 10 }, () => row(3, 1)),
    awayResults: Array.from({ length: 10 }, () => row(1, 1, 'away')),
  })[0];
  assert.ok(pick);
  assert.equal(
    isSuppressed(pick!, [
      {
        id: '1',
        kind: 'black',
        scope: 'team',
        refId: pick!.teamId,
        name: pick!.teamName,
        source: 'manual',
        reason: null,
        createdAt: 1,
      },
    ]),
    true,
  );
});

test('a VAR check does not settle the unconfirmed goal', () => {
  const match = {
    id: 'ars-che',
    home: { id: 'ars', name: 'Arsenal', shortName: 'ARS' },
    away: { id: 'che', name: 'Chelsea', shortName: 'CHE' },
    competition: { id: 'pl', name: 'Premier League' },
    league: { id: 'eng', name: 'England' },
    kickoff: 1,
    status: 'live' as const,
    statusText: '71\'',
    minute: '71\'',
    feedScore: { home: 2, away: 0 },
    varPending: false,
  };
  const detail = {
    ...match,
    incidents: [
      { id: 'g1', type: 'goal' as const, minute: 12, isHome: true, confirmed: true, player: 'Saka' },
      { id: 'v1', type: 'var' as const, minute: 71, isHome: true, varState: 'pending' as const },
    ],
    lineups: { home: null, away: null },
    odds: {},
  };
  const tracked = [{
    id: 'ars-che:over_2_5',
    matchId: 'ars-che',
    marketKey: 'over_2_5',
    market: 'over_2_5' as const,
    side: 'match' as const,
    label: 'Over 2.5',
    teamId: 'ars',
    teamName: 'Arsenal',
    opponentName: 'Chelsea',
    competitionId: 'pl',
    competitionName: 'Premier League',
    leagueId: 'eng',
    leagueName: 'England',
    odds: 1.7,
    confidence: 0.9,
    teamRate: 0.8,
    formRate: 0.8,
    kind: 'trend' as const,
    status: 'pending' as const,
    kickoff: 1,
    settledAt: null,
    createdAt: 1,
  }];
  const held = reconcile({
    matches: [match],
    details: { 'ars-che': detail },
    tracked,
    slips: [],
    lists: [],
    snapshots: { 'ars-che': { score: { home: 1, away: 0 }, varPending: false, status: 'live' } },
    slipStatuses: {},
    now: 10,
  });
  assert.equal(held.tracked[0]?.status, 'pending');
  assert.equal(held.notices.some((notice) => notice.title === 'Goal'), false);
  assert.equal(held.notices.some((notice) => notice.title === 'VAR'), true);
});

function rec(
  id: string,
  market: 'over_2_5' | 'btts',
  teamId: string,
  teamName: string,
  competitionId: string,
  competitionName: string,
  status: 'won' | 'lost',
  settledAt: number,
) {
  return { id, label: id, market, teamId, teamName, competitionId, competitionName, status, settledAt };
}
