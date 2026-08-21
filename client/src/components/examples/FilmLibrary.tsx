import { FilmLibrary } from '../FilmLibrary';
import { GameProvider } from '@/lib/gameState';

export default function FilmLibraryExample() {
  return (
    <GameProvider>
      <FilmLibrary />
    </GameProvider>
  );
}
