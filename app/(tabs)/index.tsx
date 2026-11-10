import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { MatchCard } from '../../components/MatchCard';
import { SourceStatus } from '../../components/SourceStatus';
import { Banner, Button, Empty, Loading, Screen, Segment, T } from '../../components/ui';
import { useBoard } from '../../src/state/board';

export default function MatchesScreen() {
  const board = useBoard();
  const router = useRouter();
  const [filter, setFilter] = useState<'live' | 'today'>('today');
  const rows = board.matches.filter((match) => (filter === 'live' ? match.status === 'live' : true));
  const blocked = !board.sample && (board.phase === 'error' || (board.phase === 'ready' && board.matches.length === 0));
  const banner = board.sample
    ? 'Sample board. These fixtures are not from SportyBet. Live data is still the only real source.'
    : blocked
      ? null
      : board.error;

  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing} banner={banner}>
      <SourceStatus />
      {board.diagnostic && !blocked ? <T dim>{board.diagnostic}</T> : null}
      <Segment
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'live', label: 'Live' },
        ]}
      />
      {board.phase === 'loading' ? <Loading label="Asking SportyBet for today's matches" /> : null}
      {blocked ? (
        <View style={{ gap: 10 }}>
          <Banner>{board.diagnostic || board.error || 'SportyBet returned no matches.'}</Banner>
          <Button label="Retry" onPress={board.refresh} />
          <Button
            label="Copy diagnostics"
            tone="ghost"
            onPress={() => {
              void Share.share({ message: board.diagnosticCopy || board.diagnostic || board.error || 'No SportyBet diagnostics yet.' });
            }}
          />
          <Button label="Preview the sample board" tone="ghost" onPress={board.openSample} />
        </View>
      ) : null}
      {board.phase === 'ready' && rows.length === 0 && board.matches.length > 0 ? (
        <Empty title="No live matches" body="Today's card is still on the Today chip." />
      ) : null}
      {rows.map((match, index) => (
        <MatchCard key={match.id} index={index} match={match} detail={board.details[match.id]} onPress={() => router.push(`/match/${match.id}`)} />
      ))}
      {board.phase === 'ready' && rows.length > 0 ? (
        <T dim>{rows.length} shown{board.sample ? ' · sample' : ''}</T>
      ) : null}
    </Screen>
  );
}
