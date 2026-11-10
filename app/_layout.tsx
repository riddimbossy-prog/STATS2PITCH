import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Atmosphere } from '../components/atmosphere';
import { ToastHost } from '../components/ToastHost';
import { BoardProvider } from '../src/state/board';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <BoardProvider>
        <Atmosphere>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              contentStyle: { backgroundColor: '#000' },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="match/[id]" />
            <Stack.Screen name="lists" />
            <Stack.Screen name="suggestions" />
          </Stack>
          <ToastHost />
        </Atmosphere>
      </BoardProvider>
    </SafeAreaProvider>
  );
}
