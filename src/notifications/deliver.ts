import { Platform } from 'react-native';

let configured = false;

/** Local notification. Web keeps the in-app toast and skips the system tray. */
export async function deliverLocal(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    if (!configured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      configured = true;
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // A missing notification permission still leaves the in-app toast in place.
  }
}
