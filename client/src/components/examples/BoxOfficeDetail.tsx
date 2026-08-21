import { BoxOfficeDetail } from '../BoxOfficeDetail';
import { GameProvider } from '@/lib/gameState';

export default function BoxOfficeDetailExample() {
  return (
    <GameProvider>
      <BoxOfficeDetail />
    </GameProvider>
  );
}
