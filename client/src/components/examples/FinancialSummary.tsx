import { FinancialSummary } from '../FinancialSummary';
import { GameProvider } from '@/lib/gameState';

export default function FinancialSummaryExample() {
  return (
    <GameProvider>
      <FinancialSummary />
    </GameProvider>
  );
}
