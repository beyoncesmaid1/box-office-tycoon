import { AwardsSystem } from '../AwardsSystem';
import { GameProvider } from '@/lib/gameState';
import { Toaster } from '@/components/ui/toaster';

export default function AwardsSystemExample() {
  return (
    <GameProvider>
      <AwardsSystem />
      <Toaster />
    </GameProvider>
  );
}
