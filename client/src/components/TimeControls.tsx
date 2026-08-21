import { Play, FastForward, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/lib/gameState';
import { DateWithWeek } from './DateWithWeek';

export function TimeControls() {
  const { state, advanceWeek, isAdvancing } = useGame();

  const handleAdvanceWeeks = async (weeks: number) => {
    for (let i = 0; i < weeks; i++) {
      await advanceWeek();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 mr-4 px-3 py-1.5 rounded-md bg-muted">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div data-testid="text-current-date">
          <DateWithWeek week={state.currentWeek} year={state.currentYear} size="sm" />
        </div>
      </div>
      
      <Button 
        size="sm" 
        onClick={() => advanceWeek()}
        disabled={isAdvancing}
        data-testid="button-advance-week"
      >
        {isAdvancing ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Play className="w-4 h-4 mr-1" />
        )}
        Next Week
      </Button>
      
      <Button 
        size="sm" 
        variant="secondary"
        onClick={() => handleAdvanceWeeks(4)}
        disabled={isAdvancing}
        data-testid="button-advance-month"
      >
        <FastForward className="w-4 h-4 mr-1" />
        +4 Weeks
      </Button>
    </div>
  );
}
