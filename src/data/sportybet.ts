import type { Lineup, LineupPlayer, Match, MatchDetail, MatchStatus, RawIncident, ResultRow, TeamRef } from '../domain';
import { stepScore, type HoldState } from './var-hold';
import {
  chooseSchedule,
  inspectSporty,
  kickoffMs,
  livePath,
  SPORTY_HEADERS,
  sportyCopy,
  sportyLine,
  upcomingPath,
  type ScheduleScope,
} from './sporty-read';

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

const HEADERS = SPORTY_HEADERS;

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
  notice?: string;
  copy?: string;
  fromCache: boolean;
  stale: boolean;
  fetchedAt: number | null;
}

interface PackedList {
  matches: Match[];
  notice: string;
  copy: string;
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
  const path = sportyPath(url);
  if (bridgeFetch && path) {
    try {
      const body = await bridgeFetch(path);
      const inspected = inspectSporty(body);
      if (inspected.bizCode == null || inspected.bizCode === 10000) {
        return { __sportyHttp: true, status: 200, via: 'page', body };
      }
    } catch {
      // The hidden page missed. The phone's own request is the next try.
    }
  }
  return directFetchJson(url);
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
      return { __sportyHttp: true, status: response.status, via: 'direct', body: await response.json() };
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

  async function read(path: string): Promise<{ status: number; via: string; body: unknown }> {
    try {
      const raw = await pull(path);
      return unwrapHttp(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SportyBet request failed';
      const status = /403/.test(message) ? 403 : Number(message.match(/SportyBet (\d+)/)?.[1] ?? 0);
      if (status) {
        throw new Error(sportyLine({ httpStatus: status, path, bizCode: null, message: null, tournaments: 0, events: 0, kept: 0, scope: 'today' }));
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function loadPages(todayGames: boolean): Promise<{
    matches: Match[];
    path: string;
    status: number;
    via: string;
    bizCode: number | null;
    message: string | null;
    tournaments: number;
    events: number;
  }> {
    const matches: Match[] = [];
    let path = upcomingPath(1, todayGames);
    let status = 200;
    let via = 'direct';
    let bizCode: number | null = null;
    let message: string | null = null;
    let tournaments = 0;
    let events = 0;
    for (let page = 1; page <= 4; page += 1) {
      path = upcomingPath(page, todayGames);
      const http = await read(path);
      const info = inspectSporty(http.body);
      status = http.status;
      via = http.via;
      bizCode = info.bizCode;
      message = info.message;
      if (http.status >= 400) throw new Error(sportyLine({ httpStatus: http.status, path, bizCode, message, tournaments, events, kept: 0, scope: 'today' }));
      if (info.bizCode != null && info.bizCode !== 10000) {
        throw new Error(sportyLine({ httpStatus: http.status || 200, path, bizCode: info.bizCode, message: info.message, tournaments: info.tournaments, events: info.events.length, kept: 0, scope: 'today' }));
      }
      tournaments += info.tournaments;
      events += info.events.length;
      matches.push(...info.events.map((event) => mapSportyEvent(event)).filter((event): event is Match => event != null));
      if (info.events.length < 100) break;
    }
    return { matches, path, status, via, bizCode, message, tournaments, events };
  }

  async function loadSchedule(date: string): Promise<PackedList> {
    let bag = await loadPages(true);
    let chosen = chooseSchedule(bag.matches, date, now());
    if (bag.events === 0 || chosen.matches.length === 0) {
      const wider = await loadPages(false);
      const widerChosen = chooseSchedule(wider.matches, date, now());
      if (widerChosen.matches.length >= chosen.matches.length) {
        bag = wider;
        chosen = widerChosen;
      }
    }
    const facts = { httpStatus: bag.status, path: bag.path, bizCode: bag.bizCode, message: bag.message, tournaments: bag.tournaments, events: bag.events, kept: chosen.matches.length, scope: chosen.scope };
    return { matches: chosen.matches, notice: sportyLine(facts), copy: sportyCopy({ ...facts, via: bag.via }) };
  }

  async function loadLive(): Promise<PackedList> {
    const paths = [livePath('liveOrPrematchEvents'), livePath('configurableLiveOrPrematchEvents')];
    let last = 'SportyBet live request failed';
    for (const path of paths) {
      try {
        const http = await read(path);
        const info = inspectSporty(http.body);
        if (http.status >= 400) throw new Error(sportyLine({ httpStatus: http.status, path, bizCode: info.bizCode, message: info.message, tournaments: info.tournaments, events: info.events.length, kept: 0, scope: 'today' }));
        if (info.bizCode != null && info.bizCode !== 10000) {
          throw new Error(sportyLine({ httpStatus: http.status || 200, path, bizCode: info.bizCode, message: info.message, tournaments: info.tournaments, events: info.events.length, kept: 0, scope: 'today' }));
        }
        const matches = info.events
          .map((event) => mapSportyEvent(event))
          .filter((event): event is Match => event != null)
          .map((match) => applyHold(match, varAwarded(http.body, match.id)))
          .filter((match) => match.status === 'live');
        const scope: ScheduleScope = 'today';
        const facts = { httpStatus: http.status, path, bizCode: info.bizCode, message: info.message, tournaments: info.tournaments, events: info.events.length, kept: matches.length, scope };
        return { matches, notice: sportyLine(facts), copy: sportyCopy({ ...facts, via: http.via }) };
      } catch (error) {
        last = error instanceof Error ? error.message : last;
      }
    }
    throw new Error(last);
  }

  return {
    id: 'sportybet',
    async scheduled(date, fresh) {
      const result = await cached(`scheduled:${date}`, SCHEDULE_TTL, fresh, () => loadSchedule(date));
      return unpack(result);
    },
    async live(fresh) {
      const result = await cached('live', LIVE_TTL, fresh, () => loadLive());
      const unpacked = unpack(result);
      liveIds.clear();
      for (const match of unpacked.data ?? []) if (match.status === 'live') liveIds.add(match.id);
      return unpacked;
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

function unpack(result: SourceResult<PackedList>): SourceResult<Match[]> {
  return {
    ...result,
    data: result.data?.matches ?? null,
    notice: result.error ?? result.data?.notice,
    copy: result.data?.copy ?? result.error,
  };
}

function unwrapHttp(raw: unknown): { status: number; via: string; body: unknown } {
  const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (row && row.__sportyHttp === true) {
    return {
      status: typeof row.status === 'number' ? row.status : 200,
      via: row.via === 'page' ? 'page' : 'direct',
      body: row.body,
    };
  }
  return { status: 200, via: 'mock', body: raw };
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
  return inspectSporty(payload).events;
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
  const kickoff = kickoffMs(event.estimateStartTime) || kickoffMs(event.startTime);
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
