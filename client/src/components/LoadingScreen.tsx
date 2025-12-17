import { Loader2, Clapperboard } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LoadingScreenProps {
  progress: number;
  message: string;
}

export function LoadingScreen({ progress, message }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center">
              <Clapperboard className="w-8 h-8 text-primary-foreground animate-pulse" />
            </div>
            <h1 className="font-display text-3xl">Loading Game</h1>
          </div>
          <p className="text-muted-foreground">Preloading box office data...</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" data-testid="progress-load" />
            <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Simulating 24 weeks ahead to generate unique box office data...
          </p>
        </div>
      </div>
    </div>
  );
}
