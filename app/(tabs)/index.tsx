import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { MatchCard } from '../../components/MatchCard';
import { Button, Empty, Loading, Screen, Segment, T } from '../../components/ui';
import { useBoard } from '../../src/state/board';

export default function MatchesScreen() {
  const board = useBoard();
  const router = useRouter();
  const [filter, setFilter] = useState<'live' | 'today'>('today');
  const rows = board.matches.filter((match) => (filter === 'live' ? match.status === 'live' : true));
  const banner = board.sample
    ? 'Sample board. These fixtures are not from Sofascore. Live data is still the only real source.'
    : board.error;

  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing} banner={banner}>
      <Segment
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'live', label: 'Live' },
        ]}
      />
      {board.phase === 'loading' ? <Loading label="Asking Sofascore for today's matches" /> : null}
      {board.phase === 'error' && !board.sample ? (
        <View style={{ gap: 10 }}>
          <Empty
            title="Sofascore did not respond"
            body="Lists, slips and grades already on this phone are still here. The feed is unofficial and sometimes refuses a network."
          />
          <Button label="Try Sofascore again" onPress={board.refresh} />
          <Button label="Preview the sample board" tone="ghost" onPress={board.openSample} />
        </View>
      ) : null}
      {board.phase === 'ready' && rows.length === 0 ? (
        <Empty title={filter === 'live' ? 'No live matches' : 'No matches today'} body="Pull to refresh. Kickoffs show up as Sofascore publishes them." />
      ) : null}
      {rows.map((match, index) => (
        <MatchCard key={match.id} index={index} match={match} detail={board.details[match.id]} onPress={() => router.push(`/match/${match.id}`)} />
      ))}
      {board.phase === 'ready' ? (
        <T dim>{rows.length} shown{board.sample ? ' · sample' : ''}</T>
      ) : null}
    </Screen>
  );
}
