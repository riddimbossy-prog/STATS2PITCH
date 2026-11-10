import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { BrandHeader } from './BrandHeader';

export function T({ style, dim, ...props }: TextProps & { dim?: boolean }) {
  return <Text {...props} style={[{ color: dim ? colors.muted : colors.text }, style]} />;
}

export function Screen({
  children,
  onRefresh,
  refreshing,
  banner,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  banner?: string | null;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.lime} /> : undefined
        }>
        {banner ? <Banner>{banner}</Banner> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Banner({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' }) {
  return (
    <View style={[styles.banner, tone === 'danger' && styles.bannerDanger]}>
      <T style={styles.bannerText}>{children}</T>
    </View>
  );
}

export function Section({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.section}>
      <T style={styles.sectionTitle}>{title}</T>
      {action ? <T style={styles.sectionAction}>{action}</T> : null}
    </View>
  );
}

export function Card({ children, accent }: { children: ReactNode; accent?: string }) {
  return <View style={[styles.card, accent ? { borderColor: accent } : null]}>{children}</View>;
}

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'lime' | 'warn' | 'danger' | 'live' }) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'lime' && styles.pillLime,
        tone === 'warn' && styles.pillWarn,
        tone === 'danger' && styles.pillDanger,
        tone === 'live' && styles.pillLive,
      ]}>
      <T style={[styles.pillText, tone === 'lime' && styles.pillTextInk, tone === 'warn' && styles.pillTextInk]}>{label}</T>
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'lime',
  disabled,
}: {
  label: string;
  onPress?: PressableProps['onPress'];
  tone?: 'lime' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'ghost' && styles.buttonGhost,
        tone === 'danger' && styles.buttonDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <T style={[styles.buttonText, tone !== 'lime' && styles.buttonTextLight]}>{label}</T>
    </Pressable>
  );
}

export function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segmentItem, active && styles.segmentOn]}>
            <T style={[styles.segmentText, active && styles.segmentTextOn]}>{option.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.field, props.style]} />;
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.lime} />
      <T dim>{label}</T>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <T style={styles.emptyTitle}>{title}</T>
      <T dim style={styles.emptyBody}>{body}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  banner: { backgroundColor: 'rgba(245,196,81,0.14)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(245,196,81,0.4)' },
  bannerDanger: { backgroundColor: 'rgba(255,93,108,0.12)', borderColor: 'rgba(255,93,108,0.45)' },
  bannerText: { color: colors.warn, lineHeight: 20 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  sectionAction: { color: colors.lime, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line, gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(244,247,245,0.08)' },
  pillLime: { backgroundColor: colors.lime },
  pillWarn: { backgroundColor: colors.warn },
  pillDanger: { backgroundColor: 'rgba(255,93,108,0.18)' },
  pillLive: { backgroundColor: 'rgba(255,77,90,0.16)' },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: colors.text },
  pillTextInk: { color: colors.ink },
  button: { backgroundColor: colors.lime, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonDanger: { backgroundColor: 'rgba(255,93,108,0.16)', borderWidth: 1, borderColor: 'rgba(255,93,108,0.4)' },
  buttonText: { color: colors.ink, fontWeight: '800' },
  buttonTextLight: { color: colors.text },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  segment: { flexDirection: 'row', backgroundColor: colors.elev, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.lime },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  segmentTextOn: { color: colors.ink },
  field: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elev,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyBody: { lineHeight: 20 },
});
