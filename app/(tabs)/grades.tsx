import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Empty, Pill, Screen, Section, Segment, T } from '../../components/ui';
import type { GradePeriod } from '../../src/domain';
import { gradePeriod, type GradeRow } from '../../src/engine';
import { pct } from '../../src/format';
import { useBoard } from '../../src/state/board';
import { colors } from '../../src/theme';

export default function GradesScreen() {
  const board = useBoard();
  const [period, setPeriod] = useState<GradePeriod>('week');
  const report = useMemo(
    () =>
      gradePeriod(
        board.tracked
          .filter((pick) => pick.status === 'won' || pick.status === 'lost' || pick.status === 'void')
          .map((pick) => ({
            id: pick.id,
            label: `${pick.teamName} · ${pick.label}`,
            market: pick.market,
            teamId: pick.teamId,
            teamName: pick.teamName,
            competitionId: pick.competitionId,
            competitionName: pick.competitionName,
            status: pick.status as 'won' | 'lost' | 'void',
            settledAt: pick.settledAt ?? pick.createdAt,
          })),
        period,
        Date.now(),
      ),
    [board.tracked, period],
  );

  return (
    <Screen
      onRefresh={board.refresh}
      refreshing={board.refreshing}
      banner={board.sample ? 'Grades include the sample book so the week, month and year views have a record to show.' : null}>
      <Segment
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
      />
      <Card>
        <T dim>Your tips this {period}</T>
        <View style={styles.overall}>
          <T style={styles.letter}>{report.overall.grade}</T>
          <View style={{ flex: 1 }}>
            <T style={styles.record}>
              {report.overall.wins} landed · {report.overall.losses} bust
            </T>
            <T dim>{report.overall.sample ? pct(report.overall.rate) : 'No settled tips in this period yet'}</T>
          </View>
        </View>
      </Card>
      {report.overall.sample === 0 ? (
        <Empty title="Nothing settled in this period" body="Track a pick or book a slip. Grades use your book, counted from Monday UTC for the week." />
      ) : null}
      <GradeBlock title="Lucky tips" rows={report.landed.map((row) => ({ key: row.id, name: row.label, detail: 'Landed', grade: 'A+' as const, lucky: true }))} />
      <GradeBlock title="Markets" rows={report.markets.map(present)} />
      <GradeBlock title="Teams" rows={report.teams.map(present)} />
      <GradeBlock title="Competitions" rows={report.competitions.map(present)} />
    </Screen>
  );
}

function present(row: GradeRow) {
  return {
    key: row.key,
    name: row.name,
    detail: `${row.wins}-${row.losses}${row.sample ? ` · ${pct(row.rate)}` : ''}`,
    grade: row.grade,
    lucky: row.lucky,
  };
}

function GradeBlock({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; name: string; detail: string; grade: string; lucky: boolean }[];
}) {
  if (!rows.length) return null;
  return (
    <>
      <Section title={title} />
      {rows.map((row) => (
        <Card key={row.key}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T style={styles.name}>{row.name}</T>
              <T dim>{row.detail}</T>
            </View>
            <T style={styles.grade}>{row.grade}</T>
            {row.lucky ? <Pill label="Lucky" tone="lime" /> : null}
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  overall: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  letter: { fontSize: 56, fontWeight: '900', color: colors.lime, lineHeight: 60 },
  record: { fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '800' },
  grade: { fontSize: 22, fontWeight: '900', color: colors.lime },
});
