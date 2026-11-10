import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getBridgeSnapshot, subscribeBridge, type BridgeSnapshot } from '../src/data/bridge';
import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';
import { T } from './ui';

export function SourceStatus() {
  const board = useBoard();
  const [bridge, setBridge] = useState<BridgeSnapshot>(getBridgeSnapshot());
  useEffect(() => subscribeBridge(setBridge), []);

  if (board.sample) {
    return <T dim>Sample board. Not live Sofascore.</T>;
  }
  if (Platform.OS === 'web') {
    return (
      <T dim>
        Web preview uses direct fetch. A browser cannot pass Sofascore's challenge, so a failed read offers the sample board.
        {board.error ? ` Last error: ${board.error}` : ''}
      </T>
    );
  }

  const label =
    bridge.status === 'live'
      ? 'Live from Sofascore'
      : bridge.status === 'challenge'
        ? 'Blocked 403 challenge'
        : bridge.status === 'starting'
          ? 'Opening Sofascore…'
          : 'Offline';
  const detail = bridge.lastError || board.error;
  return (
    <T dim style={bridge.status === 'challenge' || bridge.status === 'offline' ? { color: colors.warn } : undefined}>
      {label}
      {detail ? ` · ${detail}` : ''}
    </T>
  );
}
