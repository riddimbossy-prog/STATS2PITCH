import { Pressable, StyleSheet, View } from 'react-native';
import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';
import { T } from './ui';

export function ToastHost() {
  const { toasts, dismissToast } = useBoard();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {toasts.map((toast) => (
        <Pressable key={toast.id} onPress={() => dismissToast(toast.id)} style={[styles.toast, toast.tone === 'var' && styles.var, toast.tone === 'bust' && styles.bust]}>
          <T style={styles.title}>{toast.title}</T>
          <T dim>{toast.body}</T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, top: 100, gap: 8, zIndex: 20 },
  toast: { backgroundColor: colors.elev, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.lime, gap: 2 },
  var: { borderColor: colors.warn },
  bust: { borderColor: colors.danger },
  title: { fontWeight: '900' },
});
