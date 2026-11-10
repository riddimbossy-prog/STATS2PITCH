import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../src/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function reveal(index = 0) {
  return FadeInDown.delay(Math.min(index, 14) * 42).duration(420).springify().damping(18);
}

export function PressableBody({
  pressed,
  children,
  style,
}: {
  pressed: boolean;
  children: ReactNode;
  style?: object;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(pressed ? 0.96 : 1, { damping: 16, stiffness: 280 });
  }, [pressed, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

export function LivePulse() {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
    scale.value = withRepeat(withTiming(1.8, { duration: 700 }), -1, true);
  }, [opacity, scale]);
  const ring = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const dot = useAnimatedStyle(() => ({ opacity: 0.85 + (1 - opacity.value) * 0.15 }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, ring]} />
      <Animated.View style={[styles.pulseDot, dot]} />
    </View>
  );
}

export function AnimatedScore({ value, style }: { value: string; style?: TextStyle }) {
  const scale = useSharedValue(1);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current !== value && value !== '' && value !== '–') {
      scale.value = 1.28;
      scale.value = withSpring(1, { damping: 9, stiffness: 220 });
    }
    previous.current = value;
  }, [scale, value]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.Text style={[style, anim]}>{value}</Animated.Text>;
}

export function GoalBurst({ label }: { label: string }) {
  return (
    <Animated.View entering={ZoomIn.duration(280).springify()} exiting={FadeOut.duration(180)} style={styles.burst} pointerEvents="none">
      <Text style={styles.burstText}>{label}</Text>
    </Animated.View>
  );
}

export function VarShimmer() {
  const travel = useSharedValue(-140);
  useEffect(() => {
    travel.value = withRepeat(withTiming(220, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [travel]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: travel.value }, { rotate: '18deg' }] }));
  return (
    <View style={styles.shimmer}>
      <Animated.View style={[styles.shimmerBand, band]} />
      <Text style={styles.shimmerLabel}>VAR</Text>
    </View>
  );
}

export function ConfidenceRing({ value }: { value: number }) {
  const size = 48;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 720, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(244,247,245,0.14)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.lime}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 720, easing: Easing.out(Easing.cubic) });
  }, [value, width]);
  const bar = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, bar]} />
    </View>
  );
}

export function Settle({ status, children }: { status: string; children: ReactNode }) {
  const shift = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (status === 'lost') {
      shift.value = withSequence(
        withTiming(-7, { duration: 55 }),
        withTiming(7, { duration: 55 }),
        withTiming(-4, { duration: 45 }),
        withTiming(0, { duration: 45 }),
      );
    }
    if (status === 'won') {
      glow.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 520 }));
    }
  }, [glow, shift, status]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: 1 + glow.value * 0.015 }],
  }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

export function GradeReveal({ grade, period }: { grade: string; period: string }) {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = 0.55;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 11, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 260 });
  }, [grade, opacity, period, scale]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.Text style={[styles.grade, anim]}>{grade}</Animated.Text>;
}

export function RefreshMark({ active }: { active: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = active ? withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false) : withTiming(0, { duration: 200 });
  }, [active, spin]);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  if (!active) return null;
  return (
    <Animated.Image
      entering={FadeIn.duration(180)}
      source={require('../assets/brand/s2p-pitch-mark.png')}
      style={[styles.refresh, anim]}
    />
  );
}

const styles = StyleSheet.create({
  pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 8, height: 8, borderRadius: 8, backgroundColor: colors.live },
  pulseDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: colors.live },
  burst: {
    position: 'absolute',
    right: 16,
    top: 36,
    backgroundColor: 'rgba(124,222,0,0.18)',
    borderColor: colors.lime,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  burstText: { color: colors.lime, fontWeight: '900', letterSpacing: 1.2 },
  shimmer: {
    height: 28,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,196,81,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,196,81,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerBand: {
    position: 'absolute',
    width: 48,
    top: -8,
    bottom: -8,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shimmerLabel: { color: colors.warn, fontWeight: '900', letterSpacing: 1.4 },
  track: { height: 6, borderRadius: 99, backgroundColor: 'rgba(244,247,245,0.1)', overflow: 'hidden' },
  bar: { height: 6, borderRadius: 99, backgroundColor: colors.lime },
  grade: { fontSize: 56, fontWeight: '900', color: colors.lime, lineHeight: 60 },
  refresh: { width: 28, height: 28, alignSelf: 'center' },
});
