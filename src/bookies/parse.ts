import type { BetradarLeg } from './markets';

export interface ParsedBooking {
  code: string | null;
  legs: BetradarLeg[];
  totalOdds: number | null;
  reason: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

function product(odds: number[]): number | null {
  if (!odds.length) return null;
  return Math.round(odds.reduce((total, price) => total * price, 1) * 100) / 100;
}

export function parseSportyPost(payload: unknown): { code: string | null; reason: string | null } {
  const root = asRecord(payload);
  if (!root) return { code: null, reason: 'SportyBet returned nothing' };
  if (root.bizCode !== 10000) return { code: null, reason: String(root.message || root.innerMsg || 'SportyBet refused the slip') };
  const data = asRecord(root.data);
  const code = typeof data?.shareCode === 'string' ? data.shareCode : null;
  return { code, reason: code ? null : 'SportyBet did not return a share code' };
}

/** GET /api/gh/orders/share/{code} → Betradar legs and the prices SportyBet accepted. */
export function parseSportyShare(payload: unknown): ParsedBooking {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  if (!data) return { code: null, legs: [], totalOdds: null, reason: 'SportyBet share could not be read' };
  const code = typeof data.shareCode === 'string' ? data.shareCode : null;
  const legs: BetradarLeg[] = [];
  for (const event of asArray(data.outcomes)) {
    const row = asRecord(event);
    if (!row) continue;
    const eventId = typeof row.eventId === 'string' ? row.eventId : '';
    const home = typeof row.homeTeamName === 'string' ? row.homeTeamName : 'Home';
    const away = typeof row.awayTeamName === 'string' ? row.awayTeamName : 'Away';
    for (const market of asArray(row.markets)) {
      const marketRow = asRecord(market);
      if (!marketRow) continue;
      for (const outcome of asArray(marketRow.outcomes)) {
        const outcomeRow = asRecord(outcome);
        if (!outcomeRow || !eventId) continue;
        legs.push({
          eventId,
          marketId: String(marketRow.id ?? ''),
          specifier: typeof marketRow.specifier === 'string' ? marketRow.specifier : '',
          outcomeId: String(outcomeRow.id ?? ''),
          odds: num(outcomeRow.odds),
          match: `${home} v ${away}`,
        });
      }
    }
  }
  return {
    code,
    legs,
    totalOdds: product(legs.map((leg) => leg.odds).filter((odds): odds is number => odds != null)),
    reason: legs.length ? null : 'SportyBet share had no open legs',
  };
}

export function parseBizShare(payload: unknown, emptyReason: string): { code: string | null; reason: string | null } {
  const root = asRecord(payload);
  if (!root) return { code: null, reason: emptyReason };
  if (root.bizCode !== 10000) return { code: null, reason: String(root.message || emptyReason) };
  const code = asRecord(root.data)?.shareCode;
  return { code: typeof code === 'string' ? code : null, reason: typeof code === 'string' ? null : emptyReason };
}

export function parseMsportVerify(payload: unknown): { legs: number; totalOdds: number | null } {
  const slips = asArray(asRecord(asRecord(payload)?.data)?.bettableBetSlip);
  const odds = slips
    .map((row) => num(asRecord(asRecord(row)?.outcome)?.odds))
    .filter((price): price is number => price != null);
  return { legs: slips.length, totalOdds: product(odds) };
}

export function parseBetikaEncode(payload: unknown): string | null {
  const code = asRecord(payload)?.code;
  return typeof code === 'string' && code ? code : null;
}

export function parseBetikaDecode(payload: unknown): { legs: number; totalOdds: number | null } {
  const rows = asArray(asRecord(payload)?.data).map(asRecord).filter((row): row is Record<string, unknown> => row != null);
  const valid = rows.filter((row) => String(row.valid) === '1');
  const odds = valid.map((row) => num(row.odd_value)).filter((price): price is number => price != null);
  return { legs: valid.length, totalOdds: product(odds) };
}

export function betpawaEventId(payload: unknown, sportradarId: string): string | null {
  const events = asArray(asRecord(payload)?.events);
  for (const event of events) {
    const row = asRecord(event);
    if (!row) continue;
    const widgets = asArray(row.widgets).map(asRecord);
    const match = widgets.some((widget) => widget?.type === 'SPORTRADAR' && String(widget.id) === sportradarId);
    if (match && row.id != null) return String(row.id);
  }
  return null;
}

/** Betpawa stores the goals line as handicap = line * 4. */
export function betpawaHandicap(specifier: string): number | null {
  const match = specifier.match(/total=([\d.]+)/);
  if (!match) return null;
  return Math.round(Number(match[1]) * 4);
}

export function parseBetpawaCode(payload: unknown): string | null {
  const code = asRecord(payload)?.code;
  return typeof code === 'string' && code ? code : null;
}

export function parseBetpawaVerify(payload: unknown): number {
  return asArray(asRecord(payload)?.items).reduce<number>((count, item) => count + asArray(asRecord(item)?.selections).length, 0);
}
