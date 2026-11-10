import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/theme';

function Icon({ glyph, color }: { glyph: string; color: string | undefined }) {
  return <Text style={{ color: color ?? colors.muted, fontSize: 16, fontWeight: '800' }}>{glyph}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: '#0b120f',
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Matches', tabBarIcon: ({ color }) => <Icon glyph="●" color={String(color)} /> }} />
      <Tabs.Screen name="picks" options={{ title: 'Picks', tabBarIcon: ({ color }) => <Icon glyph="▲" color={String(color)} /> }} />
      <Tabs.Screen name="slips" options={{ title: 'Slips', tabBarIcon: ({ color }) => <Icon glyph="▣" color={String(color)} /> }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades', tabBarIcon: ({ color }) => <Icon glyph="A" color={String(color)} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Icon glyph="••" color={String(color)} /> }} />
    </Tabs>
  );
}
