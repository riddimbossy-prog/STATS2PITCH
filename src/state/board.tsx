import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getBookie } from '../bookies/stub';
import { cacheFromRepo, getRepo, type Repo } from '../db/repo';
import type { ListEntry, ListKind, ListScope, Match, MatchDetail, Slip, TrackedPick } from '../domain';
import { createSofascoreSource, type DataSource } from '../data/sofascore';
import { buildPicks, isGreenlit, isSuppressed, reconcile, suggestSimilar, type Pick, type Suggestion } from '../engine';
import type { Notice } from '../engine/notify';
import type { Snapshot } from '../engine/notify';
import { sampleHistory, samplePack } from '../fixtures/sample';
import { localDate, uid } from '../format';
import { deliverLocal } from '../notifications/deliver';

export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: Notice['tone'];
}

interface BoardContextValue {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  sample: boolean;
  storage: 'sqlite' | 'document' | null;
  fetchedAt: number | null;
  refreshing: boolean;
  progress: { done: number; total: number } | null;
  matches: Match[];
  picks: Pick[];
  visiblePicks: Pick[];
  hiddenCount: number;
  details: Record<string, MatchDetail>;
  lineupHistory: Record<string, string[][]>;
  lists: ListEntry[];
  tracked: TrackedPick[];
  slips: Slip[];
  suggestions: Suggestion[];
  toasts: Toast[];
  draftIds: string[];
  bookieId: string;
  stake: string;
  refresh: () => void;
  openSample: () => void;
  loadMatch: (id: string) => Promise<void>;
  confirmSampleVar: (id: string) => void;
  track: (pick: Pick) => void;
  toggleDraft: (id: string) => void;
  setBookieId: (id: string) => void;
  setStake: (value: string) => void;
  bookDraft: () => Promise<string | null>;
  addList: (input: { kind: ListKind; scope: ListScope; name: string; refId?: string }) => void;
  removeList: (id: string) => void;
  dismissToast: (id: string) => void;
  isTracked: (id: string) => boolean;
  green: (pick: Pick) => boolean;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error('useBoard must be used inside BoardProvider');
  return value;
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repo | null>(null);
  const sourceRef = useRef<DataSource | null>(null);
  const sampleRef = useRef(false);
  const snapshots = useRef<Record<string, Snapshot>>({});
  const slipStatuses = useRef<Record<string, Slip['status']>>({});
  const seen = useRef(new Set<string>());
  const historiesRef = useRef<Record<string, import('../domain').ResultRow[]>>({});
  const matchesRef = useRef<Match[]>([]);
  const loadMatchRef = useRef<(id: string, quiet?: boolean) => Promise<void>>(async () => undefined);

  const [booted, setBooted] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [storage, setStorage] = useState<'sqlite' | 'document' | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [histories, setHistories] = useState<Record<string, import('../domain').ResultRow[]>>({});
  const [details, setDetails] = useState<Record<string, MatchDetail>>({});
  const [lineupHistory, setLineupHistory] = useState<Record<string, string[][]>>({});
  const [lists, setLists] = useState<ListEntry[]>([]);
  const [tracked, setTracked] = useState<TrackedPick[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [bookieId, setBookieId] = useState(getBookie('sportybet').id);
  const [stake, setStake] = useState('10');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = await getRepo();
      if (cancelled) return;
      repoRef.current = repo;
      sourceRef.current = createSofascoreSource({ cache: cacheFromRepo(repo) });
      const [storedLists, storedTracked, storedSlips] = await Promise.all([repo.lists(), repo.tracked(), repo.slips()]);
      if (cancelled) return;
      setLists(storedLists);
      setTracked(storedTracked);
      setSlips(storedSlips);
      setStorage(repo.kind);
      setBooted(true);
      await loadBoard(false);
    })();
    return () => {
      cancelled = true;
    };
    // The boot load is intentional and reads the latest closures through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!booted || sample) return;
    const timer = setInterval(() => {
      void refreshScores();
    }, 10_000);
    return () => clearInterval(timer);
    // refreshScores closes over the latest source ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, sample]);

  useEffect(() => {
    if (!booted) return;
    const result = reconcile({
      matches,
      details,
      tracked,
      slips,
      lists,
      snapshots: snapshots.current,
      slipStatuses: slipStatuses.current,
      now: Date.now(),
    });
    snapshots.current = result.snapshots;
    slipStatuses.current = result.slipStatuses;
    if (result.trackedChanged) setTracked(result.tracked);
    if (result.slipsChanged) setSlips(result.slips);
    if (result.listsChanged) setLists(result.lists);
    const repo = repoRef.current;
    if (repo) {
      if (result.trackedChanged) void Promise.all(result.tracked.map((row) => repo.saveTracked(row)));
      if (result.slipsChanged) void Promise.all(result.slips.map((row) => repo.saveSlip(row)));
      if (result.listsChanged) void repo.replaceLists(result.lists);
    }
    if (result.notices.length) void publish(result.notices);
  }, [booted, matches, details, tracked, slips, lists]);

  const picks = useMemo(
    () =>
      matches.flatMap((match) =>
        buildPicks({
          matchId: match.id,
          home: match.home,
          away: match.away,
          competitionId: match.competition.id,
          competitionName: match.competition.name,
          leagueId: match.league.id,
          leagueName: match.league.name,
          kickoff: match.kickoff,
          homeResults: histories[match.home.id] ?? [],
          awayResults: histories[match.away.id] ?? [],
          odds: details[match.id]?.odds ?? {},
        }),
      ),
    [matches, histories, details],
  );
  const visiblePicks = useMemo(() => picks.filter((pick) => !isSuppressed(pick, lists)), [picks, lists]);
  const suggestions = useMemo(() => {
    const anchors = tracked.map((pick) => ({
      id: pick.id,
      matchId: pick.matchId,
      market: pick.market,
      confidence: pick.confidence,
      teamRate: pick.teamRate,
      formRate: pick.formRate,
    }));
    const pool = visiblePicks.map((pick) => ({
      id: pick.id,
      matchId: pick.matchId,
      market: pick.market,
      confidence: pick.confidence,
      teamRate: pick.teamRate,
      formRate: pick.formRate,
    }));
    return suggestSimilar(anchors, pool, 8);
  }, [tracked, visiblePicks]);

  async function publish(notices: Notice[]) {
    const repo = repoRef.current;
    for (const notice of notices) {
      if (seen.current.has(notice.key)) continue;
      seen.current.add(notice.key);
      if (repo && (await repo.hasNotice(notice.key))) continue;
      await repo?.saveNotice(notice);
      const toast: Toast = { id: notice.key, title: notice.title, body: notice.body, tone: notice.tone };
      setToasts((current) => [toast, ...current].slice(0, 4));
      void deliverLocal(notice.title, notice.body);
      setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4600);
    }
  }

  async function loadBoard(fresh: boolean) {
    if (sampleRef.current) {
      applySample();
      return;
    }
    const source = sourceRef.current;
    if (!source) return;
    if (!fresh) setPhase((current) => (current === 'ready' ? 'ready' : 'loading'));
    const date = localDate();
    const [scheduled, live] = await Promise.all([source.scheduled(date, fresh), source.live(fresh)]);
    if (sampleRef.current) return;
    const rows = mergeMatches(scheduled.data ?? [], live.data ?? []);
    if (!scheduled.data && !live.data) {
      const message = scheduled.error || live.error || 'Sofascore did not respond.';
      setError(message);
      setPhase('error');
      if (process.env.EXPO_PUBLIC_OPEN_SAMPLE === '1') applySample();
      return;
    }
    setMatches(rows);
    setError(scheduled.error || live.error || null);
    setFetchedAt(Date.now());
    setPhase('ready');
    await loadHistories(rows, fresh);
  }

  async function refreshScores() {
    const source = sourceRef.current;
    if (!source || sampleRef.current) return;
    const date = localDate();
    const [scheduled, live] = await Promise.all([source.scheduled(date, true), source.live(true)]);
    if (sampleRef.current) return;
    if (!scheduled.data && !live.data) {
      setError(scheduled.error || live.error || 'Sofascore did not respond.');
      return;
    }
    const rows = mergeMatches(scheduled.data ?? [], live.data ?? []);
    setMatches(rows);
    setFetchedAt(Date.now());
    setError(scheduled.error || live.error || null);
    const interesting = rows.filter((match) => match.status === 'live').slice(0, 6);
    await Promise.all(interesting.map((match) => loadMatchRef.current(match.id, true)));
  }

  async function loadHistories(rows: Match[], fresh: boolean) {
    const source = sourceRef.current;
    if (!source) return;
    const ids = [...new Set(rows.flatMap((match) => [match.home.id, match.away.id]))];
    setProgress({ done: 0, total: ids.length });
    const next = { ...historiesRef.current };
    for (let index = 0; index < ids.length; index += 1) {
      if (sampleRef.current) return;
      const id = ids[index]!;
      if (!fresh && next[id]) {
        setProgress({ done: index + 1, total: ids.length });
        continue;
      }
      const result = await source.teamResults(id, fresh);
      if (result.data) next[id] = result.data;
      historiesRef.current = { ...next };
      setHistories({ ...next });
      setProgress({ done: index + 1, total: ids.length });
    }
    setProgress(null);
  }

  function applySample() {
    sampleRef.current = true;
    setSample(true);
    const pack = samplePack(Date.now());
    historiesRef.current = pack.histories;
    setMatches(pack.matches);
    setDetails(pack.details);
    setHistories(pack.histories);
    setLineupHistory(pack.lineups);
    setError(null);
    setPhase('ready');
    setProgress(null);
    setFetchedAt(Date.now());
    void seedHistory();
  }

  async function seedHistory() {
    const repo = repoRef.current;
    if (!repo) return;
    const existing = await repo.tracked();
    if (existing.some((row) => row.id.startsWith('seed-'))) return;
    const seeds = sampleHistory(Date.now());
    for (const row of seeds) await repo.saveTracked(row);
    setTracked((current) => [...current, ...seeds.filter((seed) => !current.some((row) => row.id === seed.id))]);
  }

  async function loadMatch(id: string, quiet = false) {
    if (sampleRef.current) return;
    const source = sourceRef.current;
    const match = matchesRef.current.find((item) => item.id === id);
    if (!source || !match) return;
    const detail = await source.match(id, true);
    if (detail.data) setDetails((current) => ({ ...current, [id]: detail.data! }));
    const [home, away] = await Promise.all([source.recentLineups(match.home.id), source.recentLineups(match.away.id)]);
    setLineupHistory((current) => ({
      ...current,
      ...(home.data ? { [match.home.id]: home.data } : {}),
      ...(away.data ? { [match.away.id]: away.data } : {}),
    }));
    if (!quiet && detail.error) setError(detail.error);
  }

  function confirmSampleVar(id: string) {
    setDetails((current) => {
      const detail = current[id];
      if (!detail) return current;
      return {
        ...current,
        [id]: {
          ...detail,
          varPending: false,
          incidents: detail.incidents.map((incident) =>
            incident.type === 'var' && incident.varState === 'pending' ? { ...incident, varState: 'awarded' as const } : incident,
          ),
        },
      };
    });
    setMatches((current) => current.map((match) => (match.id === id ? { ...match, varPending: false } : match)));
  }

  function track(pick: Pick) {
    if (tracked.some((row) => row.id === pick.id)) return;
    const row: TrackedPick = {
      id: pick.id,
      matchId: pick.matchId,
      marketKey: pick.marketKey,
      market: pick.market,
      side: pick.side,
      label: pick.label,
      teamId: pick.teamId,
      teamName: pick.teamName,
      opponentName: pick.opponentName,
      competitionId: pick.competitionId,
      competitionName: pick.competitionName,
      leagueId: pick.leagueId,
      leagueName: pick.leagueName,
      odds: pick.odds,
      confidence: pick.confidence,
      teamRate: pick.teamRate,
      formRate: pick.formRate,
      kind: pick.kind,
      status: 'pending',
      kickoff: pick.kickoff,
      settledAt: null,
      createdAt: Date.now(),
    };
    setTracked((current) => [...current, row]);
    void repoRef.current?.saveTracked(row);
  }

  function toggleDraft(id: string) {
    setDraftIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function bookDraft(): Promise<string | null> {
    const chosen = visiblePicks.filter((pick) => draftIds.includes(pick.id));
    if (!chosen.length) return 'Add at least one pick to the slip.';
    const stakeValue = stake.trim() ? Number(stake) : null;
    if (stake.trim() && !Number.isFinite(stakeValue)) return 'Stake needs to be a number.';
    const bookie = getBookie(bookieId);
    const booking = await bookie.book(
      chosen.map((pick) => ({ id: pick.id, label: pick.label, odds: pick.odds })),
      stakeValue,
    );
    const slip: Slip = {
      id: uid('slip'),
      bookieId: bookie.id,
      bookieName: bookie.name,
      code: booking.code,
      stub: true,
      stubMessage: booking.message,
      stake: stakeValue,
      status: 'open',
      createdAt: Date.now(),
      settledAt: null,
      legs: chosen.map((pick) => ({
        id: uid('leg'),
        pickId: pick.id,
        matchId: pick.matchId,
        market: pick.market,
        side: pick.side,
        label: pick.label,
        odds: pick.odds,
        status: 'pending',
      })),
    };
    setSlips((current) => [slip, ...current]);
    setDraftIds([]);
    void repoRef.current?.saveSlip(slip);
    for (const pick of chosen) track(pick);
    return null;
  }

  function addList(input: { kind: ListKind; scope: ListScope; name: string; refId?: string }) {
    const name = input.name.trim();
    if (!name) return;
    const refId = (input.refId || name).trim().toLowerCase().replace(/\s+/g, '-');
    const entry: ListEntry = {
      id: `${input.kind}:${input.scope}:${refId}`,
      kind: input.kind,
      scope: input.scope,
      refId,
      name,
      source: 'manual',
      reason: 'Added by you',
      createdAt: Date.now(),
    };
    setLists((current) => [...current.filter((item) => item.id !== entry.id), entry]);
    void repoRef.current?.saveList(entry);
  }

  function removeList(id: string) {
    setLists((current) => current.filter((item) => item.id !== id));
    void repoRef.current?.removeList(id);
  }

  matchesRef.current = matches;
  loadMatchRef.current = loadMatch;

  async function refresh() {
    setRefreshing(true);
    try {
      if (sampleRef.current) applySample();
      else await loadBoard(true);
    } finally {
      setRefreshing(false);
    }
  }

  const value: BoardContextValue = {
    phase,
    error,
    sample,
    storage,
    fetchedAt,
    refreshing,
    progress,
    matches,
    picks,
    visiblePicks,
    hiddenCount: picks.length - visiblePicks.length,
    details,
    lineupHistory,
    lists,
    tracked,
    slips,
    suggestions,
    toasts,
    draftIds,
    bookieId,
    stake,
    refresh,
    openSample: applySample,
    loadMatch: (id) => loadMatch(id),
    confirmSampleVar,
    track,
    toggleDraft,
    setBookieId,
    setStake,
    bookDraft,
    addList,
    removeList,
    dismissToast: (id) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    isTracked: (id) => tracked.some((row) => row.id === id),
    green: (pick) => isGreenlit(pick, lists),
  };

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

function mergeMatches(scheduled: Match[], live: Match[]): Match[] {
  const byId = new Map<string, Match>();
  for (const match of scheduled) byId.set(match.id, match);
  for (const match of live) byId.set(match.id, { ...byId.get(match.id), ...match });
  return [...byId.values()].sort((a, b) => {
    const rank = (match: Match) => (match.status === 'live' ? 0 : match.status === 'scheduled' ? 1 : 2);
    return rank(a) - rank(b) || a.kickoff - b.kickoff;
  });
}
