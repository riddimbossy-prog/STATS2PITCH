import type { ConfidenceBand, MarketId, PickKind, ResultRow, Side, TeamRef, Venue } from '../domain';
import {
  FORM_WINDOW,
  MARKET_LABEL,
  MATCH_MARKETS,
  SIDE_MARKETS,
  TREND_WINDOW,
  confidenceScore,
  hit,
  opponentContribution,
  opponentHit,
  rateOf,
  type RateStat,
} from './markets';

export interface PickInput {
  matchId: string;
  home: TeamRef;
  away: TeamRef;
  competitionId: string;
  competitionName: string;
  leagueId: string;
  leagueName: string;
  kickoff: number;
  homeResults: ResultRow[];
  awayResults: ResultRow[];
  odds?: Partial<Record<string, number>>;
}

export interface Pick {
  id: string;
  matchId: string;
  market: MarketId;
  marketKey: string;
  label: string;
  side: Side;
  kind: PickKind;
  headStart: boolean;
  teamRate: number;
  teamHits: number;
  teamSample: number;
  oppRate: number;
  oppHits: number;
  oppSample: number;
  opponentContribution: number;
  confidence: number;
  band: ConfidenceBand;
  formRate: number;
  trendRate: number;
  scope: RateStat['scope'];
  odds: number | null;
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  competitionId: string;
  competitionName: string;
  leagueId: string;
  leagueName: string;
  kickoff: number;
}

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.95) return 'elite';
  if (confidence >= 0.9) return 'strong';
  if (confidence >= 0.85) return 'solid';
  if (confidence >= 0.8) return 'qualifying';
  return 'watch';
}

export const BAND_ORDER: ConfidenceBand[] = ['elite', 'strong', 'solid', 'qualifying', 'watch'];

export const BAND_TITLE: Record<ConfidenceBand, string> = {
  elite: 'Elite · 95%+',
  strong: 'Strong · 90%+',
  solid: 'Solid · 85%+',
  qualifying: 'Qualifying · 80%+',
  watch: 'Watch · opponent pulls it under 80%',
};

function labelFor(market: MarketId, side: Side, teamName: string): string {
  if (side === 'match') return MARKET_LABEL[market];
  if (market === 'team_win') return `${teamName} win`;
  if (market === 'team_over_1_5') return `${teamName} over 1.5`;
  if (market === 'clean_sheet') return `${teamName} clean sheet`;
  if (market === 'team_scored') return `${teamName} to score`;
  return `${teamName} ${MARKET_LABEL[market]}`;
}

function anchorChoice(
  market: MarketId,
  homeResults: ResultRow[],
  awayResults: ResultRow[],
): 'home' | 'away' | null {
  const homeVenue: Venue = 'home';
  const awayVenue: Venue = 'away';
  const homeTrend = rateOf(homeResults, (row) => hit(row, market), TREND_WINDOW, homeVenue);
  const awayTrend = rateOf(awayResults, (row) => hit(row, market), TREND_WINDOW, awayVenue);
  const homeForm = rateOf(homeResults, (row) => hit(row, market), FORM_WINDOW, homeVenue);
  const awayForm = rateOf(awayResults, (row) => hit(row, market), FORM_WINDOW, awayVenue);
  const homeQ = homeTrend.qualifies || homeForm.qualifies;
  const awayQ = awayTrend.qualifies || awayForm.qualifies;
  if (!homeQ && !awayQ) return null;
  if (homeQ && !awayQ) return 'home';
  if (!homeQ && awayQ) return 'away';
  const homeScore = (homeTrend.qualifies ? 2 : 0) + (homeTrend.qualifies ? homeTrend.rate : homeForm.rate);
  const awayScore = (awayTrend.qualifies ? 2 : 0) + (awayTrend.qualifies ? awayTrend.rate : awayForm.rate);
  return homeScore >= awayScore ? 'home' : 'away';
}

function buildOne(
  input: PickInput,
  market: MarketId,
  side: Side,
  anchorRows: ResultRow[],
  oppRows: ResultRow[],
  venue: Venue | undefined,
  opponentVenue: Venue | undefined,
  anchor: TeamRef,
  opponent: TeamRef,
): Pick | null {
  const trend = rateOf(anchorRows, (row) => hit(row, market), TREND_WINDOW, venue);
  const form = rateOf(anchorRows, (row) => hit(row, market), FORM_WINDOW, venue);
  if (!trend.qualifies && !form.qualifies) return null;
  const headStart = !trend.qualifies && form.qualifies;
  const anchorStat = headStart ? form : trend;
  const window = headStart ? FORM_WINDOW : TREND_WINDOW;
  const oppVenue = anchorStat.scope === 'venue' ? opponentVenue : undefined;
  const opp = rateOf(oppRows, (row) => opponentHit(row, market), window, oppVenue);
  const contribution = opponentContribution(opp.sample === 0 ? 0.5 : opp.rate);
  const confidence = confidenceScore(anchorStat.rate, opp.sample === 0 ? 0.5 : opp.rate);
  const marketKey = side === 'match' ? market : `${side}:${market}`;
  return {
    id: `${input.matchId}:${marketKey}`,
    matchId: input.matchId,
    market,
    marketKey,
    label: labelFor(market, side, anchor.name),
    side,
    kind: headStart ? 'form' : 'trend',
    headStart,
    teamRate: anchorStat.rate,
    teamHits: anchorStat.hits,
    teamSample: anchorStat.sample,
    oppRate: opp.sample === 0 ? 0.5 : opp.rate,
    oppHits: opp.hits,
    oppSample: opp.sample,
    opponentContribution: contribution,
    confidence,
    band: bandFor(confidence),
    formRate: form.rate,
    trendRate: trend.rate,
    scope: anchorStat.scope,
    odds: input.odds?.[marketKey] ?? null,
    teamId: anchor.id,
    teamName: anchor.name,
    opponentId: opponent.id,
    opponentName: opponent.name,
    competitionId: input.competitionId,
    competitionName: input.competitionName,
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    kickoff: input.kickoff,
  };
}

/** Every market at 80%+ becomes a tipped pick. Form at 80%+ is a head start when the longer trend is not there yet. */
export function buildPicks(input: PickInput): Pick[] {
  const picks: Pick[] = [];
  for (const market of MATCH_MARKETS) {
    const anchorSide = anchorChoice(market, input.homeResults, input.awayResults);
    if (!anchorSide) continue;
    const homeAnchor = anchorSide === 'home';
    const pick = buildOne(
      input,
      market,
      'match',
      homeAnchor ? input.homeResults : input.awayResults,
      homeAnchor ? input.awayResults : input.homeResults,
      homeAnchor ? 'home' : 'away',
      homeAnchor ? 'away' : 'home',
      homeAnchor ? input.home : input.away,
      homeAnchor ? input.away : input.home,
    );
    if (pick) picks.push(pick);
  }
  for (const market of SIDE_MARKETS) {
    const homePick = buildOne(
      input,
      market,
      'home',
      input.homeResults,
      input.awayResults,
      'home',
      'away',
      input.home,
      input.away,
    );
    const awayPick = buildOne(
      input,
      market,
      'away',
      input.awayResults,
      input.homeResults,
      'away',
      'home',
      input.away,
      input.home,
    );
    if (homePick) picks.push(homePick);
    if (awayPick) picks.push(awayPick);
  }
  return picks.sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
}

export type OddsDirection = 'asc' | 'desc';
export type OddsBand = 'short' | 'medium' | 'long' | 'none';

export function oddsBand(odds: number | null): OddsBand {
  if (odds == null) return 'none';
  if (odds <= 1.5) return 'short';
  if (odds <= 2.2) return 'medium';
  return 'long';
}

export const ODDS_TITLE: Record<OddsBand, string> = {
  short: 'Short · 1.50 and under',
  medium: 'Medium · 1.51 to 2.20',
  long: 'Long · over 2.20',
  none: 'No price yet',
};

export function sortByOdds(picks: Pick[], direction: OddsDirection): Pick[] {
  return [...picks].sort((a, b) => {
    if (a.odds == null && b.odds == null) return b.confidence - a.confidence;
    if (a.odds == null) return 1;
    if (b.odds == null) return -1;
    const diff = direction === 'asc' ? a.odds - b.odds : b.odds - a.odds;
    return diff !== 0 ? diff : b.confidence - a.confidence;
  });
}

export function groupByConfidence(picks: Pick[]): { key: string; title: string; picks: Pick[] }[] {
  return BAND_ORDER.map((band) => ({
    key: band,
    title: BAND_TITLE[band],
    picks: picks.filter((pick) => pick.band === band).sort((a, b) => b.confidence - a.confidence),
  })).filter((group) => group.picks.length > 0);
}

export function groupByMarket(picks: Pick[]): { key: string; title: string; picks: Pick[] }[] {
  return [...MATCH_MARKETS, ...SIDE_MARKETS]
    .map((market) => ({
      key: market,
      title: MARKET_LABEL[market],
      picks: picks.filter((pick) => pick.market === market).sort((a, b) => b.confidence - a.confidence),
    }))
    .filter((group) => group.picks.length > 0);
}

export function groupByOdds(
  picks: Pick[],
  direction: OddsDirection,
): { key: string; title: string; picks: Pick[] }[] {
  const order: OddsBand[] =
    direction === 'asc' ? ['short', 'medium', 'long', 'none'] : ['long', 'medium', 'short', 'none'];
  return order
    .map((key) => ({
      key,
      title: ODDS_TITLE[key],
      picks: sortByOdds(
        picks.filter((pick) => oddsBand(pick.odds) === key),
        direction,
      ),
    }))
    .filter((group) => group.picks.length > 0);
}
