import { FilmDevelopment } from '../FilmDevelopment';
import { GameProvider } from '@/lib/gameState';
import { Toaster } from '@/components/ui/toaster';

export default function FilmDevelopmentExample() {
  return (
    <GameProvider>
      <FilmDevelopment />
      <Toaster />
    </GameProvider>
  );
}
