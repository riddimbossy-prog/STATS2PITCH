import { useMemo, useState, type ReactNode } from 'react';
import { PickCard } from '../../components/PickCard';
import { Button, Empty, Loading, Screen, Section, Segment, T } from '../../components/ui';
import { groupByConfidence, groupByMarket, groupByOdds, withGreenFirst, type OddsDirection } from '../../src/engine';
import { pct } from '../../src/format';
import { useBoard } from '../../src/state/board';

type Mode = 'confidence' | 'market' | 'odds';

export default function PicksScreen() {
  const board = useBoard();
  const [mode, setMode] = useState<Mode>('confidence');
  const [direction, setDirection] = useState<OddsDirection>('desc');
  const picks = useMemo(() => withGreenFirst(board.visiblePicks, board.lists), [board.visiblePicks, board.lists]);
  const groups =
    mode === 'market' ? groupByMarket(picks) : mode === 'odds' ? groupByOdds(picks, direction) : groupByConfidence(picks);
  const banner = board.sample ? 'Sample tips, grouped by the same engine the live board uses.' : null;

  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing} banner={banner}>
      <T dim>Anything at 80% or above is tipped. Confidence rises when the opponent's record agrees.</T>
      <Segment
        value={mode}
        onChange={setMode}
        options={[
          { value: 'confidence', label: 'Confidence' },
          { value: 'market', label: 'Market' },
          { value: 'odds', label: 'Odds' },
        ]}
      />
      {mode === 'odds' ? (
        <Button label={direction === 'asc' ? 'Odds low to high' : 'Odds high to low'} tone="ghost" onPress={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))} />
      ) : null}
      {board.progress ? <Loading label={`Reading team history ${board.progress.done}/${board.progress.total}`} /> : null}
      {board.hiddenCount > 0 ? <T dim>{board.hiddenCount} picks hidden by your blacklist.</T> : null}
      {!board.progress && picks.length === 0 ? (
        <Empty title="No 80% tips yet" body="Trends need five matches at 80% or better. Form can tip a head start from the last five when the longer trend is still short." />
      ) : null}
      {groups.map((group) => (
        <ViewGroup key={group.key} title={group.title} count={group.picks.length}>
          {group.picks.map((pick, index) => (
            <PickCard
              key={pick.id}
              index={index}
              pick={pick}
              tracked={board.isTracked(pick.id)}
              drafted={board.draftIds.includes(pick.id)}
              green={board.green(pick)}
              onTrack={() => board.track(pick)}
              onSlip={() => board.toggleDraft(pick.id)}
            />
          ))}
        </ViewGroup>
      ))}
      {picks.length > 0 ? <T dim>{picks.length} tips · top confidence {pct(Math.max(...picks.map((pick) => pick.confidence)))}</T> : null}
    </Screen>
  );
}

function ViewGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <>
      <Section title={title} action={String(count)} />
      {children}
    </>
  );
}
