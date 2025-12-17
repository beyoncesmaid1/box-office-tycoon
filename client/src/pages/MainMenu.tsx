import { useEffect, useState } from 'react';
import { Clapperboard, Play, Plus, Trash2, Loader2, Settings2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatMoney, formatWeekDate } from '@/lib/gameState';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { LoadingScreen } from '@/components/LoadingScreen';
import type { Studio } from '@shared/schema';

interface MainMenuProps {
  onSelectStudio: (studioId: string) => void;
  onOpenEditor?: () => void;
  onOpenMultiplayer?: () => void;
}

export function MainMenu({ onSelectStudio, onOpenEditor, onOpenMultiplayer }: MainMenuProps) {
  const { toast } = useToast();
  const [saves, setSaves] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGame, setShowNewGame] = useState(false);
  const [newStudioName, setNewStudioName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadMessage, setPreloadMessage] = useState('');

  useEffect(() => {
    fetchSaves();
  }, []);

  const fetchSaves = async () => {
    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch(`/api/saves?deviceId=${encodeURIComponent(deviceId)}`);
      const data = await response.json();
      setSaves(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load saves',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewGame = async () => {
    if (!newStudioName.trim()) return;

    setIsCreating(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch('/api/studio/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStudioName.trim(), deviceId }),
      });

      if (!response.ok) throw new Error('Failed to create studio');
      const studio = await response.json();

      setShowNewGame(false);
      setNewStudioName('');

      // Start preloading
      setIsPreloading(true);
      setPreloadProgress(0);
      setPreloadMessage('Simulating box office...');

      // Simulate progress increment while preload is running
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += Math.random() * 15;
        if (currentProgress > 85) currentProgress = 85;
        setPreloadProgress(currentProgress);
      }, 300);

      try {
        const preloadResponse = await fetch(`/api/studio/${studio.id}/preload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weeks: 24 }),
        });

        if (!preloadResponse.ok) throw new Error('Preload failed');

        // Set to 100% and complete
        clearInterval(progressInterval);
        setPreloadProgress(100);
        
        await new Promise(resolve => setTimeout(resolve, 300));

        toast({
          title: 'Studio Created!',
          description: `${newStudioName} is ready to launch.`,
        });

        onSelectStudio(studio.id);
      } catch (error) {
        console.error('Preload error:', error);
        clearInterval(progressInterval);
        // Continue anyway
        onSelectStudio(studio.id);
      } finally {
        setIsPreloading(false);
        setPreloadProgress(0);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create studio',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSave = async (studioId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/studio/${studioId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setSaves(saves.filter(s => s.id !== studioId));
      setDeleteConfirmId(null);
      toast({
        title: 'Save Deleted',
        description: 'The save has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete save',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isPreloading) {
    return <LoadingScreen progress={preloadProgress} message={preloadMessage} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center">
              <Clapperboard className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-4xl">Film Studio Simulator</h1>
          </div>
          <p className="text-muted-foreground text-lg">Build your empire, one film at a time</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={() => setShowNewGame(true)}
              size="lg"
              className="w-full"
              data-testid="button-new-game"
            >
              <Plus className="w-5 h-5 mr-2" />
              Start New Game
            </Button>

            {onOpenMultiplayer && (
              <Button
                onClick={onOpenMultiplayer}
                size="lg"
                variant="secondary"
                className="w-full"
                data-testid="button-multiplayer"
              >
                <Users className="w-5 h-5 mr-2" />
                Multiplayer
              </Button>
            )}

            {onOpenEditor && (
              <Button
                onClick={onOpenEditor}
                size="lg"
                variant="outline"
                className="w-full"
                data-testid="button-editor"
              >
                <Settings2 className="w-5 h-5 mr-2" />
                Talent Editor
              </Button>
            )}

            {saves.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-xl">Your Studios</h2>
                <div className="grid gap-3">
                  {saves.map((save) => (
                    <Card
                      key={save.id}
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => onSelectStudio(save.id)}
                      data-testid={`card-save-${save.id}`}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-display text-lg" data-testid={`text-studio-name-${save.id}`}>
                              {save.name}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                              <span>Current: {formatWeekDate(save.currentWeek, save.currentYear)}</span>
                              <span>Budget: {formatMoney(save.budget)}</span>
                              <span>Prestige: {save.prestigeLevel}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(save.id);
                              }}
                              data-testid={`button-delete-save-${save.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudio(save.id);
                              }}
                              data-testid={`button-load-save-${save.id}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNewGame} onOpenChange={setShowNewGame}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Studio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studio-name">Studio Name</Label>
              <Input
                id="studio-name"
                placeholder="Enter your studio name..."
                value={newStudioName}
                onChange={(e) => setNewStudioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewGame();
                }}
                data-testid="input-studio-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewGame(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNewGame}
              disabled={!newStudioName.trim() || isCreating}
              data-testid="button-create-studio"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Studio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Save?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this save? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteSave(deleteConfirmId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MainMenu;
