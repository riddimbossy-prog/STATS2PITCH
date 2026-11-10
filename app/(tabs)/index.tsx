import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { MatchCard } from '../../components/MatchCard';
import { SourceStatus } from '../../components/SourceStatus';
import { Button, Empty, Loading, Screen, Segment, T } from '../../components/ui';
import { useBoard } from '../../src/state/board';

export default function MatchesScreen() {
  const board = useBoard();
  const router = useRouter();
  const [filter, setFilter] = useState<'live' | 'today'>('today');
  const rows = board.matches.filter((match) => (filter === 'live' ? match.status === 'live' : true));
  const banner = board.sample ? 'Sample board. These fixtures are saved on this phone.' : null;

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
      {rows.map((match, index) => (
        <MatchCard key={match.id} index={index} match={match} detail={board.details[match.id]} onPress={() => router.push(`/match/${match.id}`)} />
      ))}
      {board.phase === 'ready' && rows.length > 0 ? <T dim>{rows.length} shown{board.sample ? ' · sample' : ''}</T> : null}
    </Screen>
  );
}
