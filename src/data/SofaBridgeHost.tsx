import { useEffect, useRef, type ComponentType, type Ref } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import WebViewImport from 'react-native-webview';
import { SofaBridge, SOFA_MOBILE_UA, SOFA_PAGE, buildPageFetchScript, buildProbeScript, isChallengeBody } from './bridge';
import { registerSofaBridge } from './sofascore';

type BridgeView = {
  injectJavaScript: (script: string) => void;
  reload: () => void;
};

type BridgeViewProps = {
  ref?: Ref<BridgeView>;
  source: { uri: string };
  userAgent?: string;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  thirdPartyCookiesEnabled?: boolean;
  sharedCookiesEnabled?: boolean;
  cacheEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  originWhitelist?: string[];
  onLoadEnd?: () => void;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onError?: () => void;
};

// The published WebView props collapse to `never` under this TypeScript version.
const SofaView = WebViewImport as unknown as ComponentType<BridgeViewProps>;

/**
 * Hidden page that has loaded sofascore.com. Native reads go through that
 * page so the challenge cookies apply. The web build does not mount this.
 */
export function SofaBridgeHost() {
  const viewRef = useRef<BridgeView>(null);
  const bridgeRef = useRef<SofaBridge | null>(null);
  const reloaded = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const bridge = new SofaBridge(
      {
        send(request) {
          viewRef.current?.injectJavaScript(buildPageFetchScript(request));
        },
        reload() {
          viewRef.current?.reload();
        },
      },
      20_000,
    );
    bridgeRef.current = bridge;
    registerSofaBridge(async (path) => {
      const result = await bridge.enqueue(path);
      try {
        return JSON.parse(result.body) as unknown;
      } catch {
        throw new Error('Sofascore bridge returned a non-JSON body');
      }
    });
    return () => {
      registerSofaBridge(null);
      bridgeRef.current = null;
    };
  }, []);

  if (Platform.OS === 'web') return null;

  function onMessage(event: { nativeEvent: { data: string } }) {
    let message: { type?: string; id?: string; status?: number; body?: string; error?: string };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (message.type === 'probe') {
      const status = message.status ?? 0;
      const body = message.body ?? '';
      if (message.error) {
        bridge.markOffline(message.error);
        return;
      }
      if (status >= 200 && status < 300) {
        reloaded.current = false;
        bridge.markReady();
        return;
      }
      if (status === 403 && isChallengeBody(body) && !reloaded.current) {
        reloaded.current = true;
        bridge.noteChallenge();
        viewRef.current?.reload();
      }
      return;
    }
    if (message.type === 'result' && message.id) {
      bridge.receive({
        id: message.id,
        status: message.status ?? 0,
        body: message.body ?? '',
        error: message.error,
      });
    }
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <SofaView
        ref={viewRef}
        source={{ uri: SOFA_PAGE }}
        userAgent={SOFA_MOBILE_UA}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        onLoadEnd={() => {
          viewRef.current?.injectJavaScript(buildProbeScript());
        }}
        onMessage={onMessage}
        onError={() => {
          bridgeRef.current?.markOffline('Sofascore page failed to load');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 1, height: 1, left: -20, top: 0, opacity: 0, overflow: 'hidden' },
});
