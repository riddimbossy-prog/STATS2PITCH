import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/theme';
import { BlurLayer } from './atmosphere';

export function BrandHeader() {
  return (
    <View style={styles.wrap}>
      <BlurLayer intensity={48} style={styles.fill} />
      <View pointerEvents="none" style={styles.wash} />
      <View style={styles.row}>
        <View style={styles.markGlow}>
          <Image
            source={require('../assets/brand/s2p-pitch-mark.png')}
            style={styles.mark}
            contentFit="contain"
            accessibilityLabel="Stats2Pitch"
          />
        </View>
        <View>
          <Text style={styles.title}>Stats2Pitch</Text>
          <Text style={styles.tag}>Live scores · 80% tips</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 74, justifyContent: 'flex-end', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(244,247,245,0.12)' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  wash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7,13,10,0.5)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  markGlow: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  mark: { width: 42, height: 42 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  tag: { color: colors.lime, fontSize: 12, fontWeight: '700' },
});
