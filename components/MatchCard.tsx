import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Match, MatchDetail } from '../src/domain';
import { confirmedBoard } from '../src/engine';
import { kickoffLabel } from '../src/format';
import { colors } from '../src/theme';
import { AnimatedScore, GoalBurst, LivePulse, PressableBody, VarShimmer, reveal } from './motion';
import { Glass, Pill, T } from './ui';

export function MatchCard({
  match,
  detail,
  onPress,
  index = 0,
}: {
  match: Match;
  detail?: MatchDetail;
  onPress: () => void;
  index?: number;
}) {
  const board = confirmedBoard(match, detail);
  const showScore = match.status === 'live' || match.status === 'finished';
  const total = board.score.home + board.score.away;
  const previous = useRef<number | null>(null);
  const wasVar = useRef(board.varPending);
  const [burst, setBurst] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (previous.current != null && total > previous.current) {
      setBurst(wasVar.current && !board.varPending ? 'CONFIRMED' : 'GOAL');
      const timer = setTimeout(() => setBurst(null), 1300);
      previous.current = total;
      wasVar.current = board.varPending;
      return () => clearTimeout(timer);
    }
    previous.current = total;
    wasVar.current = board.varPending;
    return undefined;
  }, [board.varPending, total]);

  return (
    <Animated.View entering={reveal(index)}>
      <Pressable onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
        <PressableBody pressed={pressed}>
          <Glass accent={board.varPending ? 'rgba(245,196,81,0.55)' : match.status === 'live' ? 'rgba(255,77,90,0.35)' : undefined}>
            <View style={styles.top}>
              <T dim style={styles.league} numberOfLines={1}>
                {match.league.name} · {match.competition.name}
              </T>
              {match.status === 'live' ? <LivePulse /> : null}
              {match.status === 'live' ? <Pill label={match.minute || 'LIVE'} tone="live" /> : null}
              {board.varPending ? <Pill label="VAR" tone="warn" /> : null}
              {match.status === 'finished' ? <Pill label="FT" /> : null}
            </View>
            <TeamLine name={match.home.name} score={showScore ? String(board.score.home) : ''} />
            <TeamLine name={match.away.name} score={showScore ? String(board.score.away) : ''} />
            {board.varPending ? <VarShimmer /> : null}
            {match.status === 'scheduled' ? <T dim>{kickoffLabel(match.kickoff)}</T> : null}
            {match.status === 'postponed' || match.status === 'cancelled' ? <T style={styles.warn}>{match.statusText}</T> : null}
            {burst ? <GoalBurst label={burst} /> : null}
          </Glass>
        </PressableBody>
      </Pressable>
    </Animated.View>
  );
}

function TeamLine({ name, score }: { name: string; score: string }) {
  return (
    <View style={styles.team}>
      <T style={styles.teamName} numberOfLines={1}>{name}</T>
      {score ? <AnimatedScore value={score} style={styles.score} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  league: { flex: 1, fontSize: 12, fontWeight: '700' },
  team: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  teamName: { fontSize: 17, fontWeight: '800', flex: 1 },
  score: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'], color: colors.lime },
  warn: { color: colors.warn, fontWeight: '700' },
});
