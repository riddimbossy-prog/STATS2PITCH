import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MatchCard } from '../../components/MatchCard';
import { SourceStatus } from '../../components/SourceStatus';
import { Button, Card, Empty, Loading, Screen, Segment, T } from '../../components/ui';
import { groupMatchesByLeague } from '../../src/engine';
import { useBoard } from '../../src/state/board';

export default function MatchesScreen() {
  const board = useBoard();
  const router = useRouter();
  const [filter, setFilter] = useState<'live' | 'today'>('today');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = board.matches.filter((match) => (filter === 'live' ? match.status === 'live' : true));
  const groups = useMemo(() => groupMatchesByLeague(rows), [rows]);
  const open = groups.find((group) => group.id === openId) ?? null;
  const banner = board.sample ? 'Sample board. These fixtures are saved on this phone.' : null;

  useEffect(() => {
    setOpenId(null);
  }, [filter]);

  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing} banner={banner}>
      <SourceStatus />
      <Segment
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'live', label: 'Live' },
        ]}
      />
      {board.phase === 'loading' ? <Loading label="Loading matches" /> : null}
      {board.phase === 'error' && !board.sample ? (
        <View style={{ gap: 10 }}>
          <Empty title="Couldn't load matches" body="Check the connection and try again." />
          <Button label="Retry" onPress={board.refresh} />
          <Button label="Preview the sample board" tone="ghost" onPress={board.openSample} />
        </View>
      ) : null}
      {board.phase === 'ready' && rows.length === 0 ? (
        <Empty title={filter === 'live' ? 'No live matches' : 'No matches right now'} body="Pull to refresh." />
      ) : null}
      {board.phase === 'ready' && rows.length > 0 && !open ? (
        <>
          {groups.map((group, index) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={`${group.title}, ${group.matches.length} games`}
              onPress={() => setOpenId(group.id)}>
              <Card index={index}>
                <View style={styles.row}>
                  <T style={styles.league}>{group.title}</T>
                  <T style={styles.count}>{group.matches.length}</T>
                </View>
              </Card>
            </Pressable>
          ))}
          <T dim>{groups.length} leagues · {rows.length} games</T>
        </>
      ) : null}
      {open ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => setOpenId(null)} style={styles.back}>
            <T style={styles.backText}>All leagues</T>
            <T dim>{open.title}</T>
          </Pressable>
          {open.matches.map((match, index) => (
            <MatchCard key={match.id} index={index} match={match} detail={board.details[match.id]} onPress={() => router.push(`/match/${match.id}`)} />
          ))}
          <T dim>{open.matches.length} shown{board.sample ? ' · sample' : ''}</T>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  league: { flex: 1, fontSize: 16, fontWeight: '800' },
  count: { fontSize: 18, fontWeight: '900' },
  back: { gap: 2, paddingVertical: 4 },
  backText: { fontWeight: '800' },
});
