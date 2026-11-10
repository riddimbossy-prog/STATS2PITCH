import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { PickCard } from '../components/PickCard';
import { Empty, Screen, T } from '../components/ui';
import { pct } from '../src/format';
import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';

export default function SuggestionsScreen() {
  const board = useBoard();
  const router = useRouter();
  const picks = board.suggestions
    .map((suggestion) => {
      const pick = board.visiblePicks.find((item) => item.id === suggestion.pickId);
      return pick ? { suggestion, pick } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <Screen banner="Suggestions use a simple likeness check: same market, then how close the confidence, trend and form are. It is not a trained model.">
      <Pressable onPress={() => router.back()}><T style={styles.back}>‹ More</T></Pressable>
      {board.tracked.length === 0 ? <Empty title="Track a pick first" body="Suggestions start from the picks you track or book." /> : null}
      {board.tracked.length > 0 && picks.length === 0 ? (
        <Empty title="No close match today" body="Nothing else on the board shares a market and a similar record with your tracked picks." />
      ) : null}
      {picks.map(({ suggestion, pick }) => (
        <ViewBlock key={pick.id} score={suggestion.score} because={suggestion.because}>
          <PickCard
            pick={pick}
            tracked={board.isTracked(pick.id)}
            drafted={board.draftIds.includes(pick.id)}
            green={board.green(pick)}
            onTrack={() => board.track(pick)}
            onSlip={() => board.toggleDraft(pick.id)}
          />
        </ViewBlock>
      ))}
    </Screen>
  );
}

function ViewBlock({ score, because, children }: { score: number; because: string; children: ReactNode }) {
  return (
    <>
      <T dim>
        {pct(score)} alike · {because}
      </T>
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.lime, fontWeight: '800', fontSize: 16 },
});
