import type { Lineup, Match, MatchDetail, ResultRow, TeamRef, TrackedPick } from '../domain';

const team = (id: string, name: string, shortName: string): TeamRef => ({ id, name, shortName });
const row = (goalsFor: number, goalsAgainst: number, venue: 'home' | 'away'): ResultRow => ({
  goalsFor,
  goalsAgainst,
  venue,
});
const times = (count: number, item: ResultRow): ResultRow[] => Array.from({ length: count }, () => ({ ...item }));

const ARSENAL_USUAL = ['Raya', 'White', 'Saliba', 'Gabriel', 'Calafiori', 'Odegaard', 'Rice', 'Havertz', 'Saka', 'Martinelli', 'Trossard'];
const ARSENAL_TODAY = ['Raya', 'White', 'Saliba', 'Gabriel', 'Calafiori', 'Jorginho', 'Merino', 'Nwaneri', 'Sterling', 'Jesus', 'Havertz'];
const CHELSEA_USUAL = ['Sanchez', 'Gusto', 'Fofana', 'Colwill', 'Cucurella', 'Caicedo', 'Enzo', 'Palmer', 'Neto', 'Jackson', 'Madueke'];
const CHELSEA_TODAY = ['Sanchez', 'Gusto', 'Fofana', 'Colwill', 'Cucurella', 'Caicedo', 'Enzo', 'Palmer', 'Neto', 'Jackson', 'Mudryk'];
const NAPOLI_XI = ['Meret', 'Di Lorenzo', 'Rrahmani', 'Buongiorno', 'Olivera', 'Lobotka', 'Anguissa', 'McTominay', 'Kvaratskhelia', 'Lukaku', 'Politano'];
const ROMA_XI = ['Svilar', 'Mancini', 'Ndicka', 'Hermoso', 'Angelino', 'Cristante', 'Paredes', 'Pellegrini', 'Dybala', 'Dovbyk', 'Saelemaekers'];

function lineup(names: string[]): Lineup {
  return {
    formation: '4-3-3',
    starters: names.map((name, index) => ({ id: name.toLowerCase(), name, position: index === 0 ? 'G' : 'M' })),
    bench: [{ id: 'bench', name: 'Bench', position: 'F' }],
  };
}

function base(now: number): { matches: Match[]; details: Record<string, MatchDetail> } {
  const pl = { id: 'pl', name: 'Premier League' };
  const eng = { id: 'eng', name: 'England' };
  const sa = { id: 'sa', name: 'Serie A' };
  const ita = { id: 'ita', name: 'Italy' };
  const matches: Match[] = [
    {
      id: 'ars-che',
      home: team('ars', 'Arsenal', 'ARS'),
      away: team('che', 'Chelsea', 'CHE'),
      competition: pl,
      league: eng,
      kickoff: now - 71 * 60 * 1000,
      status: 'live',
      statusText: "71'",
      minute: "71'",
      feedScore: { home: 2, away: 1 },
      varPending: true,
    },
    {
      id: 'nap-rom',
      home: team('nap', 'Napoli', 'NAP'),
      away: team('rom', 'Roma', 'ROM'),
      competition: sa,
      league: ita,
      kickoff: now - 22 * 60 * 1000,
      status: 'live',
      statusText: "22'",
      minute: "22'",
      feedScore: { home: 0, away: 0 },
      varPending: false,
    },
    {
      id: 'bri-wol',
      home: team('bri', 'Brighton', 'BRI'),
      away: team('wol', 'Wolves', 'WOL'),
      competition: pl,
      league: eng,
      kickoff: now + 2 * 60 * 60 * 1000,
      status: 'scheduled',
      statusText: 'Not started',
      minute: null,
      feedScore: null,
      varPending: false,
    },
    {
      id: 'bur-lut',
      home: team('bur', 'Burnley', 'BUR'),
      away: team('lut', 'Luton', 'LUT'),
      competition: pl,
      league: eng,
      kickoff: now + 5 * 60 * 60 * 1000,
      status: 'scheduled',
      statusText: 'Not started',
      minute: null,
      feedScore: null,
      varPending: false,
    },
    {
      id: 'liv-spu',
      home: team('liv', 'Liverpool', 'LIV'),
      away: team('spu', 'Spurs', 'TOT'),
      competition: pl,
      league: eng,
      kickoff: now - 5 * 60 * 60 * 1000,
      status: 'finished',
      statusText: 'Full time',
      minute: null,
      feedScore: { home: 2, away: 0 },
      varPending: false,
    },
  ];

  const details: Record<string, MatchDetail> = {
    'ars-che': {
      ...matches[0]!,
      odds: { over_2_5: 1.72, btts: 1.66, 'home:team_over_1_5': 1.85, 'home:team_win': 1.55 },
      lineups: { home: lineup(ARSENAL_TODAY), away: lineup(CHELSEA_TODAY) },
      incidents: [
        { id: 'g1', type: 'goal', minute: 12, isHome: true, player: 'Saka', confirmed: true },
        { id: 'c1', type: 'card', minute: 28, isHome: false, player: 'Caicedo', card: 'yellow' },
        { id: 'g2', type: 'goal', minute: 34, isHome: false, player: 'Palmer', confirmed: true },
        { id: 'g3', type: 'goal', minute: 55, isHome: true, player: 'Martinelli', confirmed: true },
        { id: 'v1', type: 'var', minute: 71, isHome: true, varState: 'pending', text: 'Goal check' },
      ],
    },
    'nap-rom': {
      ...matches[1]!,
      odds: { 'home:team_win': 1.48, over_2_5: 2.05 },
      lineups: { home: lineup(NAPOLI_XI), away: lineup(ROMA_XI) },
      incidents: [{ id: 'n1', type: 'period', minute: 1, isHome: null, text: 'Kickoff' }],
    },
    'bri-wol': {
      ...matches[2]!,
      odds: { over_2_5: 1.95 },
      lineups: { home: null, away: null },
      incidents: [],
    },
    'bur-lut': {
      ...matches[3]!,
      odds: { under_2_5: 1.44 },
      lineups: { home: null, away: null },
      incidents: [],
    },
    'liv-spu': {
      ...matches[4]!,
      odds: { 'home:team_win': 1.38, over_2_5: 1.7 },
      lineups: { home: lineup(['Alisson', 'Alexander-Arnold', 'Konate', 'Van Dijk', 'Robertson', 'Gravenberch', 'Mac Allister', 'Szoboszlai', 'Salah', 'Diaz', 'Gakpo']), away: null },
      incidents: [
        { id: 'l1', type: 'goal', minute: 18, isHome: true, player: 'Salah', confirmed: true },
        { id: 'l2', type: 'goal', minute: 64, isHome: true, player: 'Diaz', confirmed: true },
      ],
    },
  };
  return { matches, details };
}

export interface SamplePack {
  matches: Match[];
  details: Record<string, MatchDetail>;
  histories: Record<string, ResultRow[]>;
  lineups: Record<string, string[][]>;
}

export function samplePack(now = Date.now()): SamplePack {
  const { matches, details } = base(now);
  const histories: Record<string, ResultRow[]> = {
    ars: [
      row(3, 1, 'home'),
      row(2, 1, 'home'),
      row(2, 1, 'home'),
      row(2, 2, 'home'),
      row(4, 1, 'home'),
      row(1, 1, 'home'),
      row(3, 0, 'home'),
      row(2, 1, 'away'),
      row(0, 0, 'away'),
      row(3, 2, 'home'),
    ],
    che: [...times(9, row(2, 1, 'away')), row(1, 0, 'away')],
    bri: [...times(5, row(2, 1, 'home')), ...times(5, row(1, 0, 'home'))],
    wol: times(10, row(1, 1, 'away')),
    bur: times(10, row(1, 0, 'home')),
    lut: times(10, row(0, 1, 'away')),
    nap: [...times(8, row(2, 0, 'home')), ...times(2, row(1, 1, 'home'))],
    rom: [...times(8, row(0, 1, 'away')), ...times(2, row(1, 0, 'away'))],
    liv: times(9, row(2, 0, 'home')).concat([row(1, 1, 'home')]),
    spu: times(10, row(1, 1, 'away')),
  };
  const copies = (names: string[]) => [names, names, names, names, names];
  return {
    matches,
    details,
    histories,
    lineups: {
      ars: copies(ARSENAL_USUAL),
      che: copies(CHELSEA_USUAL),
      nap: copies(NAPOLI_XI),
      rom: copies(ROMA_XI),
    },
  };
}

export function sampleHistory(now: number): TrackedPick[] {
  const make = (
    id: string,
    market: TrackedPick['market'],
    teamId: string,
    teamName: string,
    competitionId: string,
    competitionName: string,
    leagueId: string,
    leagueName: string,
    status: 'won' | 'lost',
    hoursAgo: number,
  ): TrackedPick => ({
    id,
    matchId: `past-${id}`,
    marketKey: market,
    market,
    side: 'match',
    label: market === 'over_2_5' ? 'Over 2.5' : market === 'btts' ? 'Both teams to score' : `${teamName} win`,
    teamId,
    teamName,
    opponentName: 'Opponent',
    competitionId,
    competitionName,
    leagueId,
    leagueName,
    odds: 1.8,
    confidence: 0.86,
    teamRate: 0.8,
    formRate: 0.8,
    kind: 'trend',
    status,
    kickoff: now - hoursAgo * 60 * 60 * 1000,
    settledAt: now - hoursAgo * 60 * 60 * 1000,
    createdAt: now - (hoursAgo + 2) * 60 * 60 * 1000,
  });
  return [
    make('seed-1', 'over_2_5', 'ars', 'Arsenal', 'pl', 'Premier League', 'eng', 'England', 'won', 2),
    make('seed-2', 'over_2_5', 'ars', 'Arsenal', 'pl', 'Premier League', 'eng', 'England', 'won', 8),
    make('seed-3', 'over_2_5', 'ars', 'Arsenal', 'pl', 'Premier League', 'eng', 'England', 'won', 20),
    make('seed-4', 'over_2_5', 'che', 'Chelsea', 'pl', 'Premier League', 'eng', 'England', 'lost', 30),
    make('seed-5', 'btts', 'rma', 'Real Madrid', 'll', 'La Liga', 'esp', 'Spain', 'lost', 26),
    make('seed-6', 'btts', 'rma', 'Real Madrid', 'll', 'La Liga', 'esp', 'Spain', 'lost', 48),
    make('seed-7', 'btts', 'rma', 'Real Madrid', 'll', 'La Liga', 'esp', 'Spain', 'lost', 72),
    make('seed-8', 'team_win', 'liv', 'Liverpool', 'pl', 'Premier League', 'eng', 'England', 'won', 6),
  ];
}
