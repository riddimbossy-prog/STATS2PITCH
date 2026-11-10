import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/ToastHost';
import { BoardProvider } from '../src/state/board';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <BoardProvider>
        <View style={styles.root}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="match/[id]" />
            <Stack.Screen name="lists" />
            <Stack.Screen name="suggestions" />
          </Stack>
          <ToastHost />
        </View>
      </BoardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
