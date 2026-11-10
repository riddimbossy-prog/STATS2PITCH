export type MarketId =
  | 'over_1_5'
  | 'over_2_5'
  | 'over_3_5'
  | 'under_2_5'
  | 'btts'
  | 'btts_no'
  | 'draw'
  | 'team_win'
  | 'team_over_1_5'
  | 'clean_sheet'
  | 'team_scored';

export type Side = 'home' | 'away' | 'match';
export type Venue = 'home' | 'away';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
export type PickKind = 'trend' | 'form';
export type ConfidenceBand = 'elite' | 'strong' | 'solid' | 'qualifying' | 'watch';
export type LegStatus = 'pending' | 'won' | 'lost' | 'void';
export type ListKind = 'black' | 'green';
export type ListScope = 'team' | 'league' | 'competition' | 'market';
export type SquadStrength = 'full' | 'half' | 'mixed' | 'unknown';
export type GradeLetter = 'A+' | 'A' | 'B' | 'C' | 'D';
export type GradePeriod = 'week' | 'month' | 'year';

export interface ResultRow {
  goalsFor: number;
  goalsAgainst: number;
  venue: Venue;
}

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  home: TeamRef;
  away: TeamRef;
  competition: NamedRef;
  league: NamedRef;
  kickoff: number;
  status: MatchStatus;
  statusText: string;
  minute: string | null;
  feedScore: { home: number; away: number } | null;
  varPending: boolean;
}

export interface RawIncident {
  id: string;
  type: 'goal' | 'card' | 'substitution' | 'var' | 'period' | 'other';
  minute: number | null;
  isHome: boolean | null;
  player?: string;
  card?: 'yellow' | 'red';
  confirmed?: boolean;
  varState?: 'pending' | 'awarded' | 'disallowed';
  text?: string;
}

export interface LineupPlayer {
  id: string;
  name: string;
  position?: string;
}

export interface Lineup {
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchDetail extends Match {
  incidents: RawIncident[];
  lineups: { home: Lineup | null; away: Lineup | null };
  odds: Partial<Record<string, number>>;
}

export interface ListEntry {
  id: string;
  kind: ListKind;
  scope: ListScope;
  refId: string;
  name: string;
  source: 'manual' | 'auto';
  reason: string | null;
  createdAt: number;
}

export interface TrackedPick {
  id: string;
  matchId: string;
  marketKey: string;
  market: MarketId;
  side: Side;
  label: string;
  teamId: string;
  teamName: string;
  opponentName: string;
  competitionId: string;
  competitionName: string;
  leagueId: string;
  leagueName: string;
  odds: number | null;
  confidence: number;
  teamRate: number;
  formRate: number;
  kind: PickKind;
  status: LegStatus;
  kickoff: number;
  settledAt: number | null;
  createdAt: number;
}

export interface SlipLeg {
  id: string;
  pickId: string;
  matchId: string;
  market: MarketId;
  side: Side;
  label: string;
  odds: number | null;
  status: LegStatus;
}

export interface Slip {
  id: string;
  bookieId: string;
  bookieName: string;
  code: string | null;
  stub: boolean;
  stubMessage: string | null;
  stake: number | null;
  status: 'open' | 'won' | 'lost' | 'void';
  createdAt: number;
  settledAt: number | null;
  legs: SlipLeg[];
}
