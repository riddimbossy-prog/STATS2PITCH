import type { LegStatus, MarketId, MatchStatus, Side } from '../domain';

export interface Score {
  home: number;
  away: number;
}

/**
 * Markets that are already mathematically decided settle during the match.
 * 1X2 and the draw wait for full time. Postponed and cancelled matches void.
 */
export function marketSettled(market: MarketId, side: Side, score: Score, status: MatchStatus): LegStatus {
  if (status === 'postponed' || status === 'cancelled') return 'void';
  if (status === 'scheduled') return 'pending';
  const finished = status === 'finished';
  const { home, away } = score;
  const total = home + away;

  if (side === 'match') {
    switch (market) {
      case 'over_1_5':
        return total >= 2 ? 'won' : finished ? 'lost' : 'pending';
      case 'over_2_5':
        return total >= 3 ? 'won' : finished ? 'lost' : 'pending';
      case 'over_3_5':
        return total >= 4 ? 'won' : finished ? 'lost' : 'pending';
      case 'under_2_5':
        return total >= 3 ? 'lost' : finished ? 'won' : 'pending';
      case 'btts':
        return home > 0 && away > 0 ? 'won' : finished ? 'lost' : 'pending';
      case 'btts_no':
        return home > 0 && away > 0 ? 'lost' : finished ? 'won' : 'pending';
      case 'draw':
        return finished ? (home === away ? 'won' : 'lost') : 'pending';
      default:
        return 'pending';
    }
  }

  const goalsFor = side === 'home' ? home : away;
  const goalsAgainst = side === 'home' ? away : home;
  switch (market) {
    case 'team_win':
      return finished ? (goalsFor > goalsAgainst ? 'won' : 'lost') : 'pending';
    case 'team_over_1_5':
      return goalsFor >= 2 ? 'won' : finished ? 'lost' : 'pending';
    case 'clean_sheet':
      return goalsAgainst > 0 ? 'lost' : finished ? 'won' : 'pending';
    case 'team_scored':
      return goalsFor > 0 ? 'won' : finished ? 'lost' : 'pending';
    default:
      return 'pending';
  }
}

export function settleSlip(statuses: LegStatus[]): 'won' | 'lost' | 'void' | 'open' {
  if (statuses.length === 0) return 'void';
  if (statuses.some((status) => status === 'lost')) return 'lost';
  if (statuses.every((status) => status === 'void')) return 'void';
  if (statuses.every((status) => status === 'won' || status === 'void')) return 'won';
  return 'open';
}

export function combinedOdds(odds: Array<number | null>): number | null {
  if (odds.length === 0 || odds.some((price) => price == null)) return null;
  return odds.reduce<number>((product, price) => product * (price as number), 1);
}
