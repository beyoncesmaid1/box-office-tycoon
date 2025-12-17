import { BoxOfficeLeaderboard } from '../BoxOfficeLeaderboard';
import { GameProvider } from '@/lib/gameState';

export default function BoxOfficeLeaderboardExample() {
  return (
    <GameProvider>
      <BoxOfficeLeaderboard />
    </GameProvider>
  );
}
