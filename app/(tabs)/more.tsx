import { useRouter } from 'expo-router';
import { Pressable, Share, StyleSheet } from 'react-native';
import { SourceStatus } from '../../components/SourceStatus';
import { Button, Card, Screen, Section, T } from '../../components/ui';
import { useBoard } from '../../src/state/board';

export default function MoreScreen() {
  const board = useBoard();
  const router = useRouter();
  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing}>
      <Card>
        <T style={styles.title}>Matches</T>
        <SourceStatus />
        <T dim>Storage: {board.storage === 'sqlite' ? 'SQLite on this device' : board.storage === 'document' ? 'On-device document' : 'Opening…'}</T>
        {board.fetchedAt ? <T dim>Updated {new Date(board.fetchedAt).toLocaleTimeString()}</T> : null}
      </Card>
      <Section title="Your book" />
      <LinkCard title="Suggestions" body={`${board.suggestions.length} picks look like ones you already tracked`} onPress={() => router.push('/suggestions')} />
      <LinkCard title="Blacklist and greenlist" body={`${board.lists.length} teams, leagues, competitions and markets`} onPress={() => router.push('/lists')} />
      <Section title="How a tip qualifies" />
      <Card>
        <T>A trend is the last 10 matches. Form is the last 5, and it can tip early as a head start.</T>
        <T dim>Both need 80% from at least five matches. Confidence then moves with the opponent: a team's over 2.5 counts for more when the other side's matches also clear 2.5.</T>
        <T dim>A new goal shows as VAR for about 45 seconds. It counts only if the score sticks. A score that falls back is not awarded.</T>
      </Card>
      {board.dev ? (
        <Card>
          <T style={styles.title}>Diagnostics</T>
          <T dim>{board.diagnosticCopy || 'No request yet.'}</T>
          <Button label="Copy" tone="ghost" onPress={() => void Share.share({ message: board.diagnosticCopy || 'No request yet.' })} />
        </Card>
      ) : null}
    </Screen>
  );
}

function LinkCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card>
        <T style={styles.title}>{title}</T>
        <T dim>{body}</T>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '900' },
});
