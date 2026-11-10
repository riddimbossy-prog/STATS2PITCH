import type { MarketId, ResultRow, Venue } from '../domain';

/** A trend qualifies at 80% across at least five matches. Form uses the latest five. */
export const TREND_WINDOW = 10;
export const FORM_WINDOW = 5;
export const QUALIFY_RATE = 0.8;
export const MIN_SAMPLE = 5;

/**
 * How far an opponent record can move confidence.
 * contribution = opponentRate - 0.5, then confidence = teamRate + contribution * weight.
 * A team at 80% over 2.5 rises when the opponent's matches also clear 2.5,
 * and falls when the opponent's record argues against the market.
 */
export const OPPONENT_WEIGHT = 0.5;

export const MATCH_MARKETS: MarketId[] = [
  'over_1_5',
  'over_2_5',
  'over_3_5',
  'under_2_5',
  'btts',
  'btts_no',
  'draw',
];

export const SIDE_MARKETS: MarketId[] = ['team_win', 'team_over_1_5', 'clean_sheet', 'team_scored'];

export const MARKET_LABEL: Record<MarketId, string> = {
  over_1_5: 'Over 1.5',
  over_2_5: 'Over 2.5',
  over_3_5: 'Over 3.5',
  under_2_5: 'Under 2.5',
  btts: 'Both teams to score',
  btts_no: 'BTTS no',
  draw: 'Draw',
  team_win: 'Win',
  team_over_1_5: 'Team over 1.5',
  clean_sheet: 'Clean sheet',
  team_scored: 'Team to score',
};

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function hit(row: ResultRow, market: MarketId): boolean {
  const total = row.goalsFor + row.goalsAgainst;
  switch (market) {
    case 'over_1_5':
      return total >= 2;
    case 'over_2_5':
      return total >= 3;
    case 'over_3_5':
      return total >= 4;
    case 'under_2_5':
      return total <= 2;
    case 'btts':
      return row.goalsFor > 0 && row.goalsAgainst > 0;
    case 'btts_no':
      return row.goalsFor === 0 || row.goalsAgainst === 0;
    case 'draw':
      return row.goalsFor === row.goalsAgainst;
    case 'team_win':
      return row.goalsFor > row.goalsAgainst;
    case 'team_over_1_5':
      return row.goalsFor >= 2;
    case 'clean_sheet':
      return row.goalsAgainst === 0;
    case 'team_scored':
      return row.goalsFor > 0;
  }
}

/** Opponent record read in the direction that supports the anchored pick. */
export function opponentHit(row: ResultRow, market: MarketId): boolean {
  switch (market) {
    case 'team_win':
      return row.goalsFor < row.goalsAgainst;
    case 'team_over_1_5':
      return row.goalsAgainst >= 2;
    case 'clean_sheet':
      return row.goalsFor === 0;
    case 'team_scored':
      return row.goalsAgainst > 0;
    default:
      return hit(row, market);
  }
}

export interface RateStat {
  hits: number;
  sample: number;
  rate: number;
  qualifies: boolean;
  scope: 'venue' | 'overall' | 'empty';
}

export function rateOf(
  rows: ResultRow[],
  predicate: (row: ResultRow) => boolean,
  window: number,
  venue?: Venue,
): RateStat {
  const venueRows = venue ? rows.filter((row) => row.venue === venue) : rows;
  const useVenue = Boolean(venue) && venueRows.length >= MIN_SAMPLE;
  const slice = (useVenue ? venueRows : rows).slice(0, window);
  const sample = slice.length;
  const hits = slice.filter(predicate).length;
  const rate = sample === 0 ? 0 : hits / sample;
  return {
    hits,
    sample,
    rate,
    qualifies: sample >= MIN_SAMPLE && rate + 1e-9 >= QUALIFY_RATE,
    scope: sample === 0 ? 'empty' : useVenue ? 'venue' : 'overall',
  };
}

export function opponentContribution(oppRate: number): number {
  return oppRate - 0.5;
}

export function confidenceScore(teamRate: number, oppRate: number): number {
  return clamp01(teamRate + opponentContribution(oppRate) * OPPONENT_WEIGHT);
}
