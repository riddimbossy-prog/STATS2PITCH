import type { Lineup, LineupPlayer, Match, MatchDetail, MatchStatus, RawIncident, ResultRow, TeamRef } from '../domain';
import { localDate } from '../format';
import { stepScore, type HoldState } from './var-hold';

/**
 * The only module allowed to talk to SportyBet.
 * Ghana public factsCenter paths, the same ones Predict2u books and settles with.
 * Calls are cached, spaced out, and a failure returns the last payload when one exists.
 * SportyBet geo-blocks many non-Ghana networks with 403. The phone in Ghana is the client.
 */
const DEFAULT_BASE = 'https://www.sportybet.com/api/gh';

const LIVE_TTL = 8_000;
const SCHEDULE_TTL = 120_000;
const EVENT_TTL = 30_000;
const TEAM_TTL = 6 * 60 * 60_000;

const HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.sportybet.com/gh/',
  Origin: 'https://www.sportybet.com',
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
  readonly id: 'sportybet';
  scheduled(date: string, fresh?: boolean): Promise<SourceResult<Match[]>>;
  live(fresh?: boolean): Promise<SourceResult<Match[]>>;
  match(id: string, fresh?: boolean): Promise<SourceResult<MatchDetail>>;
  teamResults(teamId: string, fresh?: boolean): Promise<SourceResult<ResultRow[]>>;
  recentLineups(teamId: string, fresh?: boolean): Promise<SourceResult<string[][]>>;
}

export interface FetchJson {
  (url: string): Promise<unknown>;
}

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

export function sportybetBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SPORTYBET_BASE_URL;
  return (configured && configured.replace(/\/$/, '')) || DEFAULT_BASE;
}

let bridgeFetch: ((path: string) => Promise<unknown>) | null = null;

/** Native installs this so a 403 can be retried inside a sportybet.com page. Web leaves it unset. */
export function registerSportyBridge(fetchPath: ((path: string) => Promise<unknown>) | null) {
  bridgeFetch = fetchPath;
}

export function sportyPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('sportybet.com')) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export async function defaultFetchJson(url: string): Promise<unknown> {
  try {
    return await directFetchJson(url);
  } catch (directError) {
    const path = sportyPath(url);
    const blocked = directError instanceof Error && /403/.test(directError.message);
    if (bridgeFetch && path && blocked) return bridgeFetch(path);
    throw directError;
  }
}

async function directFetchJson(url: string): Promise<unknown> {
  let last = 'SportyBet request failed';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        last = `SportyBet ${response.status}`;
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'SportyBet refused the request (403). This network is outside Ghana.'
            : `SportyBet ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('SportyBet')) throw error;
      last = error instanceof Error ? error.message : last;
      if (attempt === 2) throw new Error(last);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

class RequestGate {
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly gapMs: number) {}
  wait(): Promise<void> {
    const job = this.chain.then(() => sleep(this.gapMs));
    this.chain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }
}

export function createSportyBetSource(options?: {
  fetchJson?: FetchJson;
  cache?: CacheStore;
  now?: () => number;
  baseUrl?: string;
  gapMs?: number;
}): DataSource {
  const fetchJson = options?.fetchJson ?? defaultFetchJson;
  const cache = options?.cache ?? memoryCache();
  const now = options?.now ?? Date.now;
  const baseUrl = (options?.baseUrl ?? sportybetBaseUrl()).replace(/\/$/, '');
  const gate = new RequestGate(options?.gapMs ?? 350);
  const holds = new Map<string, HoldState>();
  const liveIds = new Set<string>();

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
      const message = error instanceof Error ? error.message : 'SportyBet request failed';
      if (hit) {
        return { ok: false, data: JSON.parse(hit.payload) as T, error: message, fromCache: true, stale: true, fetchedAt };
      }
      return { ok: false, data: null, error: message, fromCache: false, stale: false, fetchedAt: null };
    }
  }

  function applyHold(match: Match, awarded: boolean): Match {
    if (match.status !== 'live' || !match.feedScore) {
      holds.delete(match.id);
      return match;
    }
    const step = stepScore(holds.get(match.id), match.feedScore, now());
    if (awarded && step.varPending && step.state.pending) {
      const confirmed = stepScore(step.state, match.feedScore, now() + 60_000);
      holds.set(match.id, confirmed.state);
      return { ...match, feedScore: confirmed.state.confirmed, varPending: false };
    }
    holds.set(match.id, step.state);
    return { ...match, feedScore: step.state.confirmed, varPending: step.varPending };
  }

  return {
    id: 'sportybet',
    scheduled(date, fresh) {
      return cached(`scheduled:${date}`, SCHEDULE_TTL, fresh, async () => {
        const matches: Match[] = [];
        for (let page = 1; page <= 3; page += 1) {
          const payload = await pull(
            `/factsCenter/pcUpcomingEvents?sportId=${encodeURIComponent('sr:sport:1')}&marketId=1,18,29,10&pageSize=100&pageNum=${page}&option=1`,
          );
          const batch = mapSportyEvents(payload);
          matches.push(...batch);
          if (batch.length < 100) break;
        }
        return matches.filter((match) => match.kickoff > 0 && localDate(new Date(match.kickoff)) === date);
      });
    },
    live(fresh) {
      return cached('live', LIVE_TTL, fresh, async () => {
        const payload = await pull(
          `/factsCenter/liveOrPrematchEvents?sportId=${encodeURIComponent('sr:sport:1')}&marketId=1,18,29&pageSize=100&pageNum=1&productId=1`,
        );
        const matches = mapSportyEvents(payload).map((match) => applyHold(match, varAwarded(payload, match.id)));
        liveIds.clear();
        for (const match of matches) if (match.status === 'live') liveIds.add(match.id);
        return matches.filter((match) => match.status === 'live');
      });
    },
    async match(id, fresh) {
      const product = liveIds.has(id) ? '1' : '3';
      const eventResult = await cached(`event:${id}`, EVENT_TTL, fresh, async () => {
        const payload = await pull(`/factsCenter/event?eventId=${encodeURIComponent(id)}&productId=${product}`);
        const match = mapSportyEvents(payload)[0] ?? null;
        if (!match) throw new Error('SportyBet event had no match');
        const held = applyHold(match, timelineAwards(sportyEvents(payload)[0] ?? {}));
        const raw = sportyEvents(payload)[0] ?? {};
        const detail: MatchDetail = {
          ...held,
          incidents: [...mapTimeline(raw), ...holdIncidents(holds.get(id))],
          lineups: mapLineups(raw),
          odds: held.odds ?? {},
        };
        return detail;
      });
      return eventResult;
    },
    teamResults(teamId, fresh) {
      return cached(`team:${teamId}`, TEAM_TTL, fresh, async () =>
        mapTeamResults(await pull(`/factsCenter/teamEventList?teamId=${encodeURIComponent(teamId)}&pageSize=12&pageNum=1`), teamId),
      );
    },
    recentLineups(teamId, fresh) {
      // factsCenter event and team lists do not publish starting XIs, so squad strength stays unknown.
      void teamId;
      void fresh;
      return Promise.resolve({ ok: true, data: [], fromCache: false, stale: false, fetchedAt: now() });
    },
  };
}

function holdIncidents(state: HoldState | undefined): RawIncident[] {
  if (!state?.pending) return [];
  return [
    {
      id: `var-${state.pending.home}-${state.pending.away}`,
      type: 'var',
      minute: null,
      isHome: null,
      varState: 'pending',
      text: 'Score check',
    },
  ];
}

function varAwarded(payload: unknown, eventId: string): boolean {
  const event = sportyEvents(payload).find((row) => (asString(row.eventId) ?? asString(row.id)) === eventId);
  return event ? timelineAwards(event) : false;
}

function timelineAwards(event: Record<string, unknown>): boolean {
  return mapTimeline(event).some((row) => row.type === 'var' && row.varState === 'awarded');
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

export function sportyEvents(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return [];
  const direct = asArray(data.events ?? data.list ?? data.eventList);
  if (direct.length) {
    return direct.map(asRecord).filter((row): row is Record<string, unknown> => row != null);
  }
  const tournaments = asArray(data.tournaments);
  if (tournaments.length) {
    const rows: Record<string, unknown>[] = [];
    for (const tournament of tournaments) {
      const row = asRecord(tournament);
      if (!row) continue;
      const league = asString(asRecord(row.tournament)?.name) ?? asString(row.name);
      const country = asString(asRecord(row.category)?.name);
      for (const event of asArray(row.events)) {
        const item = asRecord(event);
        if (!item) continue;
        rows.push({ ...item, _league: league, _country: country });
      }
    }
    return rows;
  }
  if (asString(data.eventId) || asString(data.homeTeamName)) return [data];
  return [];
}

export function mapSportyStatus(status: string | null): MatchStatus {
  const text = (status ?? '').toLowerCase().replace(/[_-]/g, ' ');
  if (!text || /not start|notstart|prematch|upcoming|scheduled/.test(text)) return 'scheduled';
  if (/end|finish|full time|closed/.test(text)) return 'finished';
  if (/postpon|delay|suspend/.test(text)) return 'postponed';
  if (/cancel|abandon/.test(text)) return 'cancelled';
  if (/h1|h2|ht|half|live|playing|progress|1st|2nd/.test(text) || /^\d+$/.test(text)) return 'live';
  return 'scheduled';
}

export function parseSetScore(value: unknown): { home: number; away: number } | null {
  const text = asString(value);
  if (!text) return null;
  const match = text.match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

export function mapSportyEvents(payload: unknown): Match[] {
  return sportyEvents(payload)
    .map((event) => mapSportyEvent(event))
    .filter((event): event is Match => event != null);
}

export function mapSportyEvent(event: Record<string, unknown>): Match | null {
  const id = asString(event.eventId) ?? asString(event.id);
  if (!id) return null;
  const statusText = asString(event.matchStatus) ?? asString(event.status) ?? 'Not start';
  const status = mapSportyStatus(statusText);
  const homeName = asString(event.homeTeamName) ?? 'Home';
  const awayName = asString(event.awayTeamName) ?? 'Away';
  const sport = asRecord(event.sport);
  const category = asRecord(sport?.category);
  const tournament = asRecord(category?.tournament) ?? asRecord(event.tournament);
  const competitionName = asString(tournament?.name) ?? asString(event._league) ?? 'Competition';
  const competitionId = asString(tournament?.id) ?? competitionName;
  const leagueName = asString(category?.name) ?? asString(event._country) ?? competitionName;
  const leagueId = asString(category?.id) ?? leagueName;
  const kickoff = asNumber(event.estimateStartTime) ?? asNumber(event.startTime) ?? 0;
  const score = parseSetScore(event.setScore) ?? parseSetScore(asArray(event.gameScore).at(-1));
  return {
    id,
    home: teamRef(asString(event.homeTeamId), homeName, `${id}-home`),
    away: teamRef(asString(event.awayTeamId), awayName, `${id}-away`),
    competition: { id: competitionId, name: competitionName },
    league: { id: leagueId, name: leagueName },
    kickoff,
    status,
    statusText,
    minute: minuteOf(event.playedSeconds, status, statusText),
    feedScore: status === 'scheduled' ? null : score,
    varPending: false,
    odds: mapSportyOdds(event),
  };
}

function teamRef(id: string | null, name: string, fallback: string): TeamRef {
  return { id: id ?? fallback, name, shortName: name.slice(0, 3).toUpperCase() };
}

function minuteOf(played: unknown, status: MatchStatus, statusText: string): string | null {
  if (status !== 'live') return null;
  if (/ht|half time/i.test(statusText)) return 'HT';
  const text = asString(played);
  if (text?.includes(':')) {
    const minute = Number(text.split(':')[0]);
    if (Number.isFinite(minute)) return `${minute}'`;
  }
  const seconds = asNumber(played);
  if (seconds != null && seconds >= 60) return `${Math.floor(seconds / 60)}'`;
  return statusText;
}

export function mapSportyOdds(event: Record<string, unknown>): Partial<Record<string, number>> {
  const odds: Partial<Record<string, number>> = {};
  for (const market of asArray(event.markets)) {
    const row = asRecord(market);
    if (!row) continue;
    const id = asString(row.id) ?? '';
    const total = asString(row.specifier)?.match(/total=([0-9.]+)/)?.[1] ?? '';
    for (const outcome of asArray(row.outcomes)) {
      const choice = asRecord(outcome);
      if (!choice) continue;
      const outcomeId = asString(choice.id) ?? '';
      const price = asNumber(choice.odds);
      if (price == null || price <= 1) continue;
      const key = oddsKey(id, outcomeId, total);
      if (key && odds[key] == null) odds[key] = Math.round(price * 100) / 100;
    }
  }
  return odds;
}

function oddsKey(marketId: string, outcomeId: string, total: string): string | null {
  if (marketId === '1' && outcomeId === '1') return 'home:team_win';
  if (marketId === '1' && outcomeId === '2') return 'draw';
  if (marketId === '1' && outcomeId === '3') return 'away:team_win';
  if (marketId === '18' && total === '1.5' && outcomeId === '12') return 'over_1_5';
  if (marketId === '18' && total === '2.5' && outcomeId === '12') return 'over_2_5';
  if (marketId === '18' && total === '2.5' && outcomeId === '13') return 'under_2_5';
  if (marketId === '18' && total === '3.5' && outcomeId === '12') return 'over_3_5';
  if (marketId === '29' && outcomeId === '74') return 'btts';
  if (marketId === '29' && outcomeId === '76') return 'btts_no';
  if (marketId === '19' && total === '1.5' && outcomeId === '12') return 'home:team_over_1_5';
  if (marketId === '20' && total === '1.5' && outcomeId === '12') return 'away:team_over_1_5';
  if (marketId === '19' && total === '0.5' && outcomeId === '12') return 'home:team_scored';
  if (marketId === '20' && total === '0.5' && outcomeId === '12') return 'away:team_scored';
  if (marketId === '20' && total === '0.5' && outcomeId === '13') return 'home:clean_sheet';
  if (marketId === '19' && total === '0.5' && outcomeId === '13') return 'away:clean_sheet';
  return null;
}

export function mapTimeline(event: Record<string, unknown>): RawIncident[] {
  const rows = asArray(event.comments ?? event.eventTimeline ?? event.timeline ?? event.incidents);
  return rows
    .map((item, index) => mapTimelineRow(item, index))
    .filter((item): item is RawIncident => item != null);
}

function mapTimelineRow(value: unknown, index: number): RawIncident | null {
  const row = asRecord(value);
  if (!row) return null;
  const text = asString(row.text) ?? asString(row.desc) ?? asString(row.description) ?? asString(row.type) ?? '';
  const kind = (asString(row.type) ?? asString(row.incidentType) ?? text).toLowerCase();
  const minute = asNumber(row.minute) ?? asNumber(row.time) ?? asNumber(row.matchTime);
  const isHome = typeof row.isHome === 'boolean' ? row.isHome : homeSide(row);
  const id = asString(row.id) ?? `tl-${index}`;
  if (/var/.test(kind) || /var/.test(text.toLowerCase())) {
    const negative = /disallow|cancel|rescind|overturn/.test(`${kind} ${text}`.toLowerCase());
    const awarded = /award|confirm|goal/.test(text.toLowerCase()) && !negative;
    return {
      id,
      type: 'var',
      minute,
      isHome,
      varState: negative ? 'disallowed' : awarded || row.confirmed === true ? 'awarded' : 'pending',
      text: text || 'VAR',
    };
  }
  if (/goal/.test(kind)) {
    return { id, type: 'goal', minute, isHome, player: asString(row.player) ?? undefined, confirmed: row.confirmed !== false };
  }
  if (/card/.test(kind)) {
    return { id, type: 'card', minute, isHome, card: /red/.test(kind) ? 'red' : 'yellow' };
  }
  return text ? { id, type: 'other', minute, isHome, text } : null;
}

function homeSide(row: Record<string, unknown>): boolean | null {
  const side = (asString(row.side) ?? asString(row.team) ?? '').toLowerCase();
  if (side === 'home' || side === 'h') return true;
  if (side === 'away' || side === 'a') return false;
  return null;
}

export function mapLineups(event: Record<string, unknown>): { home: Lineup | null; away: Lineup | null } {
  return {
    home: lineupSide(event.homeLineup ?? event.homeLineups ?? asRecord(event.lineups)?.home),
    away: lineupSide(event.awayLineup ?? event.awayLineups ?? asRecord(event.lineups)?.away),
  };
}

function lineupSide(value: unknown): Lineup | null {
  const side = asRecord(value);
  const players = asArray(side?.players ?? side?.starters ?? value);
  if (!players.length) return null;
  const starters: LineupPlayer[] = [];
  const bench: LineupPlayer[] = [];
  for (const item of players) {
    if (typeof item === 'string') {
      starters.push({ id: item, name: item });
      continue;
    }
    const row = asRecord(item);
    const name = asString(row?.name) ?? asString(asRecord(row?.player)?.name);
    if (!row || !name) continue;
    const entry = { id: asString(row.id) ?? name, name, position: asString(row.position) ?? undefined };
    if (row.substitute === true || row.bench === true) bench.push(entry);
    else starters.push(entry);
  }
  if (!starters.length && !bench.length) return null;
  return { formation: asString(side?.formation), starters, bench };
}

export function mapTeamResults(payload: unknown, teamId: string): ResultRow[] {
  const events = sportyEvents(payload)
    .filter((event) => mapSportyStatus(asString(event.matchStatus) ?? asString(event.status)) === 'finished')
    .sort((a, b) => (asNumber(b.estimateStartTime) ?? 0) - (asNumber(a.estimateStartTime) ?? 0));
  const rows: ResultRow[] = [];
  for (const event of events) {
    const score = parseSetScore(event.setScore);
    if (!score) continue;
    const homeId = asString(event.homeTeamId);
    const isHome = homeId === teamId;
    rows.push({
      goalsFor: isHome ? score.home : score.away,
      goalsAgainst: isHome ? score.away : score.home,
      venue: isHome ? 'home' : 'away',
    });
  }
  return rows;
}
