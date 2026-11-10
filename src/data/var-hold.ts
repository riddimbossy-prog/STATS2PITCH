import type { RawIncident } from '../domain';

/** A new SportyBet score is held this long before it counts as a goal. */
export const GOAL_HOLD_MS = 45_000;

export interface ScoreLine {
  home: number;
  away: number;
}

export interface HoldState {
  confirmed: ScoreLine;
  pending: (ScoreLine & { since: number }) | null;
  seen: boolean;
}

/**
 * SportyBet's public event payload has a score. A timeline row can still say VAR.
 * The first score we see is accepted. A later increase is shown as VAR and is not
 * awarded until it is still on the board after the hold, or until a VAR-confirmed
 * timeline row arrives. If the score falls back, the check is disallowed.
 */
export function stepScore(
  previous: HoldState | undefined,
  feed: ScoreLine,
  now: number,
  holdMs = GOAL_HOLD_MS,
): { state: HoldState; varPending: boolean; incidents: RawIncident[] } {
  if (!previous?.seen) {
    return {
      state: { confirmed: feed, pending: null, seen: true },
      varPending: false,
      incidents: [],
    };
  }
  const confirmedTotal = previous.confirmed.home + previous.confirmed.away;
  const feedTotal = feed.home + feed.away;
  if (feedTotal > confirmedTotal) {
    const samePending = previous.pending && previous.pending.home === feed.home && previous.pending.away === feed.away;
    const pending = samePending && previous.pending ? previous.pending : { ...feed, since: now };
    if (now - pending.since >= holdMs) {
      return {
        state: { confirmed: feed, pending: null, seen: true },
        varPending: false,
        incidents: [
          {
            id: `goal-${feed.home}-${feed.away}`,
            type: 'goal',
            minute: null,
            isHome: feed.home > previous.confirmed.home ? true : feed.away > previous.confirmed.away ? false : null,
            confirmed: true,
            player: 'Goal confirmed',
          },
        ],
      };
    }
    return {
      state: { confirmed: previous.confirmed, pending, seen: true },
      varPending: true,
      incidents: [
        {
          id: `var-${feed.home}-${feed.away}`,
          type: 'var',
          minute: null,
          isHome: feed.home !== previous.confirmed.home ? true : false,
          varState: 'pending',
          text: 'Score check',
        },
      ],
    };
  }
  if (previous.pending) {
    return {
      state: { confirmed: feedTotal < confirmedTotal ? feed : previous.confirmed, pending: null, seen: true },
      varPending: false,
      incidents: [
        {
          id: `var-off-${previous.pending.since}`,
          type: 'var',
          minute: null,
          isHome: null,
          varState: 'disallowed',
          text: 'Score reversed',
        },
      ],
    };
  }
  return {
    state: { confirmed: feed, pending: null, seen: true },
    varPending: false,
    incidents: [],
  };
}
