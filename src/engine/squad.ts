import type { SquadStrength } from '../domain';

const USUAL_RATE = 0.6;
const MIN_LINEUPS = 3;

export interface SquadReport {
  strength: SquadStrength;
  rotationFlag: boolean;
  usual: string[];
  present: string[];
  missing: string[];
  rotatedIn: string[];
  ratio: number | null;
}

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Usual starter: named in at least 60% of the recent starting XIs (minimum three lineups).
 * Full strength: at least 90% of those usual starters are in today's XI.
 * Half strength: under 60% of the usual starters are out there.
 * Rotation: three or more usual starters are missing.
 */
export function assessSquad(recentXIs: string[][], todayXI: string[] | null): SquadReport {
  const unknown: SquadReport = {
    strength: 'unknown',
    rotationFlag: false,
    usual: [],
    present: [],
    missing: [],
    rotatedIn: [],
    ratio: null,
  };
  if (!todayXI || todayXI.length === 0 || recentXIs.length < MIN_LINEUPS) return unknown;

  const counts = new Map<string, { name: string; n: number }>();
  for (const xi of recentXIs) {
    const seen = new Set<string>();
    for (const name of xi) {
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const prev = counts.get(key);
      counts.set(key, { name: prev?.name ?? name.trim(), n: (prev?.n ?? 0) + 1 });
    }
  }

  const usualEntries = [...counts.values()].filter((entry) => entry.n / recentXIs.length + 1e-9 >= USUAL_RATE);
  if (usualEntries.length === 0) return unknown;

  const todayKeys = new Set(todayXI.map(norm).filter(Boolean));
  const todayDisplay = new Map(todayXI.map((name) => [norm(name), name.trim()]));
  const usualKeys = new Set(usualEntries.map((entry) => norm(entry.name)));
  const present = usualEntries.filter((entry) => todayKeys.has(norm(entry.name))).map((entry) => entry.name);
  const missing = usualEntries.filter((entry) => !todayKeys.has(norm(entry.name))).map((entry) => entry.name);
  const rotatedIn = [...todayKeys].filter((key) => !usualKeys.has(key)).map((key) => todayDisplay.get(key) || key);
  const ratio = present.length / usualEntries.length;
  const strength: SquadStrength = ratio + 1e-9 >= 0.9 ? 'full' : ratio + 1e-9 >= 0.6 ? 'mixed' : 'half';
  return {
    strength,
    rotationFlag: missing.length >= 3,
    usual: usualEntries.map((entry) => entry.name),
    present,
    missing,
    rotatedIn,
    ratio,
  };
}

export function strengthLabel(report: SquadReport): string {
  if (report.strength === 'unknown') return 'Squad not compared yet';
  if (report.strength === 'full') return 'Full strength';
  if (report.strength === 'half') return 'Half strength';
  return 'Changed squad';
}
