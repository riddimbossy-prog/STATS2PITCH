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

  const detail = board.diagnostic || bridge.lastError || board.error;
  const blocked = /HTTP 403|blocked|challenge|bizCode/i.test(`${detail ?? ''}`) || bridge.status === 'challenge';
  const label = board.phase === 'ready' && board.matches.length > 0 && !blocked
    ? 'Live from SportyBet'
    : blocked
      ? 'Blocked'
      : board.phase === 'loading' || bridge.status === 'starting'
        ? 'Opening SportyBet…'
        : 'Offline';
  return (
    <T dim style={label === 'Blocked' || label === 'Offline' ? { color: colors.warn } : undefined}>
      {label}
      {detail ? ` · ${detail}` : ''}
    </T>
  );
}
