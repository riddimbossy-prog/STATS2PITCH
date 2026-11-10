import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';
import { Glass, T } from './ui';

export function ToastHost() {
  const { toasts, dismissToast } = useBoard();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {toasts.map((toast) => (
        <Animated.View key={toast.id} entering={FadeInDown.duration(320).springify()}>
          <Pressable onPress={() => dismissToast(toast.id)}>
            <Glass
              intensity={50}
              accent={toast.tone === 'var' ? 'rgba(245,196,81,0.7)' : toast.tone === 'bust' ? 'rgba(255,93,108,0.7)' : colors.lime}>
              <T style={styles.title}>{toast.title}</T>
              <T dim>{toast.body}</T>
            </Glass>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, top: 88, gap: 8, zIndex: 30 },
  title: { fontWeight: '900', fontSize: 16 },
});
