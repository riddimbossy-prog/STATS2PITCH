import type { LegStatus, MarketId, MatchStatus, Side } from '../domain';
import { marketSettled, type Score } from './settlement';

export interface Notice {
  key: string;
  title: string;
  body: string;
  tone: 'var' | 'goal' | 'landed' | 'bust';
}

export interface Snapshot {
  score: Score;
  varPending: boolean;
  status: MatchStatus;
}

export interface TrackedSnapshot {
  id: string;
  label: string;
  market: MarketId;
  side: Side;
  status: LegStatus;
}

/**
 * Goal notifications wait until a score change is confirmed.
 * While a check is pending the only notice is VAR, using the confirmed score.
 * The first snapshot of a match does not invent a goal that was already on the board.
 */
export function noticesForTransition(input: {
  matchId: string;
  homeName: string;
  awayName: string;
  prev: Snapshot | null;
  next: Snapshot;
  tracked: TrackedSnapshot[];
}): { notices: Notice[]; tracked: TrackedSnapshot[] } {
  const notices: Notice[] = [];
  const { prev, next } = input;
  if (prev) {
    const scoreUp = next.score.home + next.score.away > prev.score.home + prev.score.away;
    const varStarted = next.varPending && !prev.varPending;
    const varCleared = prev.varPending && !next.varPending;
    if (varStarted) {
      notices.push({
        key: `${input.matchId}:var:${next.score.home}-${next.score.away}:${next.status}`,
        title: 'VAR',
        body: `${input.homeName} ${next.score.home}-${next.score.away} ${input.awayName}. The goal is not awarded yet.`,
        tone: 'var',
      });
    }
    if (!next.varPending && scoreUp) {
      notices.push({
        key: `${input.matchId}:goal:${next.score.home}-${next.score.away}`,
        title: varCleared ? 'Goal confirmed' : 'Goal',
        body: `${input.homeName} ${next.score.home}-${next.score.away} ${input.awayName}`,
        tone: 'goal',
      });
    }
  }

  const tracked = input.tracked.map((pick) => {
    const status = marketSettled(pick.market, pick.side, next.score, next.status);
    if (status !== pick.status && status !== 'pending') {
      notices.push({
        key: `pick:${pick.id}:${status}`,
        title: status === 'won' ? 'Tip landed' : status === 'lost' ? 'Tip bust' : 'Tip void',
        body: `${pick.label} · ${input.homeName} vs ${input.awayName}`,
        tone: status === 'lost' ? 'bust' : 'landed',
      });
    }
    return { ...pick, status };
  });

  return { notices, tracked };
}

export function slipNotices(input: {
  slips: { id: string; code: string | null; previous: 'open' | 'won' | 'lost' | 'void'; next: 'open' | 'won' | 'lost' | 'void' }[];
}): Notice[] {
  const notices: Notice[] = [];
  for (const slip of input.slips) {
    if (slip.previous === slip.next) continue;
    if (slip.next !== 'won' && slip.next !== 'lost' && slip.next !== 'void') continue;
    const code = slip.code ?? slip.id.slice(0, 8);
    notices.push({
      key: `slip:${slip.id}:${slip.next}`,
      title: slip.next === 'won' ? 'Booking landed' : slip.next === 'lost' ? 'Booking bust' : 'Booking void',
      body: code,
      tone: slip.next === 'lost' ? 'bust' : 'landed',
    });
  }
  return notices;
}
