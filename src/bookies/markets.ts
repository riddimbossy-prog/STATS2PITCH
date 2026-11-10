import type { MarketId, Side } from '../domain';

/** Betradar selection before the SportyBet event id is known. */
export interface MarketSelection {
  marketId: string;
  specifier: string;
  outcomeId: string;
  label: string;
}

/**
 * SportyBet / Betradar ids used by Predict2u:
 * 1 = 1X2 (1 home, 2 draw, 3 away), 18 = totals (12 over, 13 under),
 * 19/20 = team totals, 29 = BTTS (74 yes, 76 no).
 */
export function selectionFor(market: MarketId, side: Side): MarketSelection | null {
  if (market === 'over_1_5') return line('18', '1.5', '12', 'Over 1.5');
  if (market === 'over_2_5') return line('18', '2.5', '12', 'Over 2.5');
  if (market === 'over_3_5') return line('18', '3.5', '12', 'Over 3.5');
  if (market === 'under_2_5') return line('18', '2.5', '13', 'Under 2.5');
  if (market === 'btts') return { marketId: '29', specifier: '', outcomeId: '74', label: 'BTTS Yes' };
  if (market === 'btts_no') return { marketId: '29', specifier: '', outcomeId: '76', label: 'BTTS No' };
  if (market === 'draw') return { marketId: '1', specifier: '', outcomeId: '2', label: 'Draw' };
  if (market === 'team_win' && side === 'home') return { marketId: '1', specifier: '', outcomeId: '1', label: 'Home' };
  if (market === 'team_win' && side === 'away') return { marketId: '1', specifier: '', outcomeId: '3', label: 'Away' };
  if (market === 'team_over_1_5' && side === 'home') return line('19', '1.5', '12', 'Home over 1.5');
  if (market === 'team_over_1_5' && side === 'away') return line('20', '1.5', '12', 'Away over 1.5');
  if (market === 'team_scored' && side === 'home') return line('19', '0.5', '12', 'Home over 0.5');
  if (market === 'team_scored' && side === 'away') return line('20', '0.5', '12', 'Away over 0.5');
  if (market === 'clean_sheet' && side === 'home') return line('20', '0.5', '13', 'Away under 0.5');
  if (market === 'clean_sheet' && side === 'away') return line('19', '0.5', '13', 'Home under 0.5');
  return null;
}

function line(marketId: string, total: string, outcomeId: string, label: string): MarketSelection {
  return { marketId, specifier: `total=${total}`, outcomeId, label };
}

export interface BetradarLeg {
  eventId: string;
  marketId: string;
  specifier: string;
  outcomeId: string;
  odds: number | null;
  match: string;
  pickId?: string;
}

export function shareLink(bookie: string, code: string): string {
  if (bookie === 'sportybet') return `https://www.sportybet.com/gh/?shareCode=${encodeURIComponent(code)}`;
  if (bookie === 'football') return `https://www.football.com/gh/?shareCode=${encodeURIComponent(code)}`;
  if (bookie === 'msport') return `https://www.msport.com/gh/?shareCode=${encodeURIComponent(code)}`;
  if (bookie === 'betika') return `https://www.betika.com/en-gh/share/${encodeURIComponent(code)}`;
  if (bookie === 'betpawa') return `https://www.betpawa.com.gh/share-betslip/${encodeURIComponent(code)}`;
  return code;
}
