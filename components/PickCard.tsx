import { StyleSheet, View } from 'react-native';
import type { Pick } from '../src/engine';
import { oddsText, pct, signed } from '../src/format';
import { colors } from '../src/theme';
import { ConfidenceBar, ConfidenceRing } from './motion';
import { Button, Card, Pill, T } from './ui';

const BAND_SHORT = {
  elite: 'Elite',
  strong: 'Strong',
  solid: 'Solid',
  qualifying: '80%+',
  watch: 'Watch',
} as const;

export function PickCard({
  pick,
  tracked,
  drafted,
  green,
  onTrack,
  onSlip,
  index = 0,
}: {
  pick: Pick;
  tracked: boolean;
  drafted: boolean;
  green: boolean;
  onTrack: () => void;
  onSlip: () => void;
  index?: number;
}) {
  return (
    <Card accent={green ? colors.lime : undefined} index={index}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <T style={styles.label}>{pick.label}</T>
          <T dim>
            {pick.teamName} <T dim>vs</T> {pick.opponentName}
          </T>
        </View>
        <View style={styles.ring}>
          <ConfidenceRing value={pick.confidence} />
          <T style={styles.conf}>{pct(pick.confidence)}</T>
        </View>
      </View>
      <ConfidenceBar value={pick.confidence} />
      <View style={styles.pills}>
        <Pill label={BAND_SHORT[pick.band]} tone={pick.band === 'watch' ? 'warn' : 'lime'} />
        {pick.headStart ? <Pill label="Form head start" tone="warn" /> : <Pill label="Trend" />}
        {green ? <Pill label="Greenlist" tone="lime" /> : null}
        <Pill label={pick.odds == null ? 'No price' : `Odds ${oddsText(pick.odds)}`} />
      </View>
      <T dim>
        {pick.teamHits}/{pick.teamSample} {pick.kind} · opp {pick.oppSample ? `${Math.round(pick.oppRate * 100)}%` : 'n/a'} · swing {signed(pick.opponentContribution)}
      </T>
      <T dim>{pick.competitionName}</T>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label={tracked ? 'Tracked' : 'Track'} tone={tracked ? 'ghost' : 'lime'} onPress={onTrack} disabled={tracked} />
        </View>
        <View style={styles.action}>
          <Button label={drafted ? 'On slip' : 'Add to slip'} tone="ghost" onPress={onSlip} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  copy: { flex: 1, gap: 2 },
  label: { fontSize: 18, fontWeight: '900' },
  ring: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  conf: { position: 'absolute', fontSize: 11, fontWeight: '900', color: colors.lime },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
