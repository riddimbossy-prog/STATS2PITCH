import type { Lineup, LineupPlayer, Match, MatchDetail, MatchStatus, RawIncident, ResultRow, TeamRef } from '../domain';
import { localDate } from '../format';
import { getBridgeSnapshot } from './bridge';
import { stepScore, type HoldState } from './var-hold';
import {
  chooseSchedule,
  eventPath,
  headerNames,
  liveListPath,
  headersFor,
  inspectSporty,
  kickoffMs,
  listTotal,
  morePages,
  sportyCopy,
  sportyLine,
  upcomingPath,
  type AttemptRecord,
  type HeaderSet,
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
  (url: string, init?: { headerSet: HeaderSet }): Promise<unknown>;
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

let bridgeFetch: ((path: string, headerSet: HeaderSet) => Promise<{ status: number; body: string }>) | null = null;

/** Native installs this so reads can run inside the sportybet.com page. Web leaves it unset. */
export function registerSportyBridge(
  fetchPath: ((path: string, headerSet: HeaderSet) => Promise<{ status: number; body: string }>) | null,
) {
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

export async function defaultFetchJson(url: string, init?: { headerSet: HeaderSet }): Promise<unknown> {
  const headerSet = init?.headerSet ?? 'plain';
  const path = sportyPath(url);
  if (bridgeFetch && path) {
    try {
      const page = await bridgeFetch(path, headerSet);
      const parsed = parseBody(page.body);
      if (page.status === 200 && inspectSporty(parsed).bizCode === 10000) {
        return { __sportyHttp: true, status: page.status, via: 'page', body: parsed, snippet: page.body.slice(0, 200) };
      }
    } catch {
      // The hidden page missed this header set. The phone request is next.
    }
  }
  return directFetch(url, headerSet);
}

async function directFetch(url: string, headerSet: HeaderSet): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: headersFor(headerSet), signal: controller.signal });
    const text = await response.text();
    return { __sportyHttp: true, status: response.status, via: 'direct', body: parseBody(text), snippet: text.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

class RequestGate {
  private chain: Promise<void> = Promise.resolve();
  private started = false;
  constructor(private readonly gapMs: number) {}
  wait(): Promise<void> {
    if (!this.started) {
      this.started = true;
      return Promise.resolve();
    }
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
  onSchedule?: (matches: Match[]) => void;
  onLive?: (matches: Match[]) => void;
}): DataSource {
  const fetchJson = options?.fetchJson;
  const cache = options?.cache ?? memoryCache();
  const now = options?.now ?? Date.now;
  const baseUrl = (options?.baseUrl ?? sportybetBaseUrl()).replace(/\/$/, '');
  const gate = new RequestGate(options?.gapMs ?? 350);
  const holds = new Map<string, HoldState>();
  const liveIds = new Set<string>();

  async function pull(path: string, headerSet: HeaderSet): Promise<unknown> {
    if (fetchJson) return fetchJson(`${baseUrl}${path}`, { headerSet });
    return directFetch(`${baseUrl}${path}`, headerSet);
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
      const copy = error instanceof ReadError ? error.copy : message;
      if (hit) {
        return { ok: false, data: JSON.parse(hit.payload) as T, error: message, copy, fromCache: true, stale: true, fetchedAt };
      }
      return { ok: false, data: null, error: message, copy, fromCache: false, stale: false, fetchedAt: null };
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

  async function attempt(path: string, via: 'page' | 'direct', headerSet: HeaderSet): Promise<AttemptRecord & { body: unknown }> {
    await gate.wait();
    const names = headerNames(headerSet);
    try {
      if (via === 'page') {
        if (!bridgeFetch) throw new Error('SportyBet page is not open');
        const page = await bridgeFetch(path, headerSet);
        const body = parseBody(page.body);
        const info = inspectSporty(body);
        return {
          path,
          via,
          headerSet,
          headerNames: names,
          httpStatus: page.status,
          bizCode: info.bizCode,
          message: info.message,
          snippet: page.body.slice(0, 200),
          body,
        };
      }
      const raw = await pull(path, headerSet);
      const http = unwrapHttp(raw);
      const info = inspectSporty(http.body);
      const snippet = http.snippet || (typeof http.body === 'string' ? http.body : JSON.stringify(http.body ?? '')).slice(0, 200);
      return {
        path,
        via,
        headerSet,
        headerNames: names,
        httpStatus: http.status,
        bizCode: info.bizCode,
        message: info.message,
        snippet,
        body: http.body,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SportyBet request failed';
      const status = /403/.test(message) ? 403 : Number(message.match(/(\d{3})/)?.[1] ?? 0);
      return { path, via, headerSet, headerNames: names, httpStatus: status, bizCode: null, message, snippet: message.slice(0, 200), body: null };
    }
  }

  async function ladder(path: string): Promise<{
    ok: boolean;
    body: unknown;
    attempts: AttemptRecord[];
    status: number;
    bizCode: number | null;
    message: string | null;
    via: string;
  }> {
    const attempts: Array<AttemptRecord & { body: unknown }> = [];
    const via: 'page' | 'direct' = !fetchJson && bridgeFetch && getBridgeSnapshot().status === 'live' ? 'page' : 'direct';
    for (const headerSet of ['plain', 'web'] as const) {
      const row = await attempt(path, via, headerSet);
      attempts.push(row);
      if (row.httpStatus === 200 && row.bizCode === 10000) {
        return { ok: true, body: row.body, attempts, status: row.httpStatus, bizCode: row.bizCode, message: row.message, via: `${row.via}/${row.headerSet}` };
      }
    }
    const last = attempts[attempts.length - 1];
    return {
      ok: false,
      body: last?.body ?? null,
      attempts,
      status: last?.httpStatus ?? 0,
      bizCode: last?.bizCode ?? null,
      message: last?.message,
      via: last ? `${last.via}/${last.headerSet}` : 'direct/plain',
    };
  }

  function failure(path: string, result: Awaited<ReturnType<typeof ladder>>, tournaments = 0, events = 0): Error {
    const line = sportyLine({
      httpStatus: result.status,
      path,
      bizCode: result.bizCode,
      message: result.message,
      tournaments,
      events,
      kept: 0,
      scope: 'today',
    });
    const copy = sportyCopy({
      httpStatus: result.status,
      path,
      bizCode: result.bizCode,
      message: result.message,
      tournaments,
      events,
      kept: 0,
      scope: 'today',
      via: result.via,
      attempts: result.attempts,
    });
    return new ReadError(line, copy);
  }

  let scheduleToken = 0;

  function mapped(events: Record<string, unknown>[]): Match[] {
    return events.map((event) => mapSportyEvent(event)).filter((event): event is Match => event != null);
  }

  async function loadPages(date: string): Promise<{
    matches: Match[];
    path: string;
    status: number;
    via: string;
    bizCode: number | null;
    message: string | null;
    tournaments: number;
    events: number;
    attempts: AttemptRecord[];
  }> {
    const path = upcomingPath(1);
    const result = await ladder(path);
    if (!result.ok) throw failure(path, result);
    const info = inspectSporty(result.body);
    const matches = mapped(info.events);
    const total = listTotal(result.body);
    if (morePages(1, info.events.length, total)) {
      const token = ++scheduleToken;
      void extendSchedule(token, date, matches, info.events.length, info.tournaments, total);
    }
    return {
      matches,
      path,
      status: result.status,
      via: result.via,
      bizCode: result.bizCode,
      message: result.message,
      tournaments: info.tournaments,
      events: info.events.length,
      attempts: result.attempts,
    };
  }

  async function extendSchedule(token: number, date: string, seed: Match[], events: number, tournaments: number, total: number | null) {
    let matches = seed;
    let seen = events;
    for (let page = 2; page <= 8; page += 1) {
      if (token !== scheduleToken) return;
      const result = await ladder(upcomingPath(page));
      if (token !== scheduleToken || !result.ok) return;
      const info = inspectSporty(result.body);
      seen = info.events.length;
      tournaments += info.tournaments;
      matches = matches.concat(mapped(info.events));
      options?.onSchedule?.(chooseSchedule(matches, date, now()).matches);
      if (!morePages(page, seen, listTotal(result.body) ?? total)) return;
    }
  }

  async function loadSchedule(date: string): Promise<PackedList> {
    const bag = await loadPages(date);
    const chosen = chooseSchedule(bag.matches, date, now());
    const facts = {
      httpStatus: bag.status,
      path: bag.path,
      bizCode: bag.bizCode,
      message: bag.message,
      tournaments: bag.tournaments,
      events: bag.events,
      kept: chosen.matches.length,
      scope: chosen.scope,
      via: bag.via,
      attempts: bag.attempts,
    };
    return { matches: chosen.matches, notice: sportyLine(facts), copy: sportyCopy(facts) };
  }

  async function loadLive(): Promise<PackedList> {
    const attempts: AttemptRecord[] = [];
    const matches: Match[] = [];
    let path = liveListPath(1);
    let status = 0;
    let bizCode: number | null = null;
    let message: string | null = null;
    let via = 'direct/plain';
    let tournaments = 0;
    let events = 0;
    let failed = false;
    for (let page = 1; page <= 8; page += 1) {
      path = liveListPath(page);
      const result = await ladder(path);
      attempts.push(...result.attempts);
      status = result.status;
      bizCode = result.bizCode;
      message = result.message;
      via = result.via;
      if (!result.ok) {
        failed = page === 1;
        break;
      }
      const info = inspectSporty(result.body);
      tournaments += info.tournaments;
      events += info.events.length;
      for (const event of info.events) {
        const match = mapSportyEvent(event);
        if (!match || match.status !== 'live') continue;
        matches.push(applyHold(match, varAwarded(result.body, match.id)));
      }
      if (!morePages(page, info.events.length, listTotal(result.body))) break;
    }
    if (!failed) {
      const facts = { httpStatus: status, path, bizCode, message, tournaments, events, kept: matches.length, scope: 'today' as const, via, attempts };
      const copy = `live list · HTTP ${status} · code ${bizCode ?? 'none'} · ${events} events, ${matches.length} live\n${sportyCopy(facts)}`;
      return { matches, notice: '', copy };
    }

    let bag: Awaited<ReturnType<typeof loadPages>>;
    try {
      bag = await loadPages(localDate(new Date(now())));
    } catch (error) {
      const copy = error instanceof ReadError ? error.copy : "Couldn't load matches";
      throw new ReadError("Couldn't load matches", `live list HTTP ${status}\n${copy}`);
    }
    const fallback = bag.matches
      .filter((match) => match.kickoff > 0 && match.kickoff <= now() && match.status !== 'finished' && match.status !== 'cancelled' && match.status !== 'postponed')
      .map((match) => applyHold({ ...match, status: 'live' }, false));
    const facts = {
      httpStatus: status,
      path,
      bizCode,
      message,
      tournaments: bag.tournaments,
      events: bag.events,
      kept: fallback.length,
      scope: 'today' as const,
      via,
      attempts: [...attempts, ...bag.attempts],
    };
    const copy = `upcoming fallback · live list HTTP ${status} · code ${bizCode ?? 'none'} · ${bag.events} upcoming, ${fallback.length} live\n${sportyCopy(facts)}`;
    return { matches: fallback, notice: '', copy };
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
      const products: Array<'1' | '3'> = liveIds.has(id) ? ['1', '3'] : ['3'];
      const eventResult = await cached(`event:${id}`, EVENT_TTL, fresh, async () => {
        let payload: unknown = null;
        let last: Awaited<ReturnType<typeof ladder>> | null = null;
        for (const product of products) {
          const result = await ladder(eventPath(id, product));
          last = result;
          if (result.ok) {
            payload = result.body;
            break;
          }
        }
        const match = payload ? mapSportyEvents(payload)[0] ?? null : null;
        if (!match || !payload) throw last ? failure(eventPath(id, products[0]), last) : new Error('SportyBet event had no match');
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
      return cached(`team:${teamId}`, TEAM_TTL, fresh, async () => {
        const result = await ladder(`/factsCenter/teamEventList?teamId=${encodeURIComponent(teamId)}&pageSize=12&pageNum=1`);
        if (!result.ok) throw failure(`/factsCenter/teamEventList`, result);
        return mapTeamResults(result.body, teamId);
      });
    },
    recentLineups(teamId, fresh) {
      // factsCenter event and team lists do not publish starting XIs, so squad strength stays unknown.
      void teamId;
      void fresh;
      return Promise.resolve({ ok: true, data: [], fromCache: false, stale: false, fetchedAt: now() });
    },
  };
}

class ReadError extends Error {
  copy: string;
  constructor(message: string, copy: string) {
    super(message);
    this.copy = copy;
  }
}

function unpack(result: SourceResult<PackedList>): SourceResult<Match[]> {
  return {
    ...result,
    data: result.data?.matches ?? null,
    notice: result.error ?? result.data?.notice,
    copy: result.copy ?? result.data?.copy ?? result.error,
  };
}

function unwrapHttp(raw: unknown): { status: number; via: string; body: unknown; snippet: string } {
  const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (row && row.__sportyHttp === true) {
    const snippet = typeof row.snippet === 'string' ? row.snippet : '';
    return {
      status: typeof row.status === 'number' ? row.status : 200,
      via: row.via === 'page' ? 'page' : 'direct',
      body: row.body,
      snippet,
    };
  }
  return { status: 200, via: 'mock', body: raw, snippet: '' };
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
