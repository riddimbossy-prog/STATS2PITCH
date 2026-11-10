import type { Lineup, LineupPlayer, Match, MatchDetail, MatchStatus, NamedRef, RawIncident, ResultRow, TeamRef } from '../domain';

/**
 * The only module allowed to talk to Sofascore.
 * Swap the base URL, or replace createSofascoreSource, when a licensed feed exists.
 * Sofascore has no official public API. Calls are cached, spaced out, and fail soft.
 */

const DEFAULT_BASE = 'https://api.sofascore.com/api/v1';
const LIVE_TTL = 8_000;
const SCHEDULE_TTL = 120_000;
const EVENT_TTL = 30_000;
const INCIDENT_TTL = 8_000;
const LINEUP_TTL = 60_000;
const FINISHED_LINEUP_TTL = 24 * 60 * 60 * 1000;
const TEAM_TTL = 6 * 60 * 60 * 1000;
const ODDS_TTL = 10 * 60 * 1000;

const SOFASCORE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

export interface CacheRow {
  payload: string;
  fetchedAt: number;
  ttlMs: number;
}

export interface CacheStore {
  get(key: string): Promise<CacheRow | null>;
  set(key: string, payload: string, ttlMs: number, fetchedAt: number): Promise<void>;
}

export interface SourceResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: number | null;
}

export interface DataSource {
  readonly id: 'sofascore';
  scheduled(date: string, fresh?: boolean): Promise<SourceResult<Match[]>>;
  live(fresh?: boolean): Promise<SourceResult<Match[]>>;
  match(id: string, fresh?: boolean): Promise<SourceResult<MatchDetail>>;
  teamResults(teamId: string, fresh?: boolean): Promise<SourceResult<ResultRow[]>>;
  recentLineups(teamId: string, fresh?: boolean): Promise<SourceResult<string[][]>>;
}

export type FetchJson = (url: string) => Promise<unknown>;

export function memoryCache(): CacheStore {
  const rows = new Map<string, CacheRow>();
  return {
    async get(key) {
      return rows.get(key) ?? null;
    },
    async set(key, payload, ttlMs, fetchedAt) {
      rows.set(key, { payload, fetchedAt, ttlMs });
    },
  };
}

export function sofascoreBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SOFASCORE_BASE_URL;
  return (configured && configured.replace(/\/$/, '')) || DEFAULT_BASE;
}

export async function defaultFetchJson(url: string): Promise<unknown> {
  let last = 'Sofascore request failed';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { headers: SOFASCORE_HEADERS, signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        last = `Sofascore ${response.status}`;
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'Sofascore refused the request (403). The unofficial feed sometimes blocks a network.'
            : `Sofascore ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Sofascore')) throw error;
      last = error instanceof Error ? error.message : last;
      if (attempt === 2) throw new Error(last);
      await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

class RequestGate {
  private chain: Promise<void> = Promise.resolve();
  private nextAt = 0;

  constructor(private readonly gapMs: number) {}

  wait(): Promise<void> {
    const job = this.chain.then(async () => {
      const delay = Math.max(0, this.nextAt - Date.now());
      if (delay) await sleep(delay);
      this.nextAt = Date.now() + this.gapMs;
    });
    this.chain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }
}

export function createSofascoreSource(options?: {
  fetchJson?: FetchJson;
  cache?: CacheStore;
  now?: () => number;
  baseUrl?: string;
  gapMs?: number;
}): DataSource {
  const fetchJson = options?.fetchJson ?? defaultFetchJson;
  const cache = options?.cache ?? memoryCache();
  const now = options?.now ?? Date.now;
  const baseUrl = (options?.baseUrl ?? sofascoreBaseUrl()).replace(/\/$/, '');
  const gate = new RequestGate(options?.gapMs ?? 350);

  async function pull(path: string): Promise<unknown> {
    await gate.wait();
    return fetchJson(`${baseUrl}${path}`);
  }

  async function cached<T>(key: string, ttlMs: number, fresh: boolean | undefined, load: () => Promise<T>): Promise<SourceResult<T>> {
    const hit = await cache.get(key);
    const fetchedAt = hit?.fetchedAt ?? null;
    const freshEnough = Boolean(hit) && now() - (hit?.fetchedAt ?? 0) < (hit?.ttlMs ?? 0);
    if (hit && freshEnough && !fresh) {
      return { ok: true, data: JSON.parse(hit.payload) as T, fromCache: true, stale: false, fetchedAt };
    }
    try {
      const data = await load();
      const stamped = now();
      await cache.set(key, JSON.stringify(data), ttlMs, stamped);
      return { ok: true, data, fromCache: false, stale: false, fetchedAt: stamped };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sofascore request failed';
      if (hit) {
        return { ok: false, data: JSON.parse(hit.payload) as T, error: message, fromCache: true, stale: true, fetchedAt };
      }
      return { ok: false, data: null, error: message, fromCache: false, stale: false, fetchedAt: null };
    }
  }

  return {
    id: 'sofascore',
    scheduled(date, fresh) {
      return cached(`scheduled:${date}`, SCHEDULE_TTL, fresh, async () => {
        const payload = await pull(`/sport/football/scheduled-events/${date}`);
        return mapEvents(payload);
      });
    },
    live(fresh) {
      return cached('live', LIVE_TTL, fresh, async () => {
        const payload = await pull('/sport/football/events/live');
        return mapEvents(payload);
      });
    },
    async match(id, fresh) {
      const eventResult = await cached(`event:${id}`, EVENT_TTL, fresh, async () => mapEvent(await pull(`/event/${id}`)));
      if (!eventResult.data) return { ...eventResult, data: null };
      const [incidents, lineups, odds] = await Promise.all([
        cached(`incidents:${id}`, INCIDENT_TTL, fresh, async () => mapIncidents(await pull(`/event/${id}/incidents`))),
        cached(`lineups:${id}`, lineupsTtl(eventResult.data.status), fresh, async () => mapLineups(await pull(`/event/${id}/lineups`))),
        cached(`odds:${id}`, ODDS_TTL, fresh, async () => mapOdds(await pull(`/event/${id}/odds/1/all`))),
      ]);
      const detail: MatchDetail = {
        ...eventResult.data,
        incidents: incidents.data ?? [],
        lineups: lineups.data ?? { home: null, away: null },
        odds: odds.data ?? {},
      };
      const error = [eventResult.error, incidents.error, lineups.error, odds.error].filter(Boolean).join(' ');
      return {
        ok: eventResult.ok,
        data: detail,
        error: error || undefined,
        fromCache: eventResult.fromCache && incidents.fromCache,
        stale: eventResult.stale || incidents.stale,
        fetchedAt: eventResult.fetchedAt,
      };
    },
    teamResults(teamId, fresh) {
      return cached(`team:${teamId}`, TEAM_TTL, fresh, async () => mapTeamResults(await pull(`/team/${teamId}/events/last/0`), teamId));
    },
    recentLineups(teamId, fresh) {
      return cached(`recent-xi:${teamId}`, TEAM_TTL, fresh, async () => {
        const payload = await pull(`/team/${teamId}/events/last/0`);
        const events = eventRecords(payload)
          .filter((event) => mapStatus(asString(asRecord(event.status)?.type)) === 'finished')
          .sort((a, b) => (asNumber(b.startTimestamp) ?? 0) - (asNumber(a.startTimestamp) ?? 0))
          .slice(0, 5);
        const lineups: string[][] = [];
        for (const event of events) {
          const id = asString(event.id);
          if (!id) continue;
          try {
            const payloadLineups = await pull(`/event/${id}/lineups`);
            const names = starterNames(mapLineups(payloadLineups), teamId, event);
            if (names.length) lineups.push(names);
          } catch {
            // A missing lineup does not fail the whole squad read.
          }
        }
        return lineups;
      });
    },
  };
}

function lineupsTtl(status: MatchStatus): number {
  return status === 'finished' ? FINISHED_LINEUP_TTL : LINEUP_TTL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function fractionalToDecimal(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const denominator = Number(match[2]);
  if (!denominator) return null;
  return Number(match[1]) / denominator + 1;
}

export function mapStatus(type: string | null): MatchStatus {
  switch ((type ?? '').toLowerCase()) {
    case 'inprogress':
    case 'interrupted':
      return 'live';
    case 'finished':
      return 'finished';
    case 'postponed':
    case 'delayed':
      return 'postponed';
    case 'canceled':
    case 'cancelled':
    case 'abandoned':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

export function mapEvents(payload: unknown): Match[] {
  return eventRecords(payload)
    .map((event) => mapEvent(event))
    .filter((event): event is Match => event != null);
}

function eventRecords(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const list = asArray(root?.events ?? root?.event ?? payload);
  return list.map(asRecord).filter((event): event is Record<string, unknown> => event != null);
}

export function mapEvent(payload: unknown): Match | null {
  const root = asRecord(payload);
  const event = asRecord(root?.event) ?? root;
  if (!event) return null;
  const id = asString(event.id);
  if (!id) return null;
  const status = asRecord(event.status);
  const kind = mapStatus(asString(status?.type));
  const description = asString(status?.description);
  const { competition, league } = mapCompetition(event);
  return {
    id,
    home: mapTeam(event.homeTeam, `${id}-home`),
    away: mapTeam(event.awayTeam, `${id}-away`),
    competition,
    league,
    kickoff: (asNumber(event.startTimestamp) ?? 0) * (asNumber(event.startTimestamp) && asNumber(event.startTimestamp)! < 10_000_000_000 ? 1000 : 1),
    status: kind,
    statusText: description ?? kind,
    minute: minuteOf(event, kind, description),
    feedScore: mapFeedScore(event),
    varPending: false,
  };
}

function minuteOf(event: Record<string, unknown>, status: MatchStatus, description: string | null): string | null {
  if (status !== 'live') return null;
  if (description && /\d/.test(description)) return description;
  const time = asRecord(event.time);
  const start = asNumber(time?.currentPeriodStartTimestamp);
  if (!start) return description;
  const elapsed = Math.max(0, Math.floor((Date.now() / 1000 - start) / 60));
  const offset = description?.toLowerCase().includes('2nd') ? 45 : 0;
  return `${Math.min(130, elapsed + offset)}'`;
}

function mapFeedScore(event: Record<string, unknown>): { home: number; away: number } | null {
  const home = asNumber(asRecord(event.homeScore)?.current) ?? asNumber(asRecord(event.homeScore)?.display);
  const away = asNumber(asRecord(event.awayScore)?.current) ?? asNumber(asRecord(event.awayScore)?.display);
  if (home == null && away == null) return null;
  return { home: home ?? 0, away: away ?? 0 };
}

function mapTeam(value: unknown, fallback: string): TeamRef {
  const team = asRecord(value);
  const name = asString(team?.name) ?? asString(team?.shortName) ?? 'Team';
  return {
    id: asString(team?.id) ?? fallback,
    name,
    shortName: asString(team?.nameCode) ?? asString(team?.shortName) ?? name.slice(0, 3).toUpperCase(),
  };
}

function mapCompetition(event: Record<string, unknown>): { competition: NamedRef; league: NamedRef } {
  const tournament = asRecord(event.tournament);
  const unique = asRecord(tournament?.uniqueTournament);
  const category = asRecord(tournament?.category) ?? asRecord(unique?.category);
  const competition = {
    id: asString(unique?.id) ?? asString(tournament?.id) ?? 'competition',
    name: asString(unique?.name) ?? asString(tournament?.name) ?? 'Competition',
  };
  const league = {
    id: asString(category?.id) ?? competition.id,
    name: asString(category?.name) ?? competition.name,
  };
  return { competition, league };
}

export function mapIncidents(payload: unknown): RawIncident[] {
  const root = asRecord(payload);
  return asArray(root?.incidents ?? payload)
    .map((item, index) => mapIncident(item, index))
    .filter((item): item is RawIncident => item != null);
}

function mapIncident(value: unknown, index: number): RawIncident | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const incidentType = (asString(raw.incidentType) ?? '').toLowerCase();
  const incidentClass = (asString(raw.incidentClass) ?? '').toLowerCase();
  const id = asString(raw.id) ?? `inc-${index}`;
  const minute = asNumber(raw.time) ?? asNumber(raw.minute);
  const isHome = typeof raw.isHome === 'boolean' ? raw.isHome : null;
  const player = asString(asRecord(raw.player)?.name) ?? asString(asRecord(raw.playerIn)?.name) ?? undefined;
  if (incidentType === 'goal') {
    const rescinded = raw.rescinded === true;
    return {
      id,
      type: 'goal',
      minute,
      isHome,
      player,
      confirmed: rescinded ? false : raw.confirmed !== false,
      varState: rescinded ? 'pending' : undefined,
    };
  }
  if (incidentType === 'vardecision' || incidentType === 'var') {
    return {
      id,
      type: 'var',
      minute,
      isHome,
      player,
      varState: varStateOf(incidentClass, raw.confirmed),
      text: asString(raw.description) ?? undefined,
    };
  }
  if (incidentType === 'card') {
    return { id, type: 'card', minute, isHome, player, card: incidentClass.includes('red') ? 'red' : 'yellow' };
  }
  if (incidentType === 'substitution') return { id, type: 'substitution', minute, isHome, player };
  if (incidentType === 'period') return { id, type: 'period', minute, isHome, text: asString(raw.text) ?? 'Period' };
  const text = asString(raw.text);
  return text ? { id, type: 'other', minute, isHome, text } : null;
}

function varStateOf(incidentClass: string, confirmed: unknown): RawIncident['varState'] {
  const negative = /not|cancel|disallow|rescind/.test(incidentClass);
  if (confirmed !== true) return 'pending';
  return negative ? 'disallowed' : 'awarded';
}

export function mapLineups(payload: unknown): { home: Lineup | null; away: Lineup | null } {
  const root = asRecord(payload);
  return { home: mapLineupSide(root?.home), away: mapLineupSide(root?.away) };
}

function mapLineupSide(value: unknown): Lineup | null {
  const side = asRecord(value);
  if (!side) return null;
  const starters: LineupPlayer[] = [];
  const bench: LineupPlayer[] = [];
  for (const item of asArray(side.players)) {
    const row = asRecord(item);
    const player = asRecord(row?.player);
    const name = asString(player?.name);
    if (!row || !name) continue;
    const entry: LineupPlayer = {
      id: asString(player?.id) ?? name,
      name,
      position: asString(row.position) ?? asString(player?.position) ?? undefined,
    };
    if (row.substitute === true) bench.push(entry);
    else starters.push(entry);
  }
  if (!starters.length && !bench.length) return null;
  return { formation: asString(side.formation), starters, bench };
}

export function mapTeamResults(payload: unknown, teamId: string): ResultRow[] {
  const events = eventRecords(payload)
    .filter((event) => mapStatus(asString(asRecord(event.status)?.type)) === 'finished')
    .sort((a, b) => (asNumber(b.startTimestamp) ?? 0) - (asNumber(a.startTimestamp) ?? 0));
  const rows: ResultRow[] = [];
  for (const event of events) {
    const homeId = asString(asRecord(event.homeTeam)?.id);
    const isHome = homeId === teamId;
    const goalsFor = asNumber(asRecord(isHome ? event.homeScore : event.awayScore)?.current);
    const goalsAgainst = asNumber(asRecord(isHome ? event.awayScore : event.homeScore)?.current);
    if (goalsFor == null || goalsAgainst == null) continue;
    rows.push({ goalsFor, goalsAgainst, venue: isHome ? 'home' : 'away' });
  }
  return rows;
}

function starterNames(lineups: { home: Lineup | null; away: Lineup | null }, teamId: string, event: Record<string, unknown>): string[] {
  const homeId = asString(asRecord(event.homeTeam)?.id);
  const side = homeId === teamId ? lineups.home : lineups.away;
  return side?.starters.map((player) => player.name) ?? [];
}

export function mapOdds(payload: unknown): Partial<Record<string, number>> {
  const odds: Partial<Record<string, number>> = {};
  for (const market of collectMarkets(payload, 0)) {
    const name = market.name.toLowerCase();
    for (const choice of market.choices) {
      const key = oddsKey(name, choice.name.toLowerCase());
      if (key && choice.decimal > 1 && odds[key] == null) odds[key] = Math.round(choice.decimal * 100) / 100;
    }
  }
  return odds;
}

function oddsKey(market: string, choice: string): string | null {
  if (market.includes('both') || market.includes('btts')) {
    if (choice === 'yes' || choice === 'gg') return 'btts';
    if (choice === 'no' || choice === 'ng') return 'btts_no';
  }
  const line = choice.match(/(over|under)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (line && (market.includes('goal') || market.includes('over') || market.includes('total') || market.includes('under'))) {
    const [, side, value] = line;
    if (side === 'over' && value === '1.5') return 'over_1_5';
    if (side === 'over' && value === '2.5') return 'over_2_5';
    if (side === 'over' && value === '3.5') return 'over_3_5';
    if (side === 'under' && value === '2.5') return 'under_2_5';
  }
  const oneXtwo = market.includes('full time') || market.includes('1x2') || market.includes('winner') || market === 'ft';
  if (oneXtwo) {
    if (choice === '1' || choice === 'home') return 'home:team_win';
    if (choice === 'x' || choice === 'draw') return 'draw';
    if (choice === '2' || choice === 'away') return 'away:team_win';
  }
  return null;
}

function collectMarkets(value: unknown, depth: number): { name: string; choices: { name: string; decimal: number }[] }[] {
  if (depth > 6 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectMarkets(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  const found: { name: string; choices: { name: string; decimal: number }[] }[] = [];
  const parsed = asArray(record.choices)
    .map((choice) => {
      const row = asRecord(choice);
      if (!row) return null;
      const name = asString(row.name);
      const decimal = choiceDecimal(row);
      if (!name || decimal == null) return null;
      return { name, decimal };
    })
    .filter((choice): choice is { name: string; decimal: number } => choice != null);
  const name = asString(record.marketName) ?? asString(record.name) ?? '';
  if (name && parsed.length) found.push({ name, choices: parsed });
  for (const [key, child] of Object.entries(record)) {
    if (key === 'choices') continue;
    found.push(...collectMarkets(child, depth + 1));
  }
  return found;
}

function choiceDecimal(choice: Record<string, unknown>): number | null {
  const direct = asNumber(choice.decimalValue) ?? asNumber(choice.decimal) ?? asNumber(choice.odds);
  if (direct && direct > 1) return direct;
  const fractional = asString(choice.fractionalValue) ?? asString(choice.initialFractionalValue);
  return fractional ? fractionalToDecimal(fractional) : null;
}
