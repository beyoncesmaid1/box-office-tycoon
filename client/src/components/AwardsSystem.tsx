import { useState, useMemo } from 'react';
import { Trophy, Medal, Star, Award, Loader2, Calendar, Sparkles, Crown, Check, ChevronLeft, User, Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGame, genreLabels, type FilmWithTalent } from '@/lib/gameState';
import { RatingDisplay } from './RatingDisplay';
import { useQuery } from '@tanstack/react-query';

interface AwardShow {
  id: string;
  name: string;
  shortName: string;
  prestigeLevel: number;
  nominationsWeek: number;
  ceremonyWeek: number;
  description: string;
}

interface AwardCategory {
  id: string;
  awardShowId: string;
  name: string;
  shortName: string;
  categoryType: string;
  requiresGenre: string | null;
  isPerformance: boolean;
  displayOrder: number;
}

interface AwardNomination {
  id: string;
  playerGameId: string;
  awardShowId: string;
  categoryId: string;
  filmId: string;
  talentId: string | null;
  ceremonyYear: number;
  isWinner: boolean;
  announcedWeek: number;
  announcedYear: number;
}

interface AwardCeremony {
  id: string;
  playerGameId: string;
  awardShowId: string;
  ceremonyYear: number;
  nominationsAnnounced: boolean;
  ceremonyComplete: boolean;
  winnersAnnounced: boolean;
}

interface Talent {
  id: string;
  name: string;
  type: string;
  starRating: number;
}

function getWeekDescription(week: number): string {
  if (week <= 4) return 'Early January';
  if (week <= 8) return 'Late January';
  if (week <= 13) return 'February/March';
  if (week <= 17) return 'April';
  if (week <= 22) return 'May';
  if (week <= 26) return 'June';
  if (week <= 30) return 'July';
  if (week <= 35) return 'August';
  if (week <= 39) return 'September';
  if (week <= 44) return 'October';
  if (week <= 48) return 'November';
  return 'December';
}

function getShowIcon(shortName: string) {
  switch (shortName) {
    case 'Oscar': return <Trophy className="w-5 h-5 text-amber-500" />;
    case 'Golden Globe': return <Sparkles className="w-5 h-5 text-yellow-500" />;
    case 'BAFTA': return <Crown className="w-5 h-5 text-purple-500" />;
    case 'SAG': return <Medal className="w-5 h-5 text-blue-500" />;
    case 'Critics Choice': return <Award className="w-5 h-5 text-emerald-500" />;
    default: return <Trophy className="w-5 h-5 text-primary" />;
  }
}

function getShowColor(shortName: string): string {
  switch (shortName) {
    case 'Oscar': return 'from-amber-500/20 to-transparent';
    case 'Golden Globe': return 'from-yellow-500/20 to-transparent';
    case 'BAFTA': return 'from-purple-500/20 to-transparent';
    case 'SAG': return 'from-blue-500/20 to-transparent';
    case 'Critics Choice': return 'from-emerald-500/20 to-transparent';
    default: return 'from-primary/10 to-transparent';
  }
}

function getShowHeaderBg(shortName: string): string {
  switch (shortName) {
    case 'Oscar': return 'bg-amber-900 dark:bg-amber-950';
    case 'Golden Globe': return 'bg-yellow-800 dark:bg-yellow-900';
    case 'BAFTA': return 'bg-purple-900 dark:bg-purple-950';
    case 'SAG': return 'bg-blue-900 dark:bg-blue-950';
    case 'Critics Choice': return 'bg-emerald-900 dark:bg-emerald-950';
    default: return 'bg-zinc-800 dark:bg-zinc-900';
  }
}

interface AwardShowCardProps {
  show: AwardShow;
  ceremony: AwardCeremony | undefined;
  nominations: AwardNomination[];
  categories: AwardCategory[];
  films: FilmWithTalent[];
  playerStudioId: string;
  currentWeek: number;
  currentYear: number;
  onViewDetails: () => void;
}

function AwardShowCard({ show, ceremony, nominations, categories, films, playerStudioId, currentWeek, currentYear, onViewDetails }: AwardShowCardProps) {
  const showNominations = nominations.filter(n => n.awardShowId === show.id);
  const showWinners = showNominations.filter(n => n.isWinner);
  
  const isNominationsAnnounced = ceremony?.nominationsAnnounced || false;
  const isCeremonyComplete = ceremony?.ceremonyComplete || false;
  
  const weeksToNominations = show.nominationsWeek - currentWeek;
  const weeksToCeremony = show.ceremonyWeek - currentWeek;
  
  const playerNominations = showNominations.filter(n => {
    const film = films.find(f => f.id === n.filmId);
    return film && film.studioId === playerStudioId;
  });
  const playerWins = playerNominations.filter(n => n.isWinner);
  
  return (
    <Card 
      className={`overflow-hidden bg-gradient-to-r ${getShowColor(show.shortName)} cursor-pointer hover-elevate transition-all`} 
      data-testid={`card-show-${show.id}`}
      onClick={onViewDetails}
    >
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-background/80 flex items-center justify-center">
              {getShowIcon(show.shortName)}
            </div>
            <div>
              <CardTitle className="text-lg">{show.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{show.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star 
                key={i}
                className={`w-4 h-4 ${i < show.prestigeLevel ? 'text-primary fill-primary' : 'text-muted-foreground'}`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              Nominations
            </div>
            {isNominationsAnnounced ? (
              <p className="font-medium text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Announced
              </p>
            ) : (
              <p className="font-medium">
                Week {show.nominationsWeek} ({getWeekDescription(show.nominationsWeek)})
                {weeksToNominations > 0 && weeksToNominations <= 12 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({weeksToNominations} weeks)
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trophy className="w-4 h-4" />
              Ceremony
            </div>
            {isCeremonyComplete ? (
              <p className="font-medium text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Complete
              </p>
            ) : (
              <p className="font-medium">
                Week {show.ceremonyWeek} ({getWeekDescription(show.ceremonyWeek)})
                {weeksToCeremony > 0 && weeksToCeremony <= 12 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({weeksToCeremony} weeks)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        
        {isNominationsAnnounced && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <p className="text-sm font-medium">Your Studio</p>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {playerNominations.length} Nomination{playerNominations.length !== 1 ? 's' : ''}
                </Badge>
                {playerWins.length > 0 && (
                  <Badge className="bg-primary/20 text-primary">
                    {playerWins.length} Win{playerWins.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            {playerNominations.length > 0 && (
              <div className="space-y-1">
                {playerNominations.slice(0, 5).map(nom => {
                  const film = films.find(f => f.id === nom.filmId);
                  const category = categories.find(c => c.id === nom.categoryId);
                  return (
                    <div key={nom.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-muted-foreground">{category?.shortName || 'Award'}</span>
                      <span className="flex items-center gap-2">
                        {film?.title || 'Unknown Film'}
                        {nom.isWinner && (
                          <Trophy className="w-3 h-3 text-amber-500" />
                        )}
                      </span>
                    </div>
                  );
                })}
                {playerNominations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-right">
                    +{playerNominations.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="pt-2 text-center">
          <span className="text-sm text-muted-foreground">View ceremony history</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface AwardShowDetailProps {
  show: AwardShow;
  nominations: AwardNomination[];
  ceremonies: AwardCeremony[];
  categories: AwardCategory[];
  films: FilmWithTalent[];
  allFilms: FilmWithTalent[];
  talent: Talent[];
  currentYear: number;
  playerStudioId: string;
  onBack: () => void;
  awardShows: AwardShow[];
  onSwitchShow: (showId: string) => void;
}

function AwardShowDetail({ 
  show, 
  nominations, 
  ceremonies, 
  categories, 
  films, 
  allFilms,
  talent,
  currentYear, 
  playerStudioId,
  onBack,
  awardShows,
  onSwitchShow
}: AwardShowDetailProps) {
  const showCeremonies = ceremonies.filter(c => c.awardShowId === show.id && c.nominationsAnnounced);
  const availableYears = Array.from(new Set(showCeremonies.map(c => c.ceremonyYear))).sort((a, b) => b - a);
  
  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears.length > 0 ? availableYears[0] : currentYear
  );
  
  const showCategories = categories
    .filter(c => c.awardShowId === show.id)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  
  const yearNominations = nominations.filter(
    n => n.awardShowId === show.id && n.ceremonyYear === selectedYear
  );
  
  const getTalentRole = (category: AwardCategory): string => {
    if (category.categoryType === 'direction') return 'Director';
    if (category.categoryType === 'writing') return 'Writer';
    if (category.categoryType === 'acting') return 'Actor';
    if (category.categoryType === 'technical') return 'Crew';
    return 'Filmmaker';
  };
  
  const getFilmForNomination = (nom: AwardNomination): FilmWithTalent | undefined => {
    return allFilms.find(f => f.id === nom.filmId) || films.find(f => f.id === nom.filmId);
  };
  
  const getTalentForNomination = (nom: AwardNomination, category: AwardCategory, film?: FilmWithTalent): { name: string, role: string } => {
    if (nom.talentId) {
      const t = talent.find(tal => tal.id === nom.talentId);
      if (t) {
        return { name: t.name, role: getTalentRole(category) };
      }
    }
    
    if (film) {
      if (category.categoryType === 'direction' && film.director) {
        return { name: film.director.name, role: 'Director' };
      }
      if (category.categoryType === 'writing' && film.writer) {
        return { name: film.writer.name, role: 'Writer' };
      }
      if (category.categoryType === 'acting' && film.cast && film.cast.length > 0) {
        return { name: film.cast[0].name, role: 'Actor' };
      }
    }
    
    return { name: film?.title || 'Unknown', role: getTalentRole(category) };
  };
  
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] gap-0 bg-background rounded-lg overflow-hidden border">
      <div className="w-48 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="mb-2 -ml-2"
            data-testid="button-back-awards"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {availableYears.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No ceremonies yet</p>
            ) : (
              availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                    selectedYear === year 
                      ? 'bg-primary text-primary-foreground font-medium' 
                      : 'hover:bg-muted text-foreground'
                  }`}
                  data-testid={`button-year-${year}`}
                >
                  {year}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t">
          <label className="text-xs text-muted-foreground mb-2 block">Show:</label>
          <Select value={show.id} onValueChange={onSwitchShow}>
            <SelectTrigger className="w-full" data-testid="select-award-show">
              <SelectValue>{show.shortName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {awardShows.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className={`${getShowHeaderBg(show.shortName)} text-white p-6`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
              {getShowIcon(show.shortName)}
            </div>
            <div>
              <h2 className="font-display text-3xl">{show.shortName} {selectedYear}</h2>
              <p className="text-white/80">{show.name}</p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {availableYears.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-lg">No ceremonies have been held yet</p>
                <p className="text-muted-foreground text-sm mt-2">
                  Ceremonies happen at week {show.ceremonyWeek} each year
                </p>
              </div>
            ) : (
              showCategories.map(category => {
                const categoryNoms = yearNominations
                  .filter(n => n.categoryId === category.id)
                  .sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0));
                
                if (categoryNoms.length === 0) return null;
                
                return (
                  <div key={category.id} className="space-y-3">
                    <h3 className="font-display text-xl border-b pb-2">{category.name}</h3>
                    <div className="space-y-1">
                      {categoryNoms.map(nom => {
                        const film = getFilmForNomination(nom);
                        const { name: talentName, role } = getTalentForNomination(nom, category, film);
                        const isPlayerFilm = film && film.studioId === playerStudioId;
                        
                        return (
                          <div 
                            key={nom.id}
                            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                              nom.isWinner 
                                ? 'bg-amber-500/10' 
                                : 'bg-muted/30'
                            } ${isPlayerFilm ? 'ring-1 ring-primary/30' : ''}`}
                            data-testid={`nomination-${nom.id}`}
                          >
                            <div className="flex-shrink-0">
                              <Trophy 
                                className={`w-8 h-8 ${
                                  nom.isWinner ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/40'
                                }`} 
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {category.isPerformance || category.categoryType === 'direction' || category.categoryType === 'writing' 
                                    ? talentName 
                                    : film?.title || 'Unknown Film'}
                                </span>
                                {isPlayerFilm && (
                                  <Badge variant="outline" className="text-xs shrink-0">Your Film</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {category.isPerformance || category.categoryType === 'direction' || category.categoryType === 'writing'
                                  ? film?.title || 'Unknown Film'
                                  : talentName}
                              </p>
                              <p className="text-xs text-muted-foreground">{role}</p>
                            </div>
                            
                            <div className="flex-shrink-0 text-right">
                              <span className="text-muted-foreground">{selectedYear}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function AwardsSystem() {
  const { state, talent } = useGame();
  const [tab, setTab] = useState('shows');
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  
  const { data: awardShows = [], isLoading: showsLoading } = useQuery<AwardShow[]>({
    queryKey: ['/api/award-shows'],
  });
  
  const { data: nominations = [], isLoading: nomsLoading } = useQuery<AwardNomination[]>({
    queryKey: ['/api/nominations', state.studioId],
    enabled: !!state.studioId,
  });
  
  const { data: ceremonies = [], isLoading: ceremLoading } = useQuery<AwardCeremony[]>({
    queryKey: ['/api/ceremonies', state.studioId],
    enabled: !!state.studioId,
  });
  
  const { data: allFilms = [] } = useQuery<FilmWithTalent[]>({
    queryKey: ['/api/all-films', state.studioId],
    enabled: !!state.studioId,
  });
  
  const categoriesQueries = useQuery<AwardCategory[]>({
    queryKey: ['/api/award-categories-all'],
    queryFn: async () => {
      const allCategories: AwardCategory[] = [];
      for (const show of awardShows) {
        const response = await fetch(`/api/award-shows/${show.id}/categories`);
        if (response.ok) {
          const cats = await response.json();
          allCategories.push(...cats);
        }
      }
      return allCategories;
    },
    enabled: awardShows.length > 0,
  });
  
  const categories = categoriesQueries.data || [];

  const isLoading = state.isLoading || showsLoading || nomsLoading || ceremLoading;

  const sortedShows = useMemo(() => {
    return [...awardShows].sort((a, b) => b.prestigeLevel - a.prestigeLevel);
  }, [awardShows]);
  
  const selectedShow = awardShows.find(s => s.id === selectedShowId);
  
  const allFilmsWithAwards = state.releasedFilms.filter(f => f.awards && f.awards.length > 0);
  
  const winsByShow = useMemo(() => {
    const wins: Record<string, { show: AwardShow, nominations: AwardNomination[], count: number }> = {};
    for (const show of awardShows) {
      const showNoms = nominations.filter(n => n.awardShowId === show.id && n.isWinner);
      if (showNoms.length > 0) {
        wins[show.id] = { show, nominations: showNoms, count: showNoms.length };
      }
    }
    return Object.values(wins).sort((a, b) => b.show.prestigeLevel - a.show.prestigeLevel);
  }, [awardShows, nominations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (selectedShow) {
    return (
      <div className="space-y-6">
        <AwardShowDetail
          show={selectedShow}
          nominations={nominations}
          ceremonies={ceremonies}
          categories={categories}
          films={state.releasedFilms}
          allFilms={allFilms}
          talent={talent}
          currentYear={state.currentYear}
          playerStudioId={state.studioId}
          onBack={() => setSelectedShowId(null)}
          awardShows={sortedShows}
          onSwitchShow={setSelectedShowId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">Awards Season</h2>
        <p className="text-muted-foreground mt-1">
          Week {state.currentWeek}, {state.currentYear} - Build your studio's prestige
        </p>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Awards Won</p>
              <p className="font-display text-4xl">{state.totalAwards}</p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div>
              <p className="text-sm text-muted-foreground">Active Nominations</p>
              <p className="font-display text-4xl">
                {nominations.filter(n => !n.isWinner && ceremonies.some(c => 
                  c.awardShowId === n.awardShowId && 
                  c.ceremonyYear === n.ceremonyYear && 
                  !c.ceremonyComplete
                )).length}
              </p>
            </div>
            <div className="h-12 w-px bg-border hidden md:block" />
            <div>
              <p className="text-sm text-muted-foreground">Studio Prestige</p>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i}
                    className={`w-5 h-5 ${i < state.prestigeLevel ? 'text-primary fill-primary' : 'text-muted-foreground'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Award Dates Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Award Season Schedule - {state.currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedShows.map(show => {
              const ceremony = ceremonies.find(c => c.awardShowId === show.id && c.ceremonyYear === state.currentYear);
              const isNominationsAnnounced = ceremony?.nominationsAnnounced || false;
              const isCeremonyComplete = ceremony?.ceremonyComplete || false;
              const weeksToNominations = show.nominationsWeek - state.currentWeek;
              const weeksToCeremony = show.ceremonyWeek - state.currentWeek;
              
              return (
                <div key={show.id} className={`p-3 rounded-lg border bg-gradient-to-r ${getShowColor(show.shortName)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getShowIcon(show.shortName)}
                    <span className="font-medium">{show.shortName}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Nominations:</span>
                      {isNominationsAnnounced ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span>
                          Week {show.nominationsWeek}
                          {weeksToNominations > 0 && weeksToNominations <= 20 && (
                            <span className="text-muted-foreground ml-1">({weeksToNominations}w)</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ceremony:</span>
                      {isCeremonyComplete ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span>
                          Week {show.ceremonyWeek}
                          {weeksToCeremony > 0 && weeksToCeremony <= 20 && (
                            <span className="text-muted-foreground ml-1">({weeksToCeremony}w)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="shows" data-testid="tab-shows">
            Award Shows
          </TabsTrigger>
          <TabsTrigger value="nominations" data-testid="tab-nominations">
            Nominations
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            Award History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shows" className="mt-4 space-y-4">
          {sortedShows.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <p className="text-muted-foreground">Award shows will appear here once initialized.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sortedShows.map(show => {
                const ceremony = ceremonies.find(c => c.awardShowId === show.id);
                return (
                  <AwardShowCard
                    key={show.id}
                    show={show}
                    ceremony={ceremony}
                    nominations={nominations}
                    categories={categories}
                    films={state.releasedFilms}
                    playerStudioId={state.studioId}
                    currentWeek={state.currentWeek}
                    currentYear={state.currentYear}
                    onViewDetails={() => setSelectedShowId(show.id)}
                  />
                );
              })}
            </div>
          )}
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Award shows recognize films released in the previous calendar year.
                </p>
                <p className="text-sm text-muted-foreground">
                  Launch awards campaigns via email to boost your chances of winning!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nominations" className="mt-4 space-y-4">
          {nominations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No nominations yet. Release high-quality films to receive nominations!
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {winsByShow.length > 0 && (
                  <>
                    <h3 className="font-medium text-lg">Wins by Show</h3>
                    {winsByShow.map(({ show, nominations: showNoms }) => (
                      <Card key={show.id} className={`bg-gradient-to-r ${getShowColor(show.shortName)}`}>
                        <CardHeader className="pb-2 gap-1">
                          <div className="flex items-center gap-2">
                            {getShowIcon(show.shortName)}
                            <CardTitle className="text-base">{show.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {showNoms.map(nom => {
                              const film = state.releasedFilms.find(f => f.id === nom.filmId);
                              const category = categories.find(c => c.id === nom.categoryId);
                              return (
                                <div key={nom.id} className="flex items-center justify-between py-1 text-sm">
                                  <span className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    {category?.name || 'Award'}
                                  </span>
                                  <span className="font-medium">{film?.title || 'Unknown'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
                
                <h3 className="font-medium text-lg mt-6">All Nominations</h3>
                {awardShows.map(show => {
                  const showNoms = nominations.filter(n => n.awardShowId === show.id);
                  if (showNoms.length === 0) return null;
                  
                  return (
                    <Card key={show.id}>
                      <CardHeader className="pb-2 gap-1">
                        <div className="flex items-center gap-2">
                          {getShowIcon(show.shortName)}
                          <CardTitle className="text-base">{show.name}</CardTitle>
                          <Badge variant="secondary">{showNoms.length}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {showNoms.map(nom => {
                            const film = state.releasedFilms.find(f => f.id === nom.filmId);
                            const category = categories.find(c => c.id === nom.categoryId);
                            return (
                              <div key={nom.id} className="flex items-center justify-between py-1 text-sm border-b border-border/50 last:border-0">
                                <span className="text-muted-foreground">{category?.shortName || 'Award'}</span>
                                <span className="flex items-center gap-2">
                                  {film?.title || 'Unknown'}
                                  {nom.isWinner && (
                                    <Badge className="bg-amber-500/20 text-amber-600 text-xs">
                                      Winner
                                    </Badge>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          {allFilmsWithAwards.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No awards won yet. Release high-quality films to win awards!
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {allFilmsWithAwards.map(film => (
                  <Card key={film.id} className="hover-elevate" data-testid={`card-award-${film.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <p className="font-medium text-lg">{film.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {genreLabels[film.genre as keyof typeof genreLabels]}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {film.awards?.length || 0} Award{film.awards?.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="py-3">
                          <RatingDisplay 
                            criticScore={film.criticScore || 0} 
                            audienceScore={film.audienceScore || 0}
                            voteCount={1000}
                            openingWeekend={film.weeklyBoxOffice[0] || 0}
                            size="sm"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {film.awards?.map((award, idx) => (
                            <Badge 
                              key={`${award}-${idx}`} 
                              className="bg-primary/20 text-primary"
                              data-testid={`badge-award-${award.replace(/\s+/g, '-')}`}
                            >
                              <Trophy className="w-3 h-3 mr-1" />
                              {award}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
