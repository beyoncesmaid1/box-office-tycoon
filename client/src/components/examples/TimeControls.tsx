import { TimeControls } from '../TimeControls';
import { GameProvider } from '@/lib/gameState';

export default function TimeControlsExample() {
  return (
    <GameProvider>
      <TimeControls />
    </GameProvider>
  );
}
