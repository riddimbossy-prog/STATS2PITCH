import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { T } from '../components/ui';
import { colors } from '../src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Missing' }} />
      <View style={styles.container}>
        <T style={styles.title}>That screen is not in the app.</T>
        <Link href="/" style={styles.link}>
          <T style={styles.linkText}>Back to matches</T>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg, gap: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  link: { paddingVertical: 12 },
  linkText: { color: colors.lime, fontWeight: '800' },
});
