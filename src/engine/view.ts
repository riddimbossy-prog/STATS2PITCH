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


/** League row title, e.g. "England - Premier League", without repeating a name already in the competition. */
export function leagueTitle(match: Match): string {
  const competition = match.competition.name.trim();
  const league = match.league.name.trim();
  if (!league || league.toLowerCase() === competition.toLowerCase()) return competition || 'Other';
  if (competition.toLowerCase().startsWith(league.toLowerCase())) return competition;
  return `${league} - ${competition}`;
}

export interface LeagueGroup {
  id: string;
  title: string;
  matches: Match[];
}

/** Group today's (or live) games by competition, with the match count on each row. */
export function groupMatchesByLeague(matches: Match[]): LeagueGroup[] {
  const groups = new Map<string, LeagueGroup>();
  for (const match of matches) {
    const title = leagueTitle(match);
    const id = match.competition.id || title;
    const existing = groups.get(id);
    if (existing) existing.matches.push(match);
    else groups.set(id, { id, title, matches: [match] });
  }
  return [...groups.values()]
    .map((group) => ({ ...group, matches: [...group.matches].sort((a, b) => a.kickoff - b.kickoff) }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
