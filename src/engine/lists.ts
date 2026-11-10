import type { ListEntry, ListKind, ListScope, TrackedPick } from '../domain';
import { MARKET_LABEL } from './markets';
import type { Pick } from './picks';

export function listRecommendation(
  history: Array<'won' | 'lost'>,
): { kind: ListKind; reason: string } | null {
  const recent = history.slice(0, 8);
  if (recent.length >= 3 && recent.slice(0, 3).every((status) => status === 'lost')) {
    return { kind: 'black', reason: 'Last 3 settled picks bust' };
  }
  if (recent.length >= 3 && recent.slice(0, 3).every((status) => status === 'won')) {
    return { kind: 'green', reason: 'Last 3 settled picks landed' };
  }
  if (recent.length >= 5) {
    const losses = recent.filter((status) => status === 'lost').length;
    const wins = recent.filter((status) => status === 'won').length;
    if (losses / recent.length >= 0.7) {
      return { kind: 'black', reason: `${losses} of the last ${recent.length} bust` };
    }
    if (wins / recent.length >= 0.8) {
      return { kind: 'green', reason: `${wins} of the last ${recent.length} landed` };
    }
  }
  return null;
}

function matches(entry: ListEntry, scope: ListScope, refId: string, name: string): boolean {
  if (entry.scope !== scope) return false;
  if (entry.refId === refId) return true;
  return entry.name.trim().toLowerCase() === name.trim().toLowerCase();
}

export function isSuppressed(pick: Pick, lists: ListEntry[]): boolean {
  return lists.some(
    (entry) =>
      entry.kind === 'black' &&
      (matches(entry, 'team', pick.teamId, pick.teamName) ||
        matches(entry, 'team', pick.opponentId, pick.opponentName) ||
        matches(entry, 'league', pick.leagueId, pick.leagueName) ||
        matches(entry, 'competition', pick.competitionId, pick.competitionName) ||
        matches(entry, 'market', pick.market, pick.label) ||
        matches(entry, 'market', pick.marketKey, pick.label)),
  );
}

export function isGreenlit(pick: Pick, lists: ListEntry[]): boolean {
  return lists.some(
    (entry) =>
      entry.kind === 'green' &&
      (matches(entry, 'team', pick.teamId, pick.teamName) ||
        matches(entry, 'league', pick.leagueId, pick.leagueName) ||
        matches(entry, 'competition', pick.competitionId, pick.competitionName) ||
        matches(entry, 'market', pick.market, pick.label) ||
        matches(entry, 'market', pick.marketKey, pick.label)),
  );
}

export function withGreenFirst<T extends Pick>(picks: T[], lists: ListEntry[]): T[] {
  return [...picks].sort((a, b) => Number(isGreenlit(b, lists)) - Number(isGreenlit(a, lists)));
}

export function autoListEntries(tracked: TrackedPick[], now: number): ListEntry[] {
  const buckets = new Map<string, { scope: ListScope; refId: string; name: string; rows: { status: 'won' | 'lost'; at: number }[] }>();
  const add = (scope: ListScope, refId: string, name: string, status: 'won' | 'lost', at: number) => {
    if (!refId) return;
    const key = `${scope}:${refId}`;
    const bucket = buckets.get(key) ?? { scope, refId, name, rows: [] };
    bucket.rows.push({ status, at });
    buckets.set(key, bucket);
  };
  for (const pick of tracked) {
    if (pick.status !== 'won' && pick.status !== 'lost') continue;
    const at = pick.settledAt ?? pick.createdAt;
    add('team', pick.teamId, pick.teamName, pick.status, at);
    add('market', pick.market, MARKET_LABEL[pick.market], pick.status, at);
    add('competition', pick.competitionId, pick.competitionName, pick.status, at);
    add('league', pick.leagueId, pick.leagueName, pick.status, at);
  }
  const entries: ListEntry[] = [];
  for (const bucket of buckets.values()) {
    const history = bucket.rows.sort((a, b) => b.at - a.at).map((row) => row.status);
    const recommendation = listRecommendation(history);
    if (!recommendation) continue;
    entries.push({
      id: `${recommendation.kind}:${bucket.scope}:${bucket.refId}`,
      kind: recommendation.kind,
      scope: bucket.scope,
      refId: bucket.refId,
      name: bucket.name,
      source: 'auto',
      reason: recommendation.reason,
      createdAt: now,
    });
  }
  return entries;
}

export function mergeAutoLists(current: ListEntry[], auto: ListEntry[]): { lists: ListEntry[]; changed: boolean } {
  const manualBlocks = (entry: ListEntry) =>
    current.some((item) => item.source === 'manual' && item.scope === entry.scope && item.refId === entry.refId);
  const keptAuto = current.filter((entry) => entry.source === 'auto' && auto.some((item) => item.id === entry.id) && !manualBlocks(entry));
  const manual = current.filter((entry) => entry.source === 'manual');
  let lists = [...manual, ...keptAuto];
  let changed = lists.length !== current.length || current.some((entry) => entry.source === 'auto' && !lists.includes(entry));
  for (const entry of auto) {
    if (manualBlocks(entry)) continue;
    const index = lists.findIndex((item) => item.id === entry.id);
    if (index === -1) {
      lists = [...lists, entry];
      changed = true;
      continue;
    }
    const existing = lists[index];
    if (!existing) continue;
    if (existing.kind !== entry.kind || existing.reason !== entry.reason || existing.name !== entry.name) {
      lists = lists.map((item) => (item.id === entry.id ? { ...entry, createdAt: existing.createdAt } : item));
      changed = true;
    }
  }
  return { lists, changed };
}
