import { useRouter } from 'expo-router';
import { SourceStatus } from '../../components/SourceStatus';
import { Card, Screen, Section, T } from '../../components/ui';
import { colors } from '../../src/theme';
import { useBoard } from '../../src/state/board';
import { Pressable, StyleSheet } from 'react-native';

export default function MoreScreen() {
  const board = useBoard();
  const router = useRouter();
  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing}>
      <Card>
        <T style={styles.title}>Source</T>
        <SourceStatus />
        <T dim>Sofascore is the only data source. On Android the read goes through a hidden Sofascore page.</T>
        <T dim>Storage: {board.storage === 'sqlite' ? 'SQLite on this device' : board.storage === 'document' ? 'On-device document' : 'Opening…'}</T>
        {board.fetchedAt ? <T dim>Last read {new Date(board.fetchedAt).toLocaleTimeString()}</T> : null}
        {board.error ? <T style={{ color: colors.warn }}>{board.error}</T> : null}
      </Card>
      <Section title="Your book" />
      <LinkCard title="Suggestions" body={`${board.suggestions.length} picks look like ones you already tracked`} onPress={() => router.push('/suggestions')} />
      <LinkCard title="Blacklist and greenlist" body={`${board.lists.length} teams, leagues, competitions and markets`} onPress={() => router.push('/lists')} />
      <Section title="How a tip qualifies" />
      <Card>
        <T>A trend is the last 10 matches. Form is the last 5, and it can tip early as a head start.</T>
        <T dim>Both need 80% from at least five matches. Confidence then moves with the opponent: a team's over 2.5 counts for more when the other side's matches also clear 2.5.</T>
        <T dim>VAR shows as VAR first. The goal, the score and the notification wait until the check is confirmed.</T>
      </Card>
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
