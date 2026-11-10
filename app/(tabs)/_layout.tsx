import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassTabBackground } from '../../components/ui';
import { colors } from '../../src/theme';

const ICONS: Record<string, string> = {
  index: '●',
  picks: '▲',
  slips: '▣',
  grades: 'A',
  more: '••',
};

interface BarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  emitter: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
}

function Bar({ state, descriptors, emitter, navigateToTab }: BarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottom = Math.max(insets.bottom, 10);
  const count = Math.max(state.routes.length, 1);
  const tabWidth = width / count;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(state.index * tabWidth, { damping: 18, stiffness: 220 });
  }, [state.index, tabWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bar, { paddingBottom: bottom, minHeight: 56 + bottom }]}>
      <GlassTabBackground />
      <View pointerEvents="none" style={styles.wash} />
      <Animated.View pointerEvents="none" style={[styles.indicator, { width: Math.min(56, tabWidth - 16) }, indicator, { left: (tabWidth - Math.min(56, tabWidth - 16)) / 2 }]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = options?.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={styles.tab}>
              <Text style={[styles.icon, { color: focused ? colors.lime : colors.muted }]}>{ICONS[route.name] ?? '•'}</Text>
              <Text style={[styles.label, { color: focused ? colors.lime : colors.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      safeAreaInsets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      tabBar={(props) => <Bar {...(props as unknown as BarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Matches' }} />
      <Tabs.Screen name="picks" options={{ title: 'Picks' }} />
      <Tabs.Screen name="slips" options={{ title: 'Slips' }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  wash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  row: { flexDirection: 'row', minHeight: 56 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 8 },
  icon: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '800' },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
  },
});
