import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Empty, Field, Pill, Screen, Section, Segment, T } from '../components/ui';
import type { ListKind, ListScope } from '../src/domain';
import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';

const SCOPES: { value: ListScope; label: string }[] = [
  { value: 'team', label: 'Team' },
  { value: 'league', label: 'League' },
  { value: 'competition', label: 'Competition' },
  { value: 'market', label: 'Market' },
];

export default function ListsScreen() {
  const board = useBoard();
  const router = useRouter();
  const [kind, setKind] = useState<ListKind>('black');
  const [scope, setScope] = useState<ListScope>('team');
  const [name, setName] = useState('');
  const rows = board.lists.filter((entry) => entry.kind === kind);

  return (
    <Screen banner="Three busts in a row, or a 70% bust rate, land on the blacklist. Three lands, or an 80% hit rate, land on the greenlist. A manual choice stays put.">
      <Pressable onPress={() => router.back()}><T style={styles.back}>‹ More</T></Pressable>
      <Segment
        value={kind}
        onChange={setKind}
        options={[
          { value: 'black', label: 'Blacklist' },
          { value: 'green', label: 'Greenlist' },
        ]}
      />
      <Section title={kind === 'black' ? 'Hidden from the tips' : 'Marked and sorted first'} action={String(rows.length)} />
      {rows.length === 0 ? <Empty title={kind === 'black' ? 'Blacklist is empty' : 'Greenlist is empty'} body="Add a name below, or let settled picks accumulate on their own." /> : null}
      {rows.map((entry) => (
        <Card key={entry.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T style={styles.name}>{entry.name}</T>
              <T dim>
                {entry.scope} · {entry.source}
                {entry.reason ? ` · ${entry.reason}` : ''}
              </T>
            </View>
            <Pill label={entry.source} tone={entry.source === 'auto' ? 'lime' : 'muted'} />
          </View>
          <Button label="Remove" tone="ghost" onPress={() => board.removeList(entry.id)} />
        </Card>
      ))}
      <Section title="Add by hand" />
      <Card>
        <Segment value={scope} onChange={setScope} options={SCOPES} />
        <Field value={name} onChangeText={setName} placeholder={scope === 'market' ? 'over_2_5' : 'Name'} />
        <Button
          label={`Add to ${kind}list`}
          onPress={() => {
            board.addList({ kind, scope, name });
            setName('');
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.lime, fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 16 },
});
