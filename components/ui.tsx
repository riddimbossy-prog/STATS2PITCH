import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
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
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { BlurLayer } from './atmosphere';
import { BrandHeader } from './BrandHeader';
import { PressableBody, RefreshMark, reveal } from './motion';

const fill: ViewStyle = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };

export function T({ style, dim, ...props }: TextProps & { dim?: boolean }) {
  return <Text {...props} style={[{ color: dim ? colors.muted : colors.text }, style]} />;
}

export function Glass({
  children,
  style,
  accent,
  intensity = 38,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  accent?: string;
  intensity?: number;
}) {
  return (
    <View style={[styles.glass, accent ? { borderColor: accent, shadowColor: accent } : null, style]}>
      <BlurLayer intensity={intensity} style={styles.glassClip} />
      <View pointerEvents="none" style={[fill, styles.wash, styles.glassClip]} />
      <View pointerEvents="none" style={styles.sheen} />
      {children}
    </View>
  );
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
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = focused ? withTiming(1, { duration: 320 }) : 0;
  }, [focused, progress]);
  const enter = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {Platform.OS === 'web' ? (
        <Image
          pointerEvents="none"
          source={require('../assets/brand/stadium-user-bg-v3.webp')}
          contentFit="cover"
          style={styles.stadiumHint}
        />
      ) : null}
      <BrandHeader />
      <RefreshMark active={!!refreshing} />
      <Animated.View style={[styles.flex, enter]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.lime} colors={[colors.lime]} progressBackgroundColor="#102018" />
            ) : undefined
          }>
          {banner ? <Banner>{banner}</Banner> : null}
          {children}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

export function Banner({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' }) {
  return (
    <Glass accent={tone === 'danger' ? 'rgba(255,93,108,0.55)' : 'rgba(245,196,81,0.45)'} intensity={28}>
      <T style={[styles.bannerText, tone === 'danger' && { color: colors.danger }]}>{children}</T>
    </Glass>
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

export function Card({ children, accent, index = 0 }: { children: ReactNode; accent?: string; index?: number }) {
  return (
    <Animated.View entering={reveal(index)}>
      <Glass accent={accent}>{children}</Glass>
    </Animated.View>
  );
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
      <T style={[styles.pillText, (tone === 'lime' || tone === 'warn') && styles.pillTextInk]}>{label}</T>
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
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={disabled ? styles.disabled : undefined}>
      <PressableBody pressed={pressed}>
        <View style={[styles.button, tone === 'lime' && styles.buttonLime, tone === 'ghost' && styles.buttonGhost, tone === 'danger' && styles.buttonDanger]}>
          <T style={[styles.buttonText, tone !== 'lime' && styles.buttonTextLight]}>{label}</T>
        </View>
      </PressableBody>
    </Pressable>
  );
}

export function Segment<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, active && styles.chipOn]}>
            <T style={[styles.segmentText, active && styles.segmentTextOn]}>{option.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
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

export function GlassTabBackground() {
  return <BlurLayer intensity={55} style={fill} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#000' : 'transparent' },
  flex: { flex: 1, backgroundColor: 'transparent' },
  stadiumHint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.1 },
  content: { padding: 16, gap: 12 },
  glass: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(12,12,12,0.72)',
    overflow: 'hidden',
    padding: 14,
    gap: 8,
    shadowColor: '#7CDE00',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  glassClip: { borderRadius: 22 },
  wash: { backgroundColor: 'rgba(0,0,0,0.28)' },
  sheen: { position: 'absolute', top: 0, left: 12, right: 12, height: 1, backgroundColor: 'rgba(255,255,255,0.34)' },
  bannerText: { color: colors.warn, lineHeight: 20 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  sectionAction: { color: colors.lime, fontWeight: '700', fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(244,247,245,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillLime: { backgroundColor: colors.lime, borderColor: colors.lime },
  pillWarn: { backgroundColor: colors.warn, borderColor: colors.warn },
  pillDanger: { backgroundColor: 'rgba(255,93,108,0.16)', borderColor: 'rgba(255,93,108,0.45)' },
  pillLive: { backgroundColor: 'rgba(255,77,90,0.16)', borderColor: 'rgba(255,77,90,0.5)' },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: colors.text },
  pillTextInk: { color: colors.ink },
  button: { borderRadius: 14, minHeight: 46, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonLime: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  buttonGhost: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(244,247,245,0.18)' },
  buttonDanger: { backgroundColor: 'rgba(255,93,108,0.14)', borderWidth: 1, borderColor: 'rgba(255,93,108,0.4)' },
  buttonText: { color: colors.ink, fontWeight: '800' },
  buttonTextLight: { color: colors.text },
  disabled: { opacity: 0.45 },
  chips: { gap: 8, paddingVertical: 2, alignItems: 'center' },
  chip: {
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,12,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  segmentTextOn: { color: colors.ink },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,247,245,0.16)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyBody: { lineHeight: 20 },
});
