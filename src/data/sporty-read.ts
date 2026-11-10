import type { Match } from '../domain';
import { localDate } from '../format';

/** The longest market list Predict2u has confirmed on pcUpcomingEvents. */
export const SPORTY_MARKET_IDS = '1,18,10,29';

export const SPORTY_UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/** Proven curl: Accept and a browser User-Agent only. */
export const PLAIN_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': SPORTY_UA,
};

/** Same request with the Ghana web client headers. No Content-Type and no Origin on a GET. */
export const WEB_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': SPORTY_UA,
  clientid: 'web',
  platform: 'web',
  operid: '2',
};

export type HeaderSet = 'plain' | 'web';

export function headersFor(set: HeaderSet): Record<string, string> {
  return set === 'web' ? WEB_HEADERS : PLAIN_HEADERS;
}

export function headerNames(set: HeaderSet): string {
  return Object.keys(headersFor(set)).join(', ');
}

/** Predict2u's working list URL. No timeline, no todayGames, no productId. */
export function upcomingPath(page: number): string {
  return `/factsCenter/pcUpcomingEvents?sportId=${encodeURIComponent('sr:sport:1')}&marketId=${encodeURIComponent(SPORTY_MARKET_IDS)}&pageSize=100&pageNum=${page}&option=1`;
}

export function eventPath(eventId: string, productId: '1' | '3'): string {
  return `/factsCenter/event?eventId=${encodeURIComponent(eventId)}&productId=${productId}`;
}

/** In-play list. Market ids stay short: 1, 18 and 29. No timeline and no todayGames. */
export function liveListPath(page: number): string {
  return `/factsCenter/liveOrPrematchEvents?sportId=${encodeURIComponent('sr:sport:1')}&marketId=${encodeURIComponent('1,18,29')}&pageSize=100&pageNum=${page}&productId=1`;
}

/** Stop paging once this page covers totalNum, or the page itself is short. */
export function morePages(page: number, pageEvents: number, total: number | null): boolean {
  if (pageEvents < 100) return false;
  if (total != null && page * 100 >= total) return false;
  return page < 8;
}

export function endpointName(path: string): string {
  const clean = path.split('?')[0] ?? path;
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function kickoffMs(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : 0;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

export interface InspectedPayload {
  bizCode: number | null;
  message: string | null;
  tournaments: number;
  events: Record<string, unknown>[];
}

export function inspectSporty(payload: unknown): InspectedPayload {
  const root = asRecord(payload);
  const bizCode = asNumber(root?.bizCode);
  const message = asString(root?.message) ?? asString(root?.innerMsg);
  const data = asRecord(root?.data) ?? root;
  if (!data) return { bizCode, message, tournaments: 0, events: [] };

  const pools = [data, asRecord(data.todayGames), asRecord(data.timeline), asRecord(data.preMatch)].filter(
    (pool): pool is Record<string, unknown> => pool != null,
  );
  for (const pool of pools) {
    const gathered = gather(pool);
    if (gathered.tournaments || gathered.events.length) {
      return { bizCode, message, ...dedupe(gathered) };
    }
  }
  if (Array.isArray(data.todayGames)) {
    const events = data.todayGames.map(asRecord).filter((row): row is Record<string, unknown> => row != null);
    if (events.length) return { bizCode, message, tournaments: 0, events: dedupe({ tournaments: 0, events }).events };
  }
  return { bizCode, message, tournaments: 0, events: [] };
}

export type ScheduleScope = 'today' | 'next' | 'upcoming';

/** Keep today's kickoffs. If that day is empty, show the next days, then every parsed fixture. */
export function chooseSchedule(matches: Match[], day: string, now = Date.now()): { matches: Match[]; scope: ScheduleScope } {
  const today = matches.filter((match) => match.kickoff > 0 && localDate(new Date(match.kickoff)) === day);
  if (today.length) return { matches: byKickoff(today), scope: 'today' };
  const start = new Date(`${day}T00:00:00`).getTime();
  const end = start + 3 * 24 * 60 * 60 * 1000;
  const next = matches.filter((match) => match.kickoff >= start && match.kickoff < end);
  if (next.length) return { matches: byKickoff(next), scope: 'next' };
  const soon = matches.filter((match) => match.kickoff >= now - 3 * 60 * 60 * 1000);
  if (soon.length) return { matches: byKickoff(soon), scope: 'upcoming' };
  if (matches.length) return { matches: byKickoff(matches), scope: 'upcoming' };
  return { matches: [], scope: 'upcoming' };
}

export function sportyLine(input: {
  httpStatus: number;
  path: string;
  bizCode: number | null;
  message: string | null;
  tournaments: number;
  events: number;
  kept: number;
  scope: ScheduleScope;
}): string {
  const name = endpointName(input.path);
  if (input.httpStatus >= 400) return `SportyBet: HTTP ${input.httpStatus} on ${name}`;
  if (input.bizCode != null && input.bizCode !== 10000) {
    const detail = input.message ? ` (${input.message})` : '';
    return `SportyBet: bizCode ${input.bizCode} on ${name}${detail}`;
  }
  const base = `SportyBet OK: ${input.events} events parsed from ${input.tournaments} tournaments`;
  if (input.scope === 'next' && input.kept) return `${base}, showing the next days (${input.kept})`;
  if (input.scope === 'upcoming' && input.kept && input.kept !== input.events) return `${base}, showing upcoming (${input.kept})`;
  return base;
}

export interface AttemptRecord {
  path: string;
  via: string;
  headerSet: string;
  headerNames: string;
  httpStatus: number;
  bizCode: number | null;
  message: string | null;
  snippet: string;
}

export function formatLadder(attempts: AttemptRecord[]): string {
  return attempts
    .map((attempt) => {
      const lines = [
        `${attempt.via}/${attempt.headerSet} HTTP ${attempt.httpStatus || 'none'} bizCode ${attempt.bizCode ?? 'none'}${attempt.message ? ` (${attempt.message})` : ''}`,
        `path: ${attempt.path}`,
        `headers: ${attempt.headerNames}`,
      ];
      if (attempt.httpStatus !== 200 && attempt.snippet) lines.push(`body: ${attempt.snippet.slice(0, 200)}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

export function sportyCopy(input: {
  httpStatus: number;
  path: string;
  bizCode: number | null;
  message: string | null;
  tournaments: number;
  events: number;
  kept: number;
  scope: ScheduleScope;
  via: string;
  attempts?: AttemptRecord[];
}): string {
  const summary = [
    sportyLine(input),
    `path: ${input.path}`,
    `http: ${input.httpStatus || 'none'}`,
    `bizCode: ${input.bizCode ?? 'none'}`,
    `message: ${input.message ?? ''}`,
    `via: ${input.via}`,
    `tournaments: ${input.tournaments}`,
    `events: ${input.events}`,
    `kept: ${input.kept}`,
    `scope: ${input.scope}`,
  ].join('\n');
  const ladder = input.attempts?.length ? formatLadder(input.attempts) : '';
  return ladder ? `${summary}\n\n${ladder}` : summary;
}

export function listTotal(payload: unknown): number | null {
  const data = asRecord(asRecord(payload)?.data);
  return asNumber(data?.totalNum);
}

function gather(source: Record<string, unknown>): { tournaments: number; events: Record<string, unknown>[] } {
  const tournaments = asArray(source.tournaments);
  if (tournaments.length) {
    const events: Record<string, unknown>[] = [];
    for (const tournament of tournaments) pushTournament(tournament, events);
    return { tournaments: tournaments.length, events };
  }
  const direct = asArray(source.events ?? source.list ?? source.eventList);
  if (direct.length) {
    const events: Record<string, unknown>[] = [];
    let tournamentsCount = 0;
    for (const item of direct) {
      const row = asRecord(item);
      if (!row) continue;
      if (asArray(row.events).length) {
        tournamentsCount += 1;
        pushTournament(row, events);
      } else events.push(row);
    }
    return { tournaments: tournamentsCount, events };
  }
  if (asString(source.eventId) || asString(source.homeTeamName)) return { tournaments: 0, events: [source] };
  return { tournaments: 0, events: [] };
}

function pushTournament(value: unknown, events: Record<string, unknown>[]) {
  const row = asRecord(value);
  if (!row) return;
  const league = asString(asRecord(row.tournament)?.name) ?? asString(row.name);
  const country = asString(asRecord(row.category)?.name);
  const inner = asArray(row.events);
  if (!inner.length && (asString(row.eventId) || asString(row.homeTeamName))) {
    events.push(row);
    return;
  }
  for (const event of inner) {
    const item = asRecord(event);
    if (!item) continue;
    events.push({ ...item, _league: item._league ?? league, _country: item._country ?? country });
  }
}

function dedupe(gathered: { tournaments: number; events: Record<string, unknown>[] }) {
  const seen = new Set<string>();
  const events: Record<string, unknown>[] = [];
  for (const event of gathered.events) {
    const id = asString(event.eventId) ?? asString(event.id);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    events.push(event);
  }
  return { tournaments: gathered.tournaments, events };
}

function byKickoff(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => a.kickoff - b.kickoff);
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
