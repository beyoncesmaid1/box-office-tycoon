import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Users, DollarSign, Loader2, Calendar, Globe, UserPlus, Film, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGame, formatMoney, genreColors, genreLabels, type FilmWithTalent } from '@/lib/gameState';
import { useToast } from '@/hooks/use-toast';
import { ReleaseScheduler } from './ReleaseScheduler';
import { CastingModal } from './CastingModal';
import { DateWithWeek } from './DateWithWeek';
import { TalentCard } from './FilmDevelopment';
import type { FilmRelease, FilmRole, Talent } from '@shared/schema';

const phaseLabels: Record<string, string> = {
  development: 'Development',
  'awaiting-greenlight': 'Awaiting Greenlight',
  'pre-production': 'Pre-Production',
  production: 'Production',
  filmed: 'Filmed',
  'post-production': 'Post-Production',
  'production-complete': 'Ready to Release',
  'awaiting-release': 'Awaiting Release',
  released: 'Released',
};

const phaseColors: Record<string, string> = {
  development: 'bg-blue-500',
  'awaiting-greenlight': 'bg-indigo-500',
  'pre-production': 'bg-yellow-500',
  production: 'bg-green-500',
  filmed: 'bg-pink-500',
  'post-production': 'bg-purple-500',
  'production-complete': 'bg-orange-500',
  'awaiting-release': 'bg-cyan-500',
  released: 'bg-emerald-500',
};

interface ProjectCardProps {
  film: FilmWithTalent;
  currentWeek?: number;
  currentYear?: number;
}

function ProjectCard({ film, currentWeek = 1, currentYear = 2025 }: ProjectCardProps) {
  const [showTerritoryScheduler, setShowTerritoryScheduler] = useState(false);
  const [showCastingModal, setShowCastingModal] = useState(false);
  const [showHireTalentModal, setShowHireTalentModal] = useState(false);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [isCreatingSequel, setIsCreatingSequel] = useState(false);
  
  // Fetch territory releases for this film
  const { data: releases = [] } = useQuery<FilmRelease[]>({
    queryKey: ['/api/films', film.id, 'releases'],
    enabled: !!film.id,
  });
  
  // Fetch roles for this film to show casting status
  const { data: roles = [] } = useQuery<FilmRole[]>({
    queryKey: ['/api/films', film.id, 'roles'],
    enabled: !!film.id,
  });
  
  const uncastRoles = roles.filter(r => !r.isCast);
  const hasUncastRoles = uncastRoles.length > 0;
  const canCast = ['development', 'awaiting-greenlight'].includes(film.phase);
  const isDevelopmentComplete = (film.phase === 'awaiting-greenlight' || film.phase === 'pre-production') && !film.hasHiredTalent;
  const isProductionComplete = film.phase === 'filmed' && !film.hasEditedPostProduction;
  const isReleased = film.phase === 'released';
  
  const createSequel = async () => {
    setIsCreatingSequel(true);
    try {
      // Fetch original film's roles
      const rolesRes = await fetch(`/api/films/${film.id}/roles`);
      if (!rolesRes.ok) {
        console.error('Failed to fetch roles:', rolesRes.status);
      }
      const originalRoles = await rolesRes.json();
      const res = await fetch(`/api/films/${film.id}/create-sequel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${film.title} 2` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Store BOTH original film data AND roles in localStorage for FilmDevelopment
      localStorage.setItem('sequelOriginalFilm', JSON.stringify({
        id: film.id,
        title: film.title,
        genre: film.genre,
      }));
      localStorage.setItem('sequelOriginalRoles', JSON.stringify(originalRoles));
      
      // Navigate to film development in sequel mode
      window.location.href = '/develop-film?sequel=true';
    } catch (error) {
      console.error('Failed to create sequel:', error);
    } finally {
      setIsCreatingSequel(false);
    }
  };
  
  // Find earliest release date from all territories
  const earliestRelease = releases.length > 0 
    ? releases.reduce((earliest, current) => {
        const currentAbsoluteWeek = current.releaseYear * 52 + current.releaseWeek;
        const earliestAbsoluteWeek = earliest.releaseYear * 52 + earliest.releaseWeek;
        return currentAbsoluteWeek < earliestAbsoluteWeek ? current : earliest;
      })
    : null;
  
  // Films can be in production-complete (ready but no releases scheduled) 
  // or awaiting-release (has releases scheduled, waiting for release date)
  const isReadyToScheduleRelease = film.phase === 'production-complete';
  const isAwaitingRelease = film.phase === 'awaiting-release';
  const canScheduleTerritory = ['production-complete', 'awaiting-release'].includes(film.phase);
  const needsReleaseScheduling = isReadyToScheduleRelease && releases.length === 0;

  return (
    <Card className="hover-elevate" data-testid={`card-project-${film.id}`}>
      <CardHeader className="pb-3 gap-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate" data-testid={`text-project-title-${film.id}`}>
              {film.title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className={genreColors[film.genre as keyof typeof genreColors]}>
                {genreLabels[film.genre as keyof typeof genreLabels]}
              </Badge>
              <Badge variant="outline">{phaseLabels[film.phase]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isDevelopmentComplete && (
              <Button 
                size="sm" 
                className="bg-purple-500 hover:bg-purple-600 text-white"
                onClick={() => setShowHireTalentModal(true)}
                data-testid={`button-hire-talent-${film.id}`}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Hire Talent
              </Button>
            )}
            {isProductionComplete && (
              <Button 
                size="sm" 
                className="bg-purple-500 hover:bg-purple-600 text-white"
                onClick={() => setShowEditPostModal(true)}
                data-testid={`button-edit-film-${film.id}`}
              >
                <Film className="w-3 h-3 mr-1" />
                Edit Film
              </Button>
            )}
            {needsReleaseScheduling && (
              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300">
                Schedule Release
              </Badge>
            )}
            {canScheduleTerritory && (
              <Button 
                size="sm" 
                variant={needsReleaseScheduling ? "default" : "outline"}
                className={needsReleaseScheduling ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                onClick={() => setShowTerritoryScheduler(true)}
                data-testid={`button-territory-releases-dashboard-${film.id}`}
              >
                <Globe className="w-3 h-3 mr-1" />
                {needsReleaseScheduling ? "Schedule Territories" : "Territories"}
              </Button>
            )}
            {isReleased && (
              <Button 
                size="sm" 
                className="bg-blue-500 hover:bg-blue-600 text-white"
                onClick={createSequel}
                disabled={isCreatingSequel}
                data-testid={`button-create-sequel-${film.id}`}
              >
                <Zap className="w-3 h-3 mr-1" />
                {isCreatingSequel ? 'Creating...' : 'Create Sequel'}
              </Button>
            )}
            {isAwaitingRelease && earliestRelease && (
              <Badge variant="secondary" className="bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300">
                <Calendar className="w-3 h-3 mr-1" />
                Week {earliestRelease.releaseWeek}, {earliestRelease.releaseYear}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!['awaiting-greenlight', 'filmed', 'production-complete', 'awaiting-release'].includes(film.phase) && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Production Progress</span>
              <span className="font-medium">{(film as any).weeksInCurrentPhase || 0} / {
                film.phase === 'development' ? (film as any).developmentDurationWeeks :
                film.phase === 'pre-production' ? (film as any).preProductionDurationWeeks :
                film.phase === 'production' ? (film as any).productionDurationWeeks :
                film.phase === 'post-production' ? (film as any).postProductionDurationWeeks : 0
              } weeks</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-muted">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${phaseColors[film.phase]}`}
                style={{ width: `${Math.min(100, ((film.weeksInCurrentPhase || 0) / (
                  film.phase === 'development' ? film.developmentDurationWeeks :
                  film.phase === 'pre-production' ? film.preProductionDurationWeeks :
                  film.phase === 'production' ? film.productionDurationWeeks :
                  film.phase === 'post-production' ? film.postProductionDurationWeeks : 1
                )) * 100)}%` }}
              />
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Budget</p>
              <p className="font-medium">{formatMoney(film.totalBudget)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Cast</p>
              <p className="font-medium">{film.cast?.length || film.castIds?.length || 0} actors</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Release</p>
              {earliestRelease ? (
                <DateWithWeek week={earliestRelease.releaseWeek} year={earliestRelease.releaseYear} size="sm" />
              ) : (
                <p className="font-medium">TBD</p>
              )}
            </div>
          </div>
        </div>

        {film.director && (
          <div className="text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Director: </span>
            <span className="font-medium">{film.director.name}</span>
          </div>
        )}
      </CardContent>
      
      <ReleaseScheduler 
        film={film}
        open={showTerritoryScheduler}
        onOpenChange={setShowTerritoryScheduler}
      />
      
      <CastingModal
        film={film}
        open={showCastingModal}
        onOpenChange={setShowCastingModal}
      />
      
      {showHireTalentModal && (
        <HireTalentModal
          film={film}
          open={showHireTalentModal}
          onOpenChange={setShowHireTalentModal}
        />
      )}
      
      {showEditPostModal && (
        <EditPostProductionModal
          film={film}
          open={showEditPostModal}
          onOpenChange={setShowEditPostModal}
        />
      )}
    </Card>
  );
}

function HireTalentModal({ film, open, onOpenChange }: { film: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { talent, hireTalent } = useGame();
  const [step, setStep] = useState<'director' | 'cast' | 'budgets-review'>('director');
  const [selectedDirector, setSelectedDirector] = useState<Talent | null>(film.director || null);
  const [productionBudget, setProductionBudget] = useState(film.productionBudget || 50000000);
  const [setsBudget, setSetsBudget] = useState(film.setsBudget || 5000000);
  const [costumesBudget, setCostumesBudget] = useState(film.costumesBudget || 2000000);
  const [stuntsBudget, setStuntsBudget] = useState(film.stuntsBudget || 3000000);
  const [makeupBudget, setMakeupBudget] = useState(film.makeupBudget || 1000000);
  const [practicalEffectsBudget, setPracticalEffectsBudget] = useState(film.practicalEffectsBudget || 2000000);
  const [soundCrewBudget, setSoundCrewBudget] = useState(film.soundCrewBudget || 1500000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleCasts, setRoleCasts] = useState<Record<string, string>>({});
  const [selectedActor, setSelectedActor] = useState<Talent | null>(null);
  const [selectedRole, setSelectedRole] = useState<FilmRole | null>(null);
  const [directorSort, setDirectorSort] = useState<'fame' | 'performance' | 'genre'>('fame');
  const [actorSort, setActorSort] = useState<'fame' | 'performance' | 'genre'>('fame');
  const { toast } = useToast();

  const { data: roles = [] } = useQuery<FilmRole[]>({
    queryKey: ['/api/films', film.id, 'roles'],
    enabled: !!film.id,
  });

  const getGenreScore = (talent: Talent): number => {
    const genreMap: Record<string, keyof Talent> = {
      'action': 'skillAction',
      'drama': 'skillDrama',
      'comedy': 'skillComedy',
      'thriller': 'skillThriller',
      'horror': 'skillHorror',
      'scifi': 'skillScifi',
      'animation': 'skillAnimation',
      'romance': 'skillRomance',
    };
    const skillKey = genreMap[film.genre];
    return skillKey ? (talent[skillKey] as number) || 50 : 50;
  };

  const sortTalent = (talentList: Talent[], sortBy: 'fame' | 'performance' | 'genre') => {
    return [...talentList].sort((a, b) => {
      if (sortBy === 'fame') return b.fame - a.fame;
      if (sortBy === 'performance') return b.performance - a.performance;
      if (sortBy === 'genre') return getGenreScore(b) - getGenreScore(a);
      return 0;
    });
  };

  const directors = sortTalent(talent.filter(t => t.type === 'director'), directorSort);
  const actors = sortTalent(talent.filter(t => t.type === 'actor'), actorSort);
  const directorCost = selectedDirector?.askingPrice || 0;
  
  // Calculate actual cast costs by summing actor asking prices
  const castCost = Object.keys(roleCasts).reduce((sum, roleId) => {
    const actorId = roleCasts[roleId];
    const actor = talent.find(t => t.id === actorId);
    return sum + (actor?.askingPrice || 0);
  }, 0);
  
  const talentBudget = directorCost + castCost;
  const totalBudget = talentBudget + productionBudget + setsBudget + costumesBudget + stuntsBudget + makeupBudget + practicalEffectsBudget + soundCrewBudget;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const castIds = Object.values(roleCasts).filter(Boolean);
      await hireTalent(film.id, {
        directorId: selectedDirector?.id,
        castIds,
        productionBudget,
        setsBudget,
        costumesBudget,
        stuntsBudget,
        makeupBudget,
        practicalEffectsBudget,
        soundCrewBudget,
        talentBudget,
        totalCost: totalBudget,
      });
      toast({ title: 'Talent Hired!', description: 'Moving to pre-production...' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to hire talent', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ['director', 'cast', 'budgets-review'] as const;
  const stepLabels = { director: 'Select Director', cast: 'Cast Roles', 'budgets-review': 'Set Budgets & Review' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto sleek-scrollbar">
        <DialogHeader>
          <DialogTitle>Pre-Production: {stepLabels[step]}</DialogTitle>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center">
                <button
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step === s 
                      ? 'bg-primary text-primary-foreground' 
                      : i < steps.indexOf(step)
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => i <= steps.indexOf(step) && setStep(s)}
                >
                  {i + 1}
                </button>
                {i < 2 && <div className={`w-8 h-0.5 ${i < steps.indexOf(step) ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Director */}
          {step === 'director' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Directors List */}
              <div className="border rounded-lg overflow-hidden flex flex-col max-h-[600px]">
                <div className="border-b p-2 space-y-1 bg-muted/50">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Sort By:</div>
                  <div className="flex gap-1">
                    <button onClick={() => setDirectorSort('fame')} className={`px-2 py-1 text-xs rounded ${directorSort === 'fame' ? 'bg-primary text-white' : 'bg-muted'}`}>Fame</button>
                    <button onClick={() => setDirectorSort('performance')} className={`px-2 py-1 text-xs rounded ${directorSort === 'performance' ? 'bg-primary text-white' : 'bg-muted'}`}>Performance</button>
                    <button onClick={() => setDirectorSort('genre')} className={`px-2 py-1 text-xs rounded ${directorSort === 'genre' ? 'bg-primary text-white' : 'bg-muted'}`}>Genre</button>
                  </div>
                </div>
                <ScrollArea className="h-[550px]">
                  <div className="space-y-1 p-2">
                    {directors.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDirector(d)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedDirector?.id === d.id
                            ? 'bg-yellow-500 text-white font-semibold'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Middle: Director Details */}
              {selectedDirector ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 text-center">
                    {selectedDirector.imageUrl && (
                      <img src={selectedDirector.imageUrl} alt={selectedDirector.name} className="w-32 h-32 rounded-lg mx-auto mb-3 object-cover" />
                    )}
                    <h3 className="font-bold text-lg">{selectedDirector.name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Salary:</span>
                      <span className="font-medium">{formatMoney(selectedDirector.askingPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Fame:</span>
                      <div className="flex-1 bg-muted rounded h-2">
                        <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedDirector.fame / 100) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Experience:</span>
                      <div className="flex-1 bg-muted rounded h-2">
                        <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedDirector.experience / 100) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Performance:</span>
                      <div className="flex-1 bg-muted rounded h-2">
                        <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedDirector.performance / 100) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">{film.genre.charAt(0).toUpperCase() + film.genre.slice(1)} Score:</span>
                      <div className="flex-1 bg-muted rounded h-2">
                        <div className="bg-yellow-500 h-full rounded" style={{ width: `${(getGenreScore(selectedDirector) / 100) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 flex items-center justify-center text-muted-foreground">
                  Select a director
                </div>
              )}
            </div>
          )}

          {/* Step 2: Cast Roles */}
          {step === 'cast' && (
            <div className="space-y-4">
              {roles.length > 0 ? (
                <div className="grid grid-cols-3 gap-6">
                  {/* Left: Roles List */}
                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-1 p-2">
                        {roles.map(role => {
                          const isCast = roleCasts[role.id];
                          const importance = role.importance === 'lead' ? '⭐' : role.importance === 'supporting' ? '◆' : '○';
                          return (
                            <button
                              key={role.id}
                              onClick={() => {
                                setSelectedRole(role);
                                setSelectedActor(null);
                              }}
                              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                selectedRole?.id === role.id
                                  ? 'bg-yellow-500 text-white font-semibold'
                                  : isCast
                                  ? 'bg-blue-500/20 text-blue-600 font-medium'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              {importance} {role.roleName}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Middle: Actors List (filtered by role requirements) */}
                  <div className="border rounded-lg overflow-hidden flex flex-col max-h-[600px]">
                    <div className="border-b p-2 space-y-1 bg-muted/50">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Sort By:</div>
                      <div className="flex gap-1">
                        <button onClick={() => setActorSort('fame')} className={`px-2 py-1 text-xs rounded ${actorSort === 'fame' ? 'bg-primary text-white' : 'bg-muted'}`}>Fame</button>
                        <button onClick={() => setActorSort('performance')} className={`px-2 py-1 text-xs rounded ${actorSort === 'performance' ? 'bg-primary text-white' : 'bg-muted'}`}>Performance</button>
                        <button onClick={() => setActorSort('genre')} className={`px-2 py-1 text-xs rounded ${actorSort === 'genre' ? 'bg-primary text-white' : 'bg-muted'}`}>Genre</button>
                      </div>
                    </div>
                    <ScrollArea className="h-[550px]">
                      <div className="space-y-1 p-2">
                        {selectedRole ? (() => {
                          const filteredActors = actors.filter(a => 
                            selectedRole.genderPreference === 'any' || a.gender === selectedRole.genderPreference
                          );
                          return filteredActors.map(a => (
                            <button
                              key={a.id}
                              onClick={() => setSelectedActor(a)}
                              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                selectedActor?.id === a.id
                                  ? 'bg-yellow-500 text-white font-semibold'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              {a.name}
                            </button>
                          ));
                        })() : (
                          <div className="p-4 text-center text-muted-foreground text-sm">Select a role first</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Right: Actor Details & Cast Button */}
                  {selectedActor && selectedRole ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 text-center">
                        {selectedActor.imageUrl && (
                          <img src={selectedActor.imageUrl} alt={selectedActor.name} className="w-32 h-32 rounded-lg mx-auto mb-3 object-cover" />
                        )}
                        <h3 className="font-bold text-lg">{selectedActor.name}</h3>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Salary:</span>
                          <span className="font-medium">{formatMoney(selectedActor.askingPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Fame:</span>
                          <div className="flex-1 bg-muted rounded h-2">
                            <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedActor.fame / 100) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Experience:</span>
                          <div className="flex-1 bg-muted rounded h-2">
                            <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedActor.experience / 100) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Performance:</span>
                          <div className="flex-1 bg-muted rounded h-2">
                            <div className="bg-yellow-500 h-full rounded" style={{ width: `${(selectedActor.performance / 100) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">{film.genre.charAt(0).toUpperCase() + film.genre.slice(1)} Score:</span>
                          <div className="flex-1 bg-muted rounded h-2">
                            <div className="bg-yellow-500 h-full rounded" style={{ width: `${(getGenreScore(selectedActor) / 100) * 100}%` }} />
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          if (selectedRole && selectedActor) {
                            setRoleCasts({ ...roleCasts, [selectedRole.id]: selectedActor.id });
                            setSelectedActor(null);
                            setSelectedRole(null);
                          }
                        }}
                        className="w-full bg-yellow-500 hover:bg-yellow-600"
                      >
                        Cast {selectedActor.name}
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 flex items-center justify-center text-muted-foreground">
                      {selectedRole ? 'Select an actor' : 'Select a role first'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No roles defined for this film</div>
              )}
            </div>
          )}

          {/* Step 3: Set Budgets & Review */}
          {step === 'budgets-review' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Budget Sliders */}
              <div className="space-y-8">
                <h4 className="font-bold text-sm mb-3">Set Budgets</h4>
                <div>
                  <Label className="text-sm">Production Budget: {formatMoney(productionBudget)}</Label>
                  <Slider value={[productionBudget]} onValueChange={([v]) => setProductionBudget(v)} min={0} max={250000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Sets Budget: {formatMoney(setsBudget)}</Label>
                  <Slider value={[setsBudget]} onValueChange={([v]) => setSetsBudget(v)} min={0} max={40000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Costumes Budget: {formatMoney(costumesBudget)}</Label>
                  <Slider value={[costumesBudget]} onValueChange={([v]) => setCostumesBudget(v)} min={0} max={10000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Stunts Budget: {formatMoney(stuntsBudget)}</Label>
                  <Slider value={[stuntsBudget]} onValueChange={([v]) => setStuntsBudget(v)} min={0} max={15000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Makeup & Hair Budget: {formatMoney(makeupBudget)}</Label>
                  <Slider value={[makeupBudget]} onValueChange={([v]) => setMakeupBudget(v)} min={0} max={8000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Practical Effects Budget: {formatMoney(practicalEffectsBudget)}</Label>
                  <Slider value={[practicalEffectsBudget]} onValueChange={([v]) => setPracticalEffectsBudget(v)} min={0} max={30000000} step={100000} />
                </div>
                <div>
                  <Label className="text-sm">Sound Crew Budget: {formatMoney(soundCrewBudget)}</Label>
                  <Slider value={[soundCrewBudget]} onValueChange={([v]) => setSoundCrewBudget(v)} min={0} max={10000000} step={100000} />
                </div>
              </div>

              {/* Right: Review */}
              <div className="border rounded-lg p-4 overflow-y-auto h-[600px] space-y-4 sleek-scrollbar">
                <h4 className="font-bold text-sm">Review & Confirm</h4>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Director</p>
                  <p className="text-sm font-medium">{selectedDirector?.name || 'None selected'}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2">Cast</p>
                  <div className="space-y-1">
                    {roles.map(role => {
                      const actor = actors.find(a => a.id === roleCasts[role.id]);
                      return <p key={role.id} className="text-xs">{role.roleName}: {actor?.name || 'Uncast'}</p>;
                    })}
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Budget Breakdown</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Director:</span><span className="font-medium">{formatMoney(directorCost)}</span></div>
                    <div className="flex justify-between"><span>Cast:</span><span className="font-medium">{formatMoney(castCost)}</span></div>
                    <div className="flex justify-between"><span>Production:</span><span className="font-medium">{formatMoney(productionBudget)}</span></div>
                    <div className="flex justify-between"><span>Sets:</span><span className="font-medium">{formatMoney(setsBudget)}</span></div>
                    <div className="flex justify-between"><span>Costumes:</span><span className="font-medium">{formatMoney(costumesBudget)}</span></div>
                    <div className="flex justify-between"><span>Stunts:</span><span className="font-medium">{formatMoney(stuntsBudget)}</span></div>
                    <div className="flex justify-between"><span>Makeup:</span><span className="font-medium">{formatMoney(makeupBudget)}</span></div>
                    <div className="flex justify-between"><span>Practical Effects:</span><span className="font-medium">{formatMoney(practicalEffectsBudget)}</span></div>
                    <div className="flex justify-between"><span>Sound Crew:</span><span className="font-medium">{formatMoney(soundCrewBudget)}</span></div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base"><span>Total:</span><span>{formatMoney(totalBudget)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => step === 'director' ? onOpenChange(false) : setStep(steps[steps.indexOf(step) - 1])}>
            {step === 'director' ? 'Cancel' : 'Back'}
          </Button>
          <Button 
            onClick={() => step === 'budgets-review' ? handleSubmit() : setStep(steps[steps.indexOf(step) + 1])}
            disabled={step !== 'budgets-review' && !selectedDirector && step === 'director'}
          >
            {step === 'budgets-review' ? (isSubmitting ? 'Saving...' : 'Start Production') : 'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPostProductionModal({ film, open, onOpenChange }: { film: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { talent, editPostProduction } = useGame();
  const [selectedComposer, setSelectedComposer] = useState<Talent | null>(film.composer || null);
  const [selectedVFXStudio, setSelectedVFXStudio] = useState<any>(film.vfxStudio || null);
  const [vfxStudios, setVFXStudios] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/vfx-studios')
      .then(res => res.json())
      .then(data => setVFXStudios(data))
      .catch(err => console.error('Failed to fetch VFX studios:', err));
  }, []);

  const getGenreScore = (tal: Talent): number => {
    const genreMap: Record<string, keyof Talent> = {
      'action': 'skillAction',
      'drama': 'skillDrama',
      'comedy': 'skillComedy',
      'thriller': 'skillThriller',
      'horror': 'skillHorror',
      'scifi': 'skillScifi',
      'animation': 'skillAnimation',
      'romance': 'skillRomance',
    };
    const skillKey = genreMap[film.genre];
    return skillKey ? (tal[skillKey] as number) || 50 : 50;
  };

  const composers = talent.filter(t => t.type === 'composer');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await editPostProduction(film.id, {
        composerId: selectedComposer?.id,
        vfxStudioId: selectedVFXStudio?.id,
      });
      toast({ title: 'Post-Production Set!', description: 'Moving to release preparation...' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update post-production', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto sleek-scrollbar">
        <DialogHeader>
          <DialogTitle>Edit Film - Post Production</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Composer Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Composer</Label>
            <ScrollArea className="h-[200px] border rounded-lg p-3">
              {composers.length > 0 ? (
                <div className="space-y-2">
                  {composers.map(c => (
                    <div key={c.id} onClick={() => setSelectedComposer(c)} className={`p-3 rounded-lg border cursor-pointer transition-all flex gap-3 ${selectedComposer?.id === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                      {c.imageUrl && (
                        <img src={c.imageUrl} alt={c.name} className="w-16 h-16 object-cover rounded-full flex-shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">Fame: {c.fame}/100 • Performance: {c.performance}/100</div>
                        <div className="text-xs text-muted-foreground mt-1">{genreLabels[film.genre]} Score: {getGenreScore(c)}/100</div>
                        <div className="text-xs text-yellow-600 mt-1">Salary: {formatMoney(c.askingPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">No composers available</div>
              )}
            </ScrollArea>
          </div>

          {/* VFX Studio Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select VFX Studio (Optional)</Label>
            <ScrollArea className="h-[200px] border rounded-lg p-3">
              {vfxStudios.length > 0 ? (
                <div className="space-y-2">
                  <div onClick={() => setSelectedVFXStudio(null)} className={`p-3 rounded-lg border cursor-pointer transition-all ${!selectedVFXStudio ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    <div className="font-medium text-muted-foreground">None</div>
                  </div>
                  {vfxStudios.map(studio => (
                    <div key={studio.id} onClick={() => setSelectedVFXStudio(studio)} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedVFXStudio?.id === studio.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                      <div className="font-medium">{studio.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Quality: {studio.quality}/100 • Cost: {formatMoney(studio.cost)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Specialties: {studio.specialization?.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'General'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">No VFX studios available</div>
              )}
            </ScrollArea>
          </div>

          {/* Budget Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Production:</span>
                  <span className="font-medium">{formatMoney(film.productionBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sets:</span>
                  <span className="font-medium">{formatMoney(film.setsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costumes:</span>
                  <span className="font-medium">{formatMoney(film.costumesBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stunts:</span>
                  <span className="font-medium">{formatMoney(film.stuntsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Makeup:</span>
                  <span className="font-medium">{formatMoney(film.makeupBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Practical Effects:</span>
                  <span className="font-medium">{formatMoney(film.practicalEffectsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sound Crew:</span>
                  <span className="font-medium">{formatMoney(film.soundCrewBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Talent:</span>
                  <span className="font-medium">{formatMoney(film.talentBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Composer:</span>
                  <span className="font-medium">{formatMoney(selectedComposer?.askingPrice || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VFX Studio:</span>
                  <span className="font-medium">{formatMoney(selectedVFXStudio?.cost || 0)}</span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold text-base">
                  <span>Total with Post-Production:</span>
                  <span className="text-primary">{formatMoney((film.totalBudget || 0) + (selectedComposer?.askingPrice || 0) + (selectedVFXStudio?.cost || 0))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Complete Post-Production'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActiveProjects() {
  const { state } = useGame();

  if (state.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (state.films.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No active projects. Start developing a new film!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {state.films.map((film) => (
        <ProjectCard 
          key={film.id} 
          film={film} 
          currentYear={state.currentYear}
          currentWeek={state.currentWeek}
        />
      ))}
    </div>
  );
}
