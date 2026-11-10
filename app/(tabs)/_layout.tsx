import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GlassTabBackground } from '../../components/ui';
import { colors } from '../../src/theme';

function Icon({ glyph, color, focused }: { glyph: string; color: string | undefined; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 14, stiffness: 220 });
  }, [focused, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Text style={{ color: color ?? colors.muted, fontSize: 16, fontWeight: '800' }}>{glyph}</Text>
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.muted,
        tabBarBackground: () => <GlassTabBackground />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(244,247,245,0.14)',
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: 'transparent' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Matches', tabBarIcon: ({ color, focused }) => <Icon glyph="●" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="picks" options={{ title: 'Picks', tabBarIcon: ({ color, focused }) => <Icon glyph="▲" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="slips" options={{ title: 'Slips', tabBarIcon: ({ color, focused }) => <Icon glyph="▣" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades', tabBarIcon: ({ color, focused }) => <Icon glyph="A" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <Icon glyph="••" color={String(color)} focused={focused} /> }} />
    </Tabs>
  );
}
