import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PickCard } from '../../components/PickCard';
import { AnimatedScore, VarShimmer } from '../../components/motion';
import { Button, Card, Empty, Pill, Screen, Section, T } from '../../components/ui';
import { assessSquad, confirmedBoard, strengthLabel } from '../../src/engine';
import { assessVar } from '../../src/engine/var';
import { useBoard } from '../../src/state/board';
import { colors } from '../../src/theme';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const board = useBoard();
  const match = board.matches.find((item) => item.id === id);
  const detail = id ? board.details[id] : undefined;

  useEffect(() => {
    if (id) void board.loadMatch(id);
  }, [id]);

  if (!match) {
    return (
      <Screen>
        <Empty title="Match not on the board" body="Go back to today and pull to refresh." />
        <Button label="Back" tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const boardState = confirmedBoard(match, detail);
  const events = detail ? assessVar(detail.incidents, detail.feedScore).incidents : [];
  const picks = board.visiblePicks.filter((pick) => pick.matchId === match.id);
  const homeSquad = assessSquad(board.lineupHistory[match.home.id] ?? [], detail?.lineups.home?.starters.map((player) => player.name) ?? null);
  const awaySquad = assessSquad(board.lineupHistory[match.away.id] ?? [], detail?.lineups.away?.starters.map((player) => player.name) ?? null);

  return (
    <Screen banner={boardState.varPending ? 'VAR. The goal is on the screen as a check and is not on the score until it is confirmed.' : null}>
      <Pressable onPress={() => router.back()}><T style={styles.back}>‹ Matches</T></Pressable>
      <T dim>
        {match.league.name} · {match.competition.name}
      </T>
      <Card>
        <Score name={match.home.name} score={match.status === 'scheduled' ? '–' : String(boardState.score.home)} />
        <Score name={match.away.name} score={match.status === 'scheduled' ? '–' : String(boardState.score.away)} />
        <View style={styles.pills}>
          {match.status === 'live' ? <Pill label={match.minute || match.statusText || 'LIVE'} tone="live" /> : <Pill label={match.statusText} />}
          {boardState.varPending ? <Pill label="VAR" tone="warn" /> : null}
        </View>
        {boardState.varPending ? <VarShimmer /> : null}
        {board.sample && boardState.varPending ? (
          <Button label="Sample: confirm the VAR goal" onPress={() => board.confirmSampleVar(match.id)} />
        ) : null}
      </Card>
      <Section title="Squad" />
      <T dim>Squad strength stays unknown until a lineup is published for this match.</T>
      <SquadCard name={match.home.name} report={homeSquad} />
      <SquadCard name={match.away.name} report={awaySquad} />
      <Section title="Events" />
      {events.length === 0 ? <Empty title="No events yet" body="A new score is held as VAR until it sticks." /> : null}
      {events.map((event) => (
        <Card key={event.id}>
          <View style={styles.event}>
            <T style={styles.minute}>{event.minute ?? '–'}'</T>
            <View style={{ flex: 1 }}>
              <T style={event.kind === 'var' ? styles.var : undefined}>{event.label}</T>
              <T dim>{event.isHome == null ? '' : event.isHome ? match.home.shortName : match.away.shortName}</T>
            </View>
            {event.kind === 'var' ? <Pill label="VAR" tone="warn" /> : null}
          </View>
        </Card>
      ))}
      {detail?.lineups.home ? <LineupBlock name={match.home.name} players={detail.lineups.home.starters.map((player) => player.name)} missing={homeSquad.missing} /> : null}
      {detail?.lineups.away ? <LineupBlock name={match.away.name} players={detail.lineups.away.starters.map((player) => player.name)} missing={awaySquad.missing} /> : null}
      <Section title="Tips in this match" action={String(picks.length)} />
      {picks.length === 0 ? <Empty title="No 80% tip in this match" body="The trend and the last-five form both sit under 80%." /> : null}
      {picks.map((pick, index) => (
          <PickCard
          key={pick.id}
          index={index}
          pick={pick}
          tracked={board.isTracked(pick.id)}
          drafted={board.draftIds.includes(pick.id)}
          green={board.green(pick)}
          onTrack={() => board.track(pick)}
          onSlip={() => board.toggleDraft(pick.id)}
        />
      ))}
    </Screen>
  );
}

function Score({ name, score }: { name: string; score: string }) {
  return (
    <View style={styles.scoreRow}>
      <T style={styles.team}>{name}</T>
      <AnimatedScore value={score} style={styles.score} />
    </View>
  );
}

function SquadCard({ name, report }: { name: string; report: ReturnType<typeof assessSquad> }) {
  const tone = report.strength === 'full' ? 'lime' : report.strength === 'half' ? 'danger' : report.strength === 'mixed' ? 'warn' : 'muted';
  return (
    <Card>
      <View style={styles.scoreRow}>
        <T style={styles.team}>{name}</T>
        <Pill label={strengthLabel(report)} tone={tone === 'muted' ? 'muted' : tone} />
      </View>
      {report.rotationFlag ? <Pill label={`Rotation · ${report.missing.length} usual starters out`} tone="warn" /> : null}
      {report.missing.length ? <T dim>Out: {report.missing.join(', ')}</T> : null}
      {report.ratio != null ? <T dim>{Math.round(report.ratio * 100)}% of the usual XI is starting</T> : <T dim>Need today's lineup and three recent XIs to compare.</T>}
    </Card>
  );
}

function LineupBlock({ name, players, missing }: { name: string; players: string[]; missing: string[] }) {
  const missingKeys = new Set(missing.map((item) => item.toLowerCase()));
  return (
    <>
      <Section title={`${name} XI`} />
      <Card>
        {players.map((player) => (
          <T key={player} dim={missingKeys.has(player.toLowerCase())}>{player}</T>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.lime, fontWeight: '800', fontSize: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  team: { fontSize: 20, fontWeight: '900', flex: 1 },
  score: { fontSize: 32, fontWeight: '900', color: colors.lime, fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  event: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  minute: { width: 36, fontWeight: '800', color: colors.muted },
  var: { color: colors.warn, fontWeight: '900' },
});
