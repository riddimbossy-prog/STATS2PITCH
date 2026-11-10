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
    return <T dim>Sample board. Not live SportyBet.</T>;
  }
  if (Platform.OS === 'web') {
    return (
      <T dim>
        Web preview calls SportyBet directly. A network outside Ghana is often blocked, so a failed read offers the sample board.
        {board.error ? ` Last error: ${board.error}` : ''}
      </T>
    );
  }

  const blocked = /403|blocked|challenge/i.test(`${board.error ?? ''} ${bridge.lastError ?? ''}`) || bridge.status === 'challenge';
  const label = board.phase === 'ready' && !board.error
    ? 'Live from SportyBet'
    : blocked
      ? 'Blocked'
      : board.phase === 'loading' || bridge.status === 'starting'
        ? 'Opening SportyBet…'
        : 'Offline';
  const detail = bridge.lastError || board.error;
  return (
    <T dim style={label === 'Blocked' || label === 'Offline' ? { color: colors.warn } : undefined}>
      {label}
      {detail && label !== 'Live from SportyBet' ? ` · ${detail}` : ''}
    </T>
  );
}
