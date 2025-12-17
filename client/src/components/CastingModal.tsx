import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Star, 
  Check, 
  X, 
  Loader2, 
  UserCircle, 
  DollarSign,
  Percent,
  Film,
  AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import { useToast } from '@/hooks/use-toast';
import type { Talent, Film as FilmType, FilmRole } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface CastingModalProps {
  film: FilmType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AcceptanceFactors {
  studioPrestige: number;
  directorFame: number;
  roleImportance: number;
  salary: number;
  genreMatch: number;
}

export function CastingModal({ film, open, onOpenChange }: CastingModalProps) {
  const { state, talent } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRole, setSelectedRole] = useState<FilmRole | null>(null);
  const [selectedActor, setSelectedActor] = useState<Talent | null>(null);
  const [offeredSalary, setOfferedSalary] = useState(1000000);
  const [acceptanceProbability, setAcceptanceProbability] = useState<number | null>(null);
  const [acceptanceFactors, setAcceptanceFactors] = useState<AcceptanceFactors | null>(null);
  const [isHiring, setIsHiring] = useState(false);
  const [hireResult, setHireResult] = useState<{ success: boolean; accepted: boolean; message: string } | null>(null);
  
  const { data: roles = [], isLoading: rolesLoading } = useQuery<FilmRole[]>({
    queryKey: ['/api/films', film.id, 'roles'],
    enabled: open && !!film.id,
  });

  const { data: availableActors = [], isLoading: actorsLoading } = useQuery<Talent[]>({
    queryKey: ['/api/casting/available-talent', state.currentWeek, state.currentYear, film.genre],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: 'actor',
        week: String(state.currentWeek),
        year: String(state.currentYear),
        genre: film.genre,
      });
      const res = await fetch(`/api/casting/available-talent?${params}`);
      return res.json();
    },
    enabled: open && !!selectedRole,
  });

  const uncastRoles = roles.filter(r => !r.isCast);

  useEffect(() => {
    if (selectedActor) {
      setOfferedSalary(selectedActor.askingPrice || 1000000);
    }
  }, [selectedActor]);

  useEffect(() => {
    if (selectedActor && selectedRole) {
      fetch('/api/casting/calculate-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talentId: selectedActor.id,
          filmId: film.id,
          roleImportance: selectedRole.importance,
          offeredSalary,
        }),
      })
        .then(res => res.json())
        .then(data => {
          setAcceptanceProbability(data.probability);
          setAcceptanceFactors(data.factors);
        })
        .catch(() => {
          setAcceptanceProbability(null);
          setAcceptanceFactors(null);
        });
    }
  }, [selectedActor, selectedRole, offeredSalary, film.id]);

  const handleHire = async () => {
    if (!selectedActor || !selectedRole) return;
    
    setIsHiring(true);
    setHireResult(null);
    
    try {
      const res = await fetch('/api/casting/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talentId: selectedActor.id,
          roleId: selectedRole.id,
          filmId: film.id,
          offeredSalary,
          currentWeek: state.currentWeek,
          currentYear: state.currentYear,
          productionDurationWeeks: film.productionDurationWeeks || 20,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setHireResult({
          success: true,
          accepted: data.accepted,
          message: data.message,
        });
        
        if (data.accepted) {
          toast({
            title: 'Cast Member Hired!',
            description: data.message,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/films', film.id, 'roles'] });
          queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
          queryClient.invalidateQueries({ queryKey: ['/api/casting/available-talent'] });
          setSelectedRole(null);
          setSelectedActor(null);
        } else {
          toast({
            title: 'Offer Declined',
            description: data.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Hiring Failed',
          description: data.message || 'Unable to hire this actor.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process hiring request.',
        variant: 'destructive',
      });
    } finally {
      setIsHiring(false);
    }
  };

  const resetSelection = () => {
    setSelectedActor(null);
    setAcceptanceProbability(null);
    setAcceptanceFactors(null);
    setHireResult(null);
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return 'text-green-500';
    if (prob >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Cast Roles for "{film.title}"
          </DialogTitle>
          <DialogDescription>
            Select a role and hire actors. Success depends on studio prestige, director fame, salary, and genre match.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          {/* Left Panel: Roles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Uncast Roles ({uncastRoles.length})</h3>
              {selectedRole && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setSelectedRole(null); resetSelection(); }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
            
            {rolesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : uncastRoles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>All roles have been cast!</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {uncastRoles.map((role) => (
                    <Card 
                      key={role.id}
                      className={`cursor-pointer transition-all ${
                        selectedRole?.id === role.id 
                          ? 'ring-2 ring-primary' 
                          : 'hover-elevate'
                      }`}
                      onClick={() => { setSelectedRole(role); resetSelection(); }}
                      data-testid={`role-card-${role.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <UserCircle className="w-8 h-8 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{role.roleName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge 
                                variant={role.importance === 'lead' ? 'default' : 'secondary'} 
                                className="capitalize"
                              >
                                {role.importance}
                              </Badge>
                              <span className="capitalize">{role.characterType.replace('_', ' ')}</span>
                              {role.characterAge && <span>Age: {role.characterAge}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Right Panel: Actors & Hiring */}
          <div className="space-y-4">
            {!selectedRole ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a role to view available actors</p>
                </CardContent>
              </Card>
            ) : selectedActor ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      {selectedActor.imageUrl && <AvatarImage src={selectedActor.imageUrl} />}
                      <AvatarFallback>{selectedActor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedActor.name}</CardTitle>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3 h-3 ${i < (selectedActor.starRating || 0) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="ml-auto" 
                      onClick={resetSelection}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Offered Salary (Asking: {formatMoney(selectedActor.askingPrice || 0)})
                    </label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[offeredSalary]}
                        onValueChange={([v]) => setOfferedSalary(v)}
                        min={Math.floor((selectedActor.askingPrice || 1000000) * 0.5)}
                        max={Math.ceil((selectedActor.askingPrice || 1000000) * 2)}
                        step={100000}
                        className="flex-1"
                      />
                      <span className="font-medium w-28 text-right">{formatMoney(offeredSalary)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>50%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  {acceptanceProbability !== null && acceptanceFactors && (
                    <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Percent className="w-4 h-4" />
                          Acceptance Probability
                        </span>
                        <span className={`font-display text-2xl ${getProbabilityColor(acceptanceProbability)}`}>
                          {acceptanceProbability}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Studio Prestige</span>
                          <span className={acceptanceFactors.studioPrestige > 0 ? 'text-green-500' : 'text-muted-foreground'}>
                            +{acceptanceFactors.studioPrestige}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Director Fame</span>
                          <span className={acceptanceFactors.directorFame > 0 ? 'text-green-500' : 'text-muted-foreground'}>
                            +{acceptanceFactors.directorFame}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role Importance</span>
                          <span className={acceptanceFactors.roleImportance > 0 ? 'text-green-500' : 'text-muted-foreground'}>
                            +{acceptanceFactors.roleImportance}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Salary Offer</span>
                          <span className={acceptanceFactors.salary > 0 ? 'text-green-500' : acceptanceFactors.salary < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                            {acceptanceFactors.salary >= 0 ? '+' : ''}{acceptanceFactors.salary}%
                          </span>
                        </div>
                        <div className="flex justify-between col-span-2">
                          <span className="text-muted-foreground">Genre Match</span>
                          <span className={acceptanceFactors.genreMatch > 0 ? 'text-green-500' : acceptanceFactors.genreMatch < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                            {acceptanceFactors.genreMatch >= 0 ? '+' : ''}{acceptanceFactors.genreMatch}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {hireResult && !hireResult.accepted && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5" />
                      <span>{hireResult.message}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={resetSelection}>
                      Back to Actors
                    </Button>
                    <Button 
                      onClick={handleHire} 
                      disabled={isHiring || offeredSalary > state.budget}
                      data-testid="button-hire-actor"
                    >
                      {isHiring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                      Make Offer
                    </Button>
                  </div>
                  
                  {offeredSalary > state.budget && (
                    <p className="text-xs text-destructive text-center">
                      Insufficient budget for this offer
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    Available Actors for "{selectedRole.roleName}"
                  </h3>
                  <Badge variant="outline">{availableActors.length} available</Badge>
                </div>
                
                {actorsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : availableActors.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No actors currently available</p>
                      <p className="text-sm">All actors may be busy with other productions</p>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-2">
                      {availableActors.slice(0, 50).map((actor) => {
                        const actorGenres = actor.genres as Record<string, number> || {};
                        const genreMatch = Object.keys(actorGenres).some(
                          g => g.toLowerCase() === film.genre.toLowerCase() && actorGenres[g] > 0
                        );
                        return (
                          <Card 
                            key={actor.id}
                            className="cursor-pointer hover-elevate"
                            onClick={() => setSelectedActor(actor)}
                            data-testid={`actor-card-${actor.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  {actor.imageUrl && <AvatarImage src={actor.imageUrl} />}
                                  <AvatarFallback>{actor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{actor.name}</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star 
                                          key={i} 
                                          className={`w-3 h-3 ${i < (actor.starRating || 0) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                                        />
                                      ))}
                                    </div>
                                    {genreMatch && (
                                      <Badge variant="secondary" className="text-xs">
                                        Genre Match
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-sm">{formatMoney(actor.askingPrice || 0)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Fame: {actor.fame || 50}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
