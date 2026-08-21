import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/lib/gameState';

export function QuitMenuButton() {
  const { onQuitGame } = useGame();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onQuitGame}
      data-testid="button-quit-menu"
      className="gap-2"
    >
      <LogOut className="w-4 h-4" />
      Main Menu
    </Button>
  );
}
