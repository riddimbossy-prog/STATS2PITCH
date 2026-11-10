import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/theme';

export function BrandHeader() {
  return (
    <View style={styles.wrap}>
      <Image source={require('../assets/brand/stadium-user-bg-v3.webp')} style={styles.bg} contentFit="cover" />
      <View style={styles.scrim} />
      <View style={styles.row}>
        <Image source={require('../assets/brand/s2p-pitch-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="Stats2Pitch pitch mark" />
        <View style={styles.copy}>
          <Image source={require('../assets/brand/stats2pitch-logo-v2.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Stats2Pitch" />
          <Text style={styles.tag}>Live scores · 80% tips</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 92, justifyContent: 'flex-end', backgroundColor: colors.bg, overflow: 'hidden' },
  bg: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.45 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7,13,10,0.55)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  mark: { width: 42, height: 42 },
  copy: { flex: 1, gap: 0 },
  logo: { width: 188, height: 42, marginLeft: -6 },
  tag: { color: colors.lime, fontSize: 12, fontWeight: '700', marginTop: -2 },
});
