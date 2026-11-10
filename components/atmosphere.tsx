import { BlurTargetView, BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../src/theme';

export type BlurTargetRef = RefObject<ComponentRef<typeof View> | null>;

const BlurTargetContext = createContext<BlurTargetRef | null>(null);

export function useBlurTarget() {
  return useContext(BlurTargetContext);
}

export function BlurLayer({ intensity = 40, style }: { intensity?: number; style?: ViewStyle }) {
  const target = useBlurTarget();
  if (Platform.OS === 'web') {
    return <View pointerEvents="none" style={[style, webGlass(intensity)]} />;
  }
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      blurMethod="dimezisBlurView"
      blurTarget={target ?? undefined}
      style={style}
    />
  );
}

function webGlass(intensity: number): ViewStyle {
  const blur = Math.round(6 + intensity / 4);
  return {
    backgroundColor: 'rgba(8, 16, 12, 0.34)',
    backdropFilter: `blur(${blur}px)`,
    // RN web forwards this vendor prefix.
    WebkitBackdropFilter: `blur(${blur}px)`,
  } as ViewStyle;
}

/** Stadium and gradient sit in one blur target so every glass panel can frost the same background. */
export function Atmosphere({ children }: { children: ReactNode }) {
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <BlurTargetContext.Provider value={target}>
      <View style={styles.root}>
        <BlurTargetView ref={target} style={styles.fill} collapsable={false} pointerEvents="none">
          <Image source={require('../assets/brand/stadium-user-bg-v3.webp')} style={styles.fill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(7,13,10,0.28)', 'rgba(7,13,10,0.55)', 'rgba(7,13,10,0.82)']}
            locations={[0, 0.4, 1]}
            style={styles.fill}
          />
          <LinearGradient
            colors={['rgba(124,222,0,0.16)', 'rgba(21,148,71,0.02)', 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0.45 }}
            style={styles.glow}
          />
        </BlurTargetView>
        {children}
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
});
