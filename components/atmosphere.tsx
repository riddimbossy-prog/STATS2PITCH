import { BlurTargetView, BlurView } from 'expo-blur';
import { Image } from 'expo-image';
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
  // Android dimezis BlurView was closing the app when switching tabs.
  // Keep a dark glass wash on Android; use BlurView only on iOS.
  if (Platform.OS !== 'ios') {
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
        {Platform.OS === 'ios' ? (
          <BlurTargetView ref={target} style={styles.fill} collapsable={false} pointerEvents="none">
            <Image source={require('../assets/brand/stadium-user-bg-v3.webp')} style={styles.fill} contentFit="cover" />
            <View style={styles.blackout} />
          </BlurTargetView>
        ) : (
          <View style={styles.fill} pointerEvents="none">
            <Image source={require('../assets/brand/stadium-user-bg-v3.webp')} style={styles.fill} contentFit="cover" />
            <View style={styles.blackout} />
          </View>
        )}
        {children}
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  blackout: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.9)' },
});
