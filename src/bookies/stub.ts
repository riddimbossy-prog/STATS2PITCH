export interface BookedLeg {
  id: string;
  label: string;
  odds: number | null;
}

export interface BookingResult {
  code: string;
  stub: true;
  message: string;
}

export interface BookieAdapter {
  id: string;
  name: string;
  book(legs: BookedLeg[], stake: number | null, now?: number): Promise<BookingResult>;
}

function bookingCode(bookieId: string, legs: BookedLeg[], now: number): string {
  const raw = `${bookieId}:${legs.map((leg) => leg.id).join('|')}:${now}`;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const body = (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `S2P-${bookieId.slice(0, 3).toUpperCase()}-${body}`;
}

function stubBookie(id: string, name: string): BookieAdapter {
  return {
    id,
    name,
    async book(legs, _stake, now = Date.now()) {
      return {
        code: bookingCode(id, legs, now),
        stub: true,
        message: `${name} is not connected. This code stays on the phone and was not sent to the bookie.`,
      };
    },
  };
}

export const BOOKIES: BookieAdapter[] = [
  stubBookie('sportybet', 'SportyBet'),
  stubBookie('bet365', 'Bet365'),
  stubBookie('1xbet', '1xBet'),
  stubBookie('betway', 'Betway'),
];

export function getBookie(id: string): BookieAdapter {
  return BOOKIES.find((bookie) => bookie.id === id) ?? BOOKIES[0]!;
}
