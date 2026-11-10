import type { ListEntry, Match, MatchDetail, Slip, TrackedPick } from '../domain';
import { mergeAutoLists, autoListEntries } from './lists';
import { noticesForTransition, slipNotices, type Notice, type Snapshot } from './notify';
import { marketSettled, settleSlip } from './settlement';
import { confirmedBoard } from './view';

export interface ReconcileInput {
  matches: Match[];
  details: Record<string, MatchDetail>;
  tracked: TrackedPick[];
  slips: Slip[];
  lists: ListEntry[];
  snapshots: Record<string, Snapshot>;
  slipStatuses: Record<string, Slip['status']>;
  now: number;
}

export interface ReconcileResult {
  tracked: TrackedPick[];
  slips: Slip[];
  lists: ListEntry[];
  notices: Notice[];
  snapshots: Record<string, Snapshot>;
  slipStatuses: Record<string, Slip['status']>;
  trackedChanged: boolean;
  slipsChanged: boolean;
  listsChanged: boolean;
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const notices: Notice[] = [];
  const snapshots = { ...input.snapshots };
  let tracked = input.tracked;
  let trackedChanged = false;

  for (const match of input.matches) {
    const next = confirmedBoard(match, input.details[match.id]);
    const prev = snapshots[match.id] ?? null;
    const related = tracked.filter((pick) => pick.matchId === match.id);
    const result = noticesForTransition({
      matchId: match.id,
      homeName: match.home.name,
      awayName: match.away.name,
      prev,
      next,
      tracked: related.map((pick) => ({
        id: pick.id,
        label: pick.label,
        market: pick.market,
        side: pick.side,
        status: pick.status,
      })),
    });
    notices.push(...result.notices);
    if (result.tracked.some((pick, index) => pick.status !== related[index]?.status)) {
      trackedChanged = true;
      const updates = new Map(result.tracked.map((pick) => [pick.id, pick.status]));
      tracked = tracked.map((pick) => {
        const status = updates.get(pick.id);
        if (!status || status === pick.status) return pick;
        return {
          ...pick,
          status,
          settledAt: status === 'pending' ? null : input.now,
        };
      });
    }
    snapshots[match.id] = next;
  }

  const slipStatuses = { ...input.slipStatuses };
  let slipsChanged = false;
  const slips = input.slips.map((slip) => {
    const legs = slip.legs.map((leg) => {
      const match = input.matches.find((item) => item.id === leg.matchId);
      if (!match) return leg;
      const board = snapshots[match.id] ?? confirmedBoard(match, input.details[match.id]);
      const status = marketSettled(leg.market, leg.side, board.score, board.status);
      return status === leg.status ? leg : { ...leg, status };
    });
    const nextStatus = settleSlip(legs.map((leg) => leg.status));
    const stored = slip.status === 'open' || slip.status === 'won' || slip.status === 'lost' || slip.status === 'void' ? slip.status : 'open';
    const previous = slipStatuses[slip.id] ?? stored;
    const legChanged = legs.some((leg, index) => leg.status !== slip.legs[index]?.status);
    if (previous !== nextStatus) {
      notices.push(
        ...slipNotices({
          slips: [{ id: slip.id, code: slip.code, previous, next: nextStatus }],
        }),
      );
    }
    slipStatuses[slip.id] = nextStatus;
    if (!legChanged && nextStatus === slip.status) return slip;
    slipsChanged = true;
    return {
      ...slip,
      legs,
      status: nextStatus,
      settledAt: nextStatus === 'open' ? null : slip.settledAt ?? input.now,
    };
  });

  const auto = autoListEntries(tracked, input.now);
  const merged = mergeAutoLists(input.lists, auto);
  return {
    tracked,
    slips,
    lists: merged.lists,
    notices,
    snapshots,
    slipStatuses,
    trackedChanged,
    slipsChanged,
    listsChanged: merged.changed,
  };
}
