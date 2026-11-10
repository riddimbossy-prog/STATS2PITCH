import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Settle } from '../../components/motion';
import { Button, Card, Empty, Field, Pill, Screen, Section, T } from '../../components/ui';
import { BOOKIES } from '../../src/bookies/stub';
import { combinedOdds } from '../../src/engine';
import { oddsText } from '../../src/format';
import { useBoard } from '../../src/state/board';
import { colors } from '../../src/theme';

export default function SlipsScreen() {
  const board = useBoard();
  const [message, setMessage] = useState<string | null>(null);
  const drafted = board.visiblePicks.filter((pick) => board.draftIds.includes(pick.id));
  const price = combinedOdds(drafted.map((pick) => pick.odds));
  const stake = Number(board.stake);
  const banner = board.sample ? 'Sample slips settle on this board. Bookie codes are still a local stub.' : null;

  return (
    <Screen onRefresh={board.refresh} refreshing={board.refreshing} banner={banner}>
      <Section title="New slip" />
      <Card>
        <T dim>Pick a bookie. The code is generated on the phone. No bookie is connected yet.</T>
        <View style={styles.bookies}>
          {BOOKIES.map((bookie) => (
            <View key={bookie.id} style={styles.bookie}>
              <Button label={bookie.name} tone={board.bookieId === bookie.id ? 'lime' : 'ghost'} onPress={() => board.setBookieId(bookie.id)} />
            </View>
          ))}
        </View>
        <Field value={board.stake} onChangeText={board.setStake} keyboardType="decimal-pad" placeholder="Stake" />
        {drafted.length === 0 ? <T dim>Add picks from the Picks tab. {board.draftIds.length ? '' : 'The slip is empty.'}</T> : null}
        {drafted.map((pick) => (
          <View key={pick.id} style={styles.leg}>
            <T style={styles.legLabel}>{pick.label}</T>
            <T dim>{oddsText(pick.odds)}</T>
          </View>
        ))}
        <T>Combined odds {oddsText(price)}{Number.isFinite(stake) && price ? ` · return ${(stake * price).toFixed(2)}` : ''}</T>
        {message ? <T style={styles.error}>{message}</T> : null}
        <Button
          label="Book code"
          onPress={() => {
            void board.bookDraft().then((error) => setMessage(error));
          }}
        />
      </Card>
      <Section title="Booked" action={String(board.slips.length)} />
      {board.slips.length === 0 ? <Empty title="No booking codes yet" body="A code stays open until every leg lands, or it busts as soon as one leg loses." /> : null}
      {board.slips.map((slip, index) => (
        <Settle key={slip.id} status={slip.status}>
        <Card index={index}>
          <View style={styles.leg}>
            <T style={styles.code}>{slip.code}</T>
            <Pill label={slip.status} tone={slip.status === 'won' ? 'lime' : slip.status === 'lost' ? 'danger' : 'muted'} />
          </View>
          <T dim>
            {slip.bookieName} · stub · stake {slip.stake ?? '—'}
          </T>
          {slip.stubMessage ? <T dim>{slip.stubMessage}</T> : null}
          {slip.legs.map((leg) => (
            <View key={leg.id} style={styles.leg}>
              <T>{leg.label}</T>
              <Pill label={leg.status} tone={leg.status === 'won' ? 'lime' : leg.status === 'lost' ? 'danger' : 'muted'} />
            </View>
          ))}
        </Card>
        </Settle>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bookies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookie: { flexGrow: 1, minWidth: '46%' },
  leg: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  legLabel: { flex: 1, fontWeight: '700' },
  code: { fontSize: 18, fontWeight: '900', color: colors.lime, flex: 1 },
  error: { color: colors.danger, fontWeight: '700' },
});
