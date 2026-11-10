import { Pressable, StyleSheet, View } from 'react-native';
import type { Match, MatchDetail } from '../src/domain';
import { confirmedBoard } from '../src/engine';
import { kickoffLabel } from '../src/format';
import { colors } from '../src/theme';
import { Pill, T } from './ui';

export function MatchCard({ match, detail, onPress }: { match: Match; detail?: MatchDetail; onPress: () => void }) {
  const board = confirmedBoard(match, detail);
  const showScore = match.status === 'live' || match.status === 'finished';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <T dim style={styles.league} numberOfLines={1}>
          {match.league.name} · {match.competition.name}
        </T>
        {match.status === 'live' ? <Pill label={match.minute || 'LIVE'} tone="live" /> : null}
        {board.varPending ? <Pill label="VAR" tone="warn" /> : null}
        {match.status === 'finished' ? <Pill label="FT" /> : null}
      </View>
      <TeamLine name={match.home.name} score={showScore ? String(board.score.home) : ''} />
      <TeamLine name={match.away.name} score={showScore ? String(board.score.away) : ''} />
      {match.status === 'scheduled' ? <T dim>{kickoffLabel(match.kickoff)}</T> : null}
      {match.status === 'postponed' || match.status === 'cancelled' ? <T style={styles.warn}>{match.statusText}</T> : null}
    </Pressable>
  );
}

function TeamLine({ name, score }: { name: string; score: string }) {
  return (
    <View style={styles.team}>
      <T style={styles.teamName} numberOfLines={1}>{name}</T>
      {score ? <T style={styles.score}>{score}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line, gap: 6 },
  pressed: { opacity: 0.75 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  league: { flex: 1, fontSize: 12, fontWeight: '700' },
  team: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  teamName: { fontSize: 17, fontWeight: '800', flex: 1 },
  score: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], color: colors.lime },
  warn: { color: colors.warn, fontWeight: '700' },
});
