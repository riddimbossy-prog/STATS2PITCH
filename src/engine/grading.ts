import type { GradeLetter, GradePeriod, MarketId } from '../domain';
import { MARKET_LABEL } from './markets';

export interface SettledRecord {
  id: string;
  label: string;
  market: MarketId;
  teamId: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  status: 'won' | 'lost' | 'void';
  settledAt: number;
}

export interface GradeRow {
  key: string;
  name: string;
  wins: number;
  losses: number;
  voids: number;
  sample: number;
  rate: number;
  grade: GradeLetter;
  lucky: boolean;
}

export interface GradeReport {
  period: GradePeriod;
  start: number;
  end: number;
  overall: GradeRow;
  landed: SettledRecord[];
  markets: GradeRow[];
  teams: GradeRow[];
  competitions: GradeRow[];
}

export function letterGrade(rate: number, sample: number): GradeLetter {
  if (sample < 1) return 'D';
  if (rate >= 0.8) return 'A+';
  if (rate >= 0.7) return 'A';
  if (rate >= 0.6) return 'B';
  if (rate >= 0.5) return 'C';
  return 'D';
}

/** Calendar week starts Monday 00:00 UTC. Month and year use UTC boundaries. */
export function periodBounds(period: GradePeriod, now: number): { start: number; end: number } {
  const date = new Date(now);
  if (period === 'year') return { start: Date.UTC(date.getUTCFullYear(), 0, 1), end: now };
  if (period === 'month') return { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1), end: now };
  const day = date.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  return { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - delta), end: now };
}

function toRow(
  key: string,
  name: string,
  wins: number,
  losses: number,
  voids: number,
): GradeRow {
  const sample = wins + losses;
  const rate = sample === 0 ? 0 : wins / sample;
  return { key, name, wins, losses, voids, sample, rate, grade: letterGrade(rate, sample), lucky: false };
}

function bucket(
  rows: SettledRecord[],
  keyFn: (row: SettledRecord) => string,
  nameFn: (row: SettledRecord) => string,
): GradeRow[] {
  const map = new Map<string, { name: string; wins: number; losses: number; voids: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = map.get(key) ?? { name: nameFn(row), wins: 0, losses: 0, voids: 0 };
    if (row.status === 'won') current.wins += 1;
    else if (row.status === 'lost') current.losses += 1;
    else current.voids += 1;
    map.set(key, current);
  }
  const built = [...map.entries()].map(([key, value]) => toRow(key, value.name, value.wins, value.losses, value.voids));
  const eligible = built.filter((row) => row.sample >= 3);
  const best = eligible.reduce((max, row) => Math.max(max, row.rate), -1);
  if (best >= 0) {
    for (const row of built) {
      if (row.sample >= 3 && Math.abs(row.rate - best) < 1e-9) row.lucky = true;
    }
  }
  built.sort((a, b) => b.rate - a.rate || b.sample - a.sample || a.name.localeCompare(b.name));
  return built;
}

export function gradePeriod(records: SettledRecord[], period: GradePeriod, now: number): GradeReport {
  const bounds = periodBounds(period, now);
  const rows = records.filter((row) => row.settledAt >= bounds.start && row.settledAt <= bounds.end);
  const wins = rows.filter((row) => row.status === 'won').length;
  const losses = rows.filter((row) => row.status === 'lost').length;
  const voids = rows.filter((row) => row.status === 'void').length;
  return {
    period,
    start: bounds.start,
    end: bounds.end,
    overall: toRow('all', 'All of your tips', wins, losses, voids),
    landed: rows.filter((row) => row.status === 'won').sort((a, b) => b.settledAt - a.settledAt),
    markets: bucket(rows, (row) => row.market, (row) => MARKET_LABEL[row.market]),
    teams: bucket(rows, (row) => row.teamId, (row) => row.teamName),
    competitions: bucket(rows, (row) => row.competitionId, (row) => row.competitionName),
  };
}
