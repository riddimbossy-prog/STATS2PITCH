import type { MarketId, Side } from '../domain';
import { findSportyEvent, type SportyFixture } from './names';
import { selectionFor, shareLink, type BetradarLeg } from './markets';
import {
  betpawaEventId,
  betpawaHandicap,
  parseBetikaDecode,
  parseBetikaEncode,
  parseBetpawaCode,
  parseBetpawaVerify,
  parseBizShare,
  parseMsportVerify,
  parseSportyPost,
  parseSportyShare,
} from './parse';

export interface BookieResult {
  id: 'sportybet' | 'football' | 'msport' | 'betika' | 'betpawa';
  name: string;
  ok: boolean;
  code: string | null;
  shareUrl: string | null;
  totalOdds: number | null;
  legs: number;
  offered: number;
  reason: string | null;
}

export interface JsonClient {
  request(input: { method: 'GET' | 'POST'; url: string; body?: unknown; headers?: Record<string, string> }): Promise<unknown>;
}

export interface PickToBook {
  id: string;
  matchId: string;
  /** Betradar id when the fixture already came from SportyBet. Skips name matching. */
  eventId?: string;
  market: MarketId;
  side: Side;
  label: string;
  home: string;
  away: string;
  kickoff: number;
  odds: number | null;
}

const UA = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA };

const SPORTY = 'https://www.sportybet.com/api/gh/orders/share';
const FOOTBALL = 'https://www.football.com/api/gh/orders/share';
const MSPORT = 'https://www.msport.com/api/gh/orders/real-sports/order/share';
const BETIKA = 'https://api.betika.com.gh/v2/share/';
const BETPAWA = 'https://www.betpawa.com.gh/api/sportsbook/';

function sportyBody(legs: BetradarLeg[]) {
  return {
    selections: legs.map((leg) => ({
      eventId: leg.eventId,
      marketId: String(leg.marketId),
      specifier: leg.specifier || null,
      outcomeId: String(leg.outcomeId),
    })),
  };
}

export function fixturesFromSporty(payload: unknown): SportyFixture[] {
  const data = payload && typeof payload === 'object' ? (payload as { data?: { tournaments?: unknown[] } }).data : null;
  const tournaments = Array.isArray(data?.tournaments) ? data.tournaments : [];
  const fixtures: SportyFixture[] = [];
  for (const tournament of tournaments) {
    const events = tournament && typeof tournament === 'object' ? (tournament as { events?: unknown[] }).events : [];
    for (const event of events ?? []) {
      if (!event || typeof event !== 'object') continue;
      const row = event as { eventId?: string; homeTeamName?: string; awayTeamName?: string; estimateStartTime?: number };
      if (!row.eventId || !row.homeTeamName || !row.awayTeamName) continue;
      fixtures.push({
        eventId: row.eventId,
        home: row.homeTeamName,
        away: row.awayTeamName,
        kickoff: Number(row.estimateStartTime) || 0,
      });
    }
  }
  return fixtures;
}

export async function loadSportyFixtures(client: JsonClient): Promise<SportyFixture[]> {
  const fixtures: SportyFixture[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const payload = await client.request({
      method: 'GET',
      url: `https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents?sportId=${encodeURIComponent('sr:sport:1')}&marketId=1,18,29&pageSize=100&pageNum=${page}&option=1`,
      headers: JSON_HEADERS,
    });
    const batch = fixturesFromSporty(payload);
    fixtures.push(...batch);
    if (batch.length < 100) break;
  }
  return fixtures;
}

export function picksToLegs(picks: PickToBook[], fixtures: SportyFixture[]): { legs: BetradarLeg[]; missed: string[] } {
  const legs: BetradarLeg[] = [];
  const missed: string[] = [];
  for (const pick of picks) {
    const market = selectionFor(pick.market, pick.side);
    if (!market) {
      missed.push(`${pick.label}: no Betradar market`);
      continue;
    }
    const direct = pick.eventId?.startsWith('sr:');
    const event = direct ? null : findSportyEvent(fixtures, pick.home, pick.away, pick.kickoff);
    if (!direct && !event) {
      missed.push(`${pick.home} v ${pick.away}: not on SportyBet`);
      continue;
    }
    legs.push({
      eventId: direct ? pick.eventId! : event!.eventId,
      marketId: market.marketId,
      specifier: market.specifier,
      outcomeId: market.outcomeId,
      odds: pick.odds,
      match: direct ? `${pick.home} v ${pick.away}` : `${event!.home} v ${event!.away}`,
      pickId: pick.id,
    });
  }
  return { legs, missed };
}

async function postSporty(client: JsonClient, legs: BetradarLeg[]): Promise<string> {
  const payload = await client.request({ method: 'POST', url: SPORTY, body: sportyBody(legs), headers: JSON_HEADERS });
  const posted = parseSportyPost(payload);
  if (!posted.code) throw new Error(posted.reason || 'SportyBet did not book');
  return posted.code;
}

export async function readSportyCode(client: JsonClient, code: string): Promise<ParsedShare> {
  const payload = await client.request({
    method: 'GET',
    url: `${SPORTY}/${encodeURIComponent(code.trim())}`,
    headers: JSON_HEADERS,
  });
  const parsed = parseSportyShare(payload);
  if (!parsed.legs.length) throw new Error(parsed.reason || 'That SportyBet code has no legs');
  return { ...parsed, code: parsed.code || code.trim() };
}

interface ParsedShare {
  code: string;
  legs: BetradarLeg[];
  totalOdds: number | null;
  reason: string | null;
}

async function bookSporty(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult> {
  const offered = legs.length;
  try {
    let working = legs;
    let code: string | null = null;
    try {
      code = await postSporty(client, working);
    } catch {
      const kept: BetradarLeg[] = [];
      for (const leg of legs) {
        try {
          await postSporty(client, [leg]);
          kept.push(leg);
        } catch {
          // This bookie cannot price the leg.
        }
      }
      if (!kept.length) throw new Error('SportyBet could not price any leg');
      working = kept;
      code = await postSporty(client, working);
    }
    const decoded = await readSportyCode(client, code);
    return result('sportybet', 'SportyBet', true, decoded.code, decoded.totalOdds, decoded.legs.length, offered, null);
  } catch (error) {
    return result('sportybet', 'SportyBet', false, null, null, 0, offered, message(error));
  }
}

async function bookFootball(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult> {
  return bookCopy(client, 'football', 'Football.com', FOOTBALL, legs, (leg) => ({
    eventId: leg.eventId,
    marketId: String(leg.marketId),
    specifier: leg.specifier || null,
    outcomeId: String(leg.outcomeId),
  }));
}

async function bookMsport(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult> {
  const headers = { ...JSON_HEADERS, operid: '3' };
  const offered = legs.length;
  try {
    const priced: BetradarLeg[] = [];
    for (const leg of legs) {
      const probe = await client.request({
        method: 'POST',
        url: MSPORT,
        body: { selections: [msportSelection(leg)] },
        headers,
      });
      if (parseBizShare(probe, '').code !== null || (probe as { bizCode?: number }).bizCode === 10000) priced.push(leg);
    }
    if (!priced.length) return result('msport', 'MSport', false, null, null, 0, offered, 'MSport could not price any leg');
    const posted = await client.request({
      method: 'POST',
      url: MSPORT,
      body: { selections: priced.map(msportSelection) },
      headers,
    });
    const code = parseBizShare(posted, 'MSport refused the slip').code;
    if (!code) return result('msport', 'MSport', false, null, null, 0, offered, 'MSport refused the slip');
    const verified = await client.request({ method: 'GET', url: `${MSPORT}/${encodeURIComponent(code)}`, headers });
    const check = parseMsportVerify(verified);
    return result('msport', 'MSport', true, code, check.totalOdds, check.legs || priced.length, offered, null);
  } catch (error) {
    return result('msport', 'MSport', false, null, null, 0, offered, message(error));
  }
}

function msportSelection(leg: BetradarLeg) {
  return {
    eventId: leg.eventId,
    marketId: String(leg.marketId),
    specifier: leg.specifier || '',
    outcomeId: String(leg.outcomeId),
  };
}

async function bookCopy(
  client: JsonClient,
  id: BookieResult['id'],
  name: string,
  url: string,
  legs: BetradarLeg[],
  select: (leg: BetradarLeg) => unknown,
): Promise<BookieResult> {
  const offered = legs.length;
  try {
    let working = legs;
    let posted = await client.request({ method: 'POST', url, body: { selections: working.map(select) }, headers: JSON_HEADERS });
    if ((posted as { bizCode?: number }).bizCode !== 10000) {
      const kept: BetradarLeg[] = [];
      for (const leg of legs) {
        const one = await client.request({ method: 'POST', url, body: { selections: [select(leg)] }, headers: JSON_HEADERS });
        if ((one as { bizCode?: number }).bizCode === 10000) kept.push(leg);
      }
      if (!kept.length) return result(id, name, false, null, null, 0, offered, `${name} could not price any leg`);
      working = kept;
      posted = await client.request({ method: 'POST', url, body: { selections: working.map(select) }, headers: JSON_HEADERS });
    }
    const code = parseBizShare(posted, `${name} refused the slip`).code;
    if (!code) return result(id, name, false, null, null, 0, offered, `${name} refused the slip`);
    const odds = working.map((leg) => leg.odds).filter((price): price is number => price != null);
    const total = odds.length ? Math.round(odds.reduce((sum, price) => sum * price, 1) * 100) / 100 : null;
    return result(id, name, true, code, total, working.length, offered, null);
  } catch (error) {
    return result(id, name, false, null, null, 0, offered, message(error));
  }
}

async function bookBetika(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult> {
  const offered = legs.length;
  try {
    const posted = await client.request({
      method: 'POST',
      url: `${BETIKA}encode`,
      headers: JSON_HEADERS,
      body: {
        profile_id: 0,
        bet_id: null,
        token: null,
        src: 'MOBILE_WEB',
        product_type: 'PREMATCH',
        betslip: legs.map((leg) => ({
          odd_key: '',
          outcome_id: String(leg.outcomeId),
          special_bet_value: leg.specifier || '',
          parent_match_id: leg.eventId.split(':').pop(),
          sub_type_id: String(leg.marketId),
          has_parent: null,
          parent_code: null,
        })),
      },
    });
    const code = parseBetikaEncode(posted);
    if (!code) return result('betika', 'Betika', false, null, null, 0, offered, 'Betika did not return a code');
    const decoded = await client.request({
      method: 'GET',
      url: `${BETIKA}decode?code=${encodeURIComponent(code)}&src=MOBILE_WEB`,
      headers: JSON_HEADERS,
    });
    const check = parseBetikaDecode(decoded);
    if (!check.legs) return result('betika', 'Betika', false, code, null, 0, offered, 'Betika decoded no valid legs');
    return result('betika', 'Betika', true, code, check.totalOdds, check.legs, offered, null);
  } catch (error) {
    return result('betika', 'Betika', false, null, null, 0, offered, message(error));
  }
}

const BETPAWA_MARKETS: Record<string, { type: string; line: boolean; names: Record<string, string> }> = {
  '1': { type: '3743', line: false, names: { '1': '1', '2': 'X', '3': '2' } },
  '10': { type: '4693', line: false, names: { '9': '1X', '10': '12', '11': 'X2' } },
  '18': { type: '5000', line: true, names: { '12': 'Over', '13': 'Under' } },
  '19': { type: '5006', line: true, names: { '12': 'Over', '13': 'Under' } },
  '20': { type: '5003', line: true, names: { '12': 'Over', '13': 'Under' } },
  '29': { type: '3795', line: false, names: { '74': 'Yes', '76': 'No' } },
};

async function bookBetpawa(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult> {
  const headers = {
    ...JSON_HEADERS,
    'x-pawa-brand': 'betpawa-ghana',
    'x-pawa-language': 'en',
    devicetype: 'web',
  };
  const offered = legs.length;
  const ids: string[] = [];
  const odds: number[] = [];
  try {
    for (const leg of legs) {
      const priced = await betpawaPrice(client, leg, headers);
      if (priced) {
        ids.push(priced.id);
        odds.push(priced.odds);
      }
    }
    if (!ids.length) return result('betpawa', 'Betpawa', false, null, null, 0, offered, 'Betpawa could not match the events');
    const posted = await client.request({
      method: 'POST',
      url: `${BETPAWA}v3/booking-number`,
      headers,
      body: { selections: { selections: [{ type: ids.length > 1 ? 'COMBO' : 'SINGLE', selections: ids }] } },
    });
    const code = parseBetpawaCode(posted);
    if (!code) return result('betpawa', 'Betpawa', false, null, null, 0, offered, 'Betpawa did not return a booking number');
    const verified = await client.request({ method: 'GET', url: `${BETPAWA}v3/booking-number/${encodeURIComponent(code)}`, headers });
    const count = parseBetpawaVerify(verified) || ids.length;
    const total = Math.round(odds.reduce((sum, price) => sum * price, 1) * 100) / 100;
    return result('betpawa', 'Betpawa', true, code, total, count, offered, null);
  } catch (error) {
    return result('betpawa', 'Betpawa', false, null, null, 0, offered, message(error));
  }
}

async function betpawaPrice(
  client: JsonClient,
  leg: BetradarLeg,
  headers: Record<string, string>,
): Promise<{ id: string; odds: number } | null> {
  const map = BETPAWA_MARKETS[leg.marketId];
  if (!map) return null;
  const sr = leg.eventId.split(':').pop() || '';
  const query = leg.match.split(/\s+v(?:s)?\s+/i)[0] || leg.match;
  const search = await client.request({
    method: 'GET',
    url: `${BETPAWA}v3/search?name=${encodeURIComponent(query)}`,
    headers,
  });
  const eventId = betpawaEventId(search, sr);
  if (!eventId) return null;
  const event = await client.request({ method: 'GET', url: `${BETPAWA}v4/events/${encodeURIComponent(eventId)}`, headers });
  const want = map.names[leg.outcomeId];
  const handicap = map.line ? betpawaHandicap(leg.specifier) : null;
  const markets = ((event as { markets?: unknown[] }).markets ?? []) as Array<{
    marketType?: { id?: string };
    row?: Array<{ handicap?: number; prices?: Array<{ name?: string; id?: string; odds?: number; suspended?: boolean }> }>;
  }>;
  for (const market of markets) {
    if (String(market.marketType?.id) !== map.type) continue;
    for (const row of market.row ?? []) {
      if (handicap != null && row.handicap !== handicap) continue;
      for (const price of row.prices ?? []) {
        if (price.name === want && !price.suspended && (price.odds ?? 0) > 1 && price.id) {
          return { id: String(price.id), odds: Number(price.odds) };
        }
      }
    }
  }
  return null;
}

function result(
  id: BookieResult['id'],
  name: string,
  ok: boolean,
  code: string | null,
  totalOdds: number | null,
  legs: number,
  offered: number,
  reason: string | null,
): BookieResult {
  return {
    id,
    name,
    ok,
    code,
    shareUrl: ok && code ? shareLink(id, code) : null,
    totalOdds,
    legs,
    offered,
    reason,
  };
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Request failed';
  if (/403|forbidden|challenge/i.test(text)) return 'Blocked from this network (403). It should work on a Ghana connection.';
  return text.slice(0, 180);
}

/** Book on SportyBet, read the code back, then rebook those Betradar legs everywhere else. */
export async function bookFromPicks(client: JsonClient, picks: PickToBook[], fixtures?: SportyFixture[]): Promise<BookieResult[]> {
  const needsLookup = picks.some((pick) => !pick.eventId?.startsWith('sr:'));
  const events = needsLookup ? (fixtures ?? (await loadSportyFixtures(client))) : (fixtures ?? []);
  const mapped = picksToLegs(picks, events);
  if (!mapped.legs.length) {
    const reason = mapped.missed[0] || 'No picks could be matched on SportyBet';
    return [result('sportybet', 'SportyBet', false, null, null, 0, picks.length, reason)];
  }
  const sporty = await bookSporty(client, mapped.legs);
  if (!sporty.ok || !sporty.code) return [sporty];
  const decoded = await readSportyCode(client, sporty.code);
  const others = await convertLegs(client, decoded.legs);
  return [sporty, ...others];
}

export async function convertSportyCode(client: JsonClient, code: string): Promise<BookieResult[]> {
  const decoded = await readSportyCode(client, code);
  const sporty = result('sportybet', 'SportyBet', true, decoded.code, decoded.totalOdds, decoded.legs.length, decoded.legs.length, null);
  return [sporty, ...(await convertLegs(client, decoded.legs))];
}

async function convertLegs(client: JsonClient, legs: BetradarLeg[]): Promise<BookieResult[]> {
  const jobs = [bookFootball(client, legs), bookMsport(client, legs), bookBetika(client, legs), bookBetpawa(client, legs)];
  const settled = await Promise.all(jobs.map((job) => job.catch((error: unknown) => result('football', 'Football.com', false, null, null, 0, legs.length, message(error)))));
  return settled;
}

export function phoneClient(fetchImpl: typeof fetch = fetch): JsonClient {
  return {
    async request(input) {
      const response = await fetchImpl(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body == null ? undefined : JSON.stringify(input.body),
      });
      const text = await response.text();
      if (!text) throw new Error(`${response.status || 'Network'} from ${hostOf(input.url)}`);
      try {
        const parsed = JSON.parse(text) as unknown;
        if (response.status === 403) throw new Error(`403 from ${hostOf(input.url)}`);
        return parsed;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('403')) throw error;
        throw new Error(`${response.status} from ${hostOf(input.url)} was not JSON`);
      }
    },
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'bookie';
  }
}
