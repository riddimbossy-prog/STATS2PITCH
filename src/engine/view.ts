import type { Match, MatchDetail } from '../domain';
import type { Snapshot } from './notify';
import { assessVar } from './var';

/** Confirmed score for display and settlement. Pending VAR goals stay off the score. */
export function confirmedBoard(match: Match, detail?: MatchDetail): Snapshot {
  if (detail) {
    const assessed = assessVar(detail.incidents, detail.feedScore ?? match.feedScore);
    return { score: assessed.score, varPending: assessed.varPending, status: detail.status || match.status };
  }
  return {
    score: match.feedScore ?? { home: 0, away: 0 },
    varPending: match.varPending,
    status: match.status,
  };
}
