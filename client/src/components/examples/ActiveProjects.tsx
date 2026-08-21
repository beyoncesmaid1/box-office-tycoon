import { ActiveProjects } from '../ActiveProjects';
import { GameProvider } from '@/lib/gameState';

export default function ActiveProjectsExample() {
  return (
    <GameProvider>
      <ActiveProjects />
    </GameProvider>
  );
}
