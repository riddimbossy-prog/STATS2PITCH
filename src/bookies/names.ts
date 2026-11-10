/** Name matching remains for a pasted fixture that has no Betradar id yet. */

const ALIASES: Record<string, string> = {
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'manchester utd': 'manchester united',
  'man city': 'manchester city',
  'spurs': 'tottenham hotspur',
  tottenham: 'tottenham hotspur',
  wolves: 'wolverhampton wanderers',
  wolverhampton: 'wolverhampton wanderers',
  'nottm forest': 'nottingham forest',
  'notts forest': 'nottingham forest',
  psg: 'paris saint germain',
  'paris sg': 'paris saint germain',
  'paris saint-germain': 'paris saint germain',
  inter: 'inter milan',
  'fc internazionale': 'inter milan',
  atletico: 'atletico madrid',
  'atl madrid': 'atletico madrid',
  bayern: 'bayern munich',
  'bayern munchen': 'bayern munich',
  'bayern münchen': 'bayern munich',
  dortmund: 'borussia dortmund',
  leverkusen: 'bayer leverkusen',
  gladbach: 'borussia monchengladbach',
  monchengladbach: 'borussia monchengladbach',
  'mgladbach': 'borussia monchengladbach',
};

const STOP = new Set(['fc', 'cf', 'sc', 'ac', 'afc', 'club', 'cd', 'the', 'de']);

export function normaliseName(name: string): string {
  const ascii = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return ascii
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalName(name: string): string {
  const normalised = normaliseName(name);
  return ALIASES[normalised] ?? normalised;
}

function meaningful(name: string): string[] {
  return canonicalName(name)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function sameTeam(left: string, right: string): boolean {
  const a = canonicalName(left);
  const b = canonicalName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a))) return true;
  const at = meaningful(left);
  const bt = meaningful(right);
  if (!at.length || !bt.length) return false;
  const shared = at.filter((token) => bt.includes(token));
  return shared.length > 0 && shared.length >= Math.min(at.length, bt.length);
}

export interface SportyFixture {
  eventId: string;
  home: string;
  away: string;
  kickoff: number;
}

const KICKOFF_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Home and away must face the same way. Kickoff must sit within three hours when both clocks exist. */
export function findSportyEvent(
  events: SportyFixture[],
  home: string,
  away: string,
  kickoffMs: number,
): SportyFixture | null {
  const hits = events.filter((event) => {
    if (!sameTeam(event.home, home) || !sameTeam(event.away, away)) return false;
    if (!kickoffMs || !event.kickoff) return true;
    return Math.abs(event.kickoff - kickoffMs) <= KICKOFF_WINDOW_MS;
  });
  hits.sort((a, b) => Math.abs(a.kickoff - kickoffMs) - Math.abs(b.kickoff - kickoffMs));
  return hits[0] ?? null;
}
