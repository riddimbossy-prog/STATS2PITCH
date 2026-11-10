import { useBoard } from '../src/state/board';
import { colors } from '../src/theme';
import { T } from './ui';

export function SourceStatus() {
  const board = useBoard();
  if (board.sample) return <T dim>Sample board</T>;
  if (board.phase === 'error' || board.error) return <T style={{ color: colors.warn }}>Can't load matches</T>;
  if (board.phase === 'loading') return <T dim>Loading matches</T>;
  if (board.phase === 'ready') return <T dim>Live</T>;
  return <T dim>Offline</T>;
}
