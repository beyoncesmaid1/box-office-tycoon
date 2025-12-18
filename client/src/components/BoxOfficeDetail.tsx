import { useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Star, Award, Calendar, Users, ChevronLeft, ChevronRight, Play, X, Film, Clock, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGame, formatMoney, genreColors, genreLabels } from '@/lib/gameState';
import { getGenrePoster } from '@/lib/genrePosters';
import { RatingDisplay } from './RatingDisplay';
import { useQuery } from '@tanstack/react-query';
import type { Film as FilmType, Studio } from '@shared/schema';
import { BoxOfficeCountryBreakdown } from './BoxOfficeCountryBreakdown';

const TERRITORIES = [
  { code: 'ALL', name: 'Worldwide' },
  { code: 'NA', name: 'North America' },
  { code: 'CN', name: 'China' },
  { code: 'GB', name: 'UK & Ireland' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'DE', name: 'Germany' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'OTHER', name: 'Other Territories' },
] as const;

interface FilmCardProps {
  film: FilmType;
  rank?: number;
  isYours: boolean;
  studioName: string;
  showWeeklyChange?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  territoryFilter?: string;
  getTerritoryBoxOffice?: (film: FilmType, territory: string) => number;
  getTerritoryWeeklyEarnings?: (film: FilmType, territory: string) => number;
}

function FilmCard({ film, rank, isYours, studioName, showWeeklyChange = true, isExpanded, onToggle, territoryFilter = 'ALL', getTerritoryBoxOffice, getTerritoryWeeklyEarnings }: FilmCardProps) {
  // Use territory-specific weekly earnings if available
  const lastWeek = getTerritoryWeeklyEarnings && territoryFilter !== 'ALL'
    ? getTerritoryWeeklyEarnings(film, territoryFilter)
    : (film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0);
  
  // For previous week, we need the previous week's territory earnings if available
  let prevWeek = lastWeek;
  if (getTerritoryWeeklyEarnings && territoryFilter !== 'ALL') {
    const weeklyByCountry = film.weeklyBoxOfficeByCountry as Array<Record<string, number>> || [];
    const territoryNameMap: Record<string, string> = {
      'NA': 'North America', 'CN': 'China', 'GB': 'UK & Ireland', 'FR': 'France', 'JP': 'Japan',
      'DE': 'Germany', 'KR': 'South Korea', 'MX': 'Mexico', 'AU': 'Australia', 'IN': 'India', 'OTHER': 'Other Territories',
    };
    const territoryName = territoryNameMap[territoryFilter] || territoryFilter;
    if (weeklyByCountry.length >= 2) {
      const prevWeekData = weeklyByCountry[weeklyByCountry.length - 2] || {};
      prevWeek = prevWeekData[territoryName] || lastWeek;
    }
  } else {
    prevWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 2] || lastWeek;
  }
  
  const change = prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : 0;
  const weeksInRelease = film.weeklyBoxOffice.length;
  const isFinished = film.status === 'archived';
  const posterUrl = film.posterUrl || getGenrePoster(film.genre);
  
  // Show territory-specific totals if available
  const displayGross = getTerritoryBoxOffice && territoryFilter !== 'ALL' 
    ? getTerritoryBoxOffice(film, territoryFilter) 
    : film.totalBoxOffice;

  return (
    <div className="flex-shrink-0 w-64 group">
      <div
        className={`relative h-80 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
          isYours ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        } ${isExpanded ? 'ring-2 ring-white/50' : 'hover:scale-105 hover:shadow-2xl hover:shadow-primary/20'}`}
        onClick={onToggle}
        data-testid={`card-film-${film.id}`}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
        
        {rank && rank <= 3 && (
          <div className={`absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center font-display text-xl font-bold ${
            rank === 1 ? 'bg-yellow-500 text-black' : 
            rank === 2 ? 'bg-gray-300 text-black' : 
            'bg-amber-700 text-white'
          }`}>
            {rank}
          </div>
        )}
        
        {rank && rank > 3 && (
          <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-display text-sm font-bold text-white">
            {rank}
          </div>
        )}

        {isYours && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary text-primary-foreground">Your Film</Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-xs ${genreColors[film.genre as keyof typeof genreColors]}`}>
              {genreLabels[film.genre as keyof typeof genreLabels]}
            </Badge>
            <span className="text-xs text-gray-400">Week {weeksInRelease}</span>
          </div>
          
          <h3 className="font-display text-xl text-white font-bold leading-tight line-clamp-2">
            {film.title}
          </h3>
          
          <p className="text-xs text-gray-400">{studioName}</p>
          
          <div className="pt-2 space-y-1">
            {isFinished ? (
              <Badge className="bg-green-600 text-white text-xs">Finished</Badge>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">This Week</span>
                  {showWeeklyChange && (
                    <span className={`text-xs flex items-center gap-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(change).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="font-display text-lg text-white">{formatMoney(lastWeek)}</p>
              </>
            )}
          </div>
          
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Total Gross</span>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-gray-300">{film.audienceScore.toFixed(1)}</span>
              </div>
            </div>
            <p className="font-display text-2xl text-primary">{formatMoney(displayGross)}</p>
          </div>
        </div>

        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
      </div>
    </div>
  );
}

function UpcomingFilmCard({ film, isYours, studioName }: { film: FilmType; isYours: boolean; studioName: string }) {
  const totalWeeks = film.phase === 'development' ? film.developmentDurationWeeks :
    film.phase === 'pre-production' ? film.preProductionDurationWeeks :
    film.phase === 'production' ? film.productionDurationWeeks :
    film.phase === 'post-production' ? film.postProductionDurationWeeks : 1;
  
  const progress = totalWeeks > 0 ? (film.weeksInCurrentPhase / totalWeeks) * 100 : 0;
  const posterUrl = getGenrePoster(film.genre);

  return (
    <div className="flex-shrink-0 w-56 group">
      <div
        className={`relative h-72 rounded-lg overflow-hidden transition-all duration-300 ${
          isYours ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        } hover:scale-105`}
        data-testid={`card-upcoming-${film.id}`}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50" 
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
        
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className="text-xs border-white/30 text-white/80 bg-black/30">
            {film.phase.charAt(0).toUpperCase() + film.phase.slice(1).replace('-', ' ')}
          </Badge>
        </div>

        {isYours && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary text-primary-foreground text-xs">Your Film</Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          <Badge variant="secondary" className={`text-xs ${genreColors[film.genre as keyof typeof genreColors]}`}>
            {genreLabels[film.genre as keyof typeof genreLabels]}
          </Badge>
          
          <h3 className="font-display text-lg text-white font-bold leading-tight line-clamp-2">
            {film.title}
          </h3>
          
          <p className="text-xs text-gray-400">{studioName}</p>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Progress</span>
              <span className="text-white">{film.weeksInCurrentPhase}/{totalWeeks} weeks</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Budget</span>
            <span className="text-white font-medium">{formatMoney((film.totalBudget || 0) - (film.marketingBudget || 0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizontalCarousel({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-foreground flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="text-sm font-normal text-muted-foreground">({count})</span>
          )}
        </h2>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={() => scroll('left')} className="rounded-full" data-testid={`button-scroll-left-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => scroll('right')} className="rounded-full" data-testid={`button-scroll-right-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}

function HeroBanner({ film, studioName, isYours, onExpand }: { film: FilmType; studioName: string; isYours: boolean; onExpand: () => void }) {
  const lastWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0;
  const prevWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 2] || lastWeek;
  const change = prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : 0;
  const posterUrl = getGenrePoster(film.genre);

  return (
    <div className="relative h-80 md:h-96 rounded-2xl overflow-hidden" data-testid="hero-banner">
      <div 
        className="absolute inset-0 bg-cover bg-center" 
        style={{ backgroundImage: `url(${posterUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />
      
      <div className="absolute top-6 left-6">
        <Badge className="bg-yellow-500 text-black font-bold text-sm px-3 py-1">
          #1 This Week
        </Badge>
      </div>

      {isYours && (
        <div className="absolute top-6 right-6">
          <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">
            Your Film
          </Badge>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={`${genreColors[film.genre as keyof typeof genreColors]}`}>
            {genreLabels[film.genre as keyof typeof genreLabels]}
          </Badge>
          <span className="text-sm text-gray-300">{studioName}</span>
          <span className="text-sm text-gray-400">Week {film.weeklyBoxOffice.length} in theaters</span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl text-white font-bold max-w-2xl leading-tight">
          {film.title}
        </h1>

        <div className="flex flex-wrap items-center gap-6 pt-2">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">This Week</p>
            <div className="flex items-center gap-2">
              <p className="font-display text-2xl text-white">{formatMoney(lastWeek)}</p>
              <span className={`text-sm flex items-center gap-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(change).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-white/20" />

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Gross</p>
            <p className="font-display text-3xl text-primary">{formatMoney(film.totalBoxOffice)}</p>
          </div>

          <div className="h-10 w-px bg-white/20" />

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-display text-xl text-white">{film.audienceScore.toFixed(1)}</span>
              </div>
              <p className="text-xs text-gray-400">Audience</p>
            </div>
            <div className="text-center">
              <span className="font-display text-xl text-white">{film.criticScore}%</span>
              <p className="text-xs text-gray-400">Critics</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={onExpand} className="gap-2" data-testid="button-view-details">
            <Play className="w-4 h-4" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExpandedFilmDetail({ film, studioName, onClose }: { film: FilmType; studioName: string; onClose: () => void }) {
  console.log('📽️ Film Details Loaded:', {
    title: film.title,
    totalBudget: film.totalBudget,
    productionBudget: film.productionBudget,
    marketingBudget: film.marketingBudget,
    talentBudget: film.talentBudget,
    setsBudget: film.setsBudget,
    costumesBudget: film.costumesBudget,
    stuntsBudget: film.stuntsBudget,
    makeupBudget: film.makeupBudget,
    practicalEffectsBudget: film.practicalEffectsBudget,
    soundCrewBudget: film.soundCrewBudget,
  });
  
  const budgetExcludingMarketing = (film.totalBudget || 0) - (film.marketingBudget || 0);
  const profit = film.totalBoxOffice * 0.5 - budgetExcludingMarketing;
  const isProfitable = profit > 0;
  
  // Fetch talent data for crew/cast display
  const { data: allTalent = [] } = useQuery<any[]>({
    queryKey: ['/api/talent'],
    queryFn: async () => {
      const response = await fetch('/api/talent');
      if (!response.ok) throw new Error('Failed to fetch talent');
      return response.json();
    },
  });
  
  // Fetch film roles to match actors to their character names
  const { data: filmRoles = [] } = useQuery<any[]>({
    queryKey: [`/api/films/${film.id}/roles`],
    queryFn: async () => {
      const response = await fetch(`/api/films/${film.id}/roles`);
      if (!response.ok) throw new Error('Failed to fetch roles');
      const roles = await response.json();
      
      const castIds = film.castIds || [];
      const rolesWithActors = roles.filter((r: any) => r.actorId);
      if (castIds.length > 0 && rolesWithActors.length < castIds.length) {
        await fetch(`/api/films/${film.id}/sync-roles`, { method: 'POST' });
        const refreshedResponse = await fetch(`/api/films/${film.id}/roles`);
        if (refreshedResponse.ok) {
          return refreshedResponse.json();
        }
      }
      
      return roles;
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Button 
          size="icon" 
          variant="ghost" 
          className="absolute top-4 right-4 z-10 rounded-full bg-black/50 hover:bg-black/70"
          onClick={onClose}
          data-testid="button-close-detail"
        >
          <X className="w-5 h-5 text-white" />
        </Button>

        <div className="relative h-48 bg-gradient-to-br from-primary/30 via-slate-900 to-black">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-4 left-6">
            <Badge variant="secondary" className={`${genreColors[film.genre as keyof typeof genreColors]}`}>
              {genreLabels[film.genre as keyof typeof genreLabels]}
            </Badge>
            <h2 className="font-display text-3xl text-white font-bold mt-2">{film.title}</h2>
            <p className="text-sm text-gray-300 mt-1">{studioName} | Week {film.weeklyBoxOffice.length}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Card className="bg-muted/20 border-muted/50 md:col-span-2">
            <CardContent className="p-4">
              <RatingDisplay 
                criticScore={film.criticScore || 0} 
                audienceScore={film.audienceScore || 0}
                voteCount={1000}
                openingWeekend={film.weeklyBoxOffice[0] || 0}
                size="sm"
              />
            </CardContent>
          </Card>

          {/* Synopsis Section */}
          {film.synopsis && (
            <Card className="bg-muted/20 border-muted/50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Synopsis</p>
                <p className="text-sm leading-relaxed text-foreground">{film.synopsis}</p>
              </CardContent>
            </Card>
          )}

          {/* Crew & Cast Section (Rotten Tomatoes Style) */}
          {(film.directorId || film.writerId || film.castIds?.length) && (
            <Card className="bg-muted/30 border-muted/50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {film.directorId && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Director</p>
                      {(() => {
                        const director = allTalent.find(t => t.id === film.directorId);
                        return director ? (
                          <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                            {director.imageUrl ? (
                              <img 
                                src={director.imageUrl} 
                                alt={director.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-white">{director.name}</p>
                            </div>
                            {director.fame && (
                              <span className="text-xs text-yellow-400 flex items-center gap-1 flex-shrink-0">
                                <Star className="w-3 h-3 fill-yellow-400" />
                                {director.fame}
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                  
                  {film.writerId && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Writer</p>
                      {(() => {
                        const writer = allTalent.find(t => t.id === film.writerId);
                        return writer ? (
                          <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                            {writer.imageUrl ? (
                              <img 
                                src={writer.imageUrl} 
                                alt={writer.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-white">{writer.name}</p>
                            </div>
                            {writer.fame && (
                              <span className="text-xs text-yellow-400 flex items-center gap-1 flex-shrink-0">
                                <Star className="w-3 h-3 fill-yellow-400" />
                                {writer.fame}
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                  
                  {film.castIds && film.castIds.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cast</p>
                      <div className="grid grid-cols-1 gap-3">
                        {(() => {
                          // Debug: Log castIds and talent data
                          console.log(`[FRONTEND] Film "${film.title}" castIds:`, film.castIds);
                          console.log(`[FRONTEND] All talent count:`, allTalent.length);
                          console.log(`[FRONTEND] Film roles:`, filmRoles);
                          
                          const importanceOrder = { 'lead': 0, 'supporting': 1, 'minor': 2, 'cameo': 3 };
                          const uniqueCastIds = Array.from(new Set(film.castIds));
                          const sortedCastIds = uniqueCastIds.sort((a, b) => {
                            const rolesA = filmRoles.filter(r => r.actorId === a);
                            const rolesB = filmRoles.filter(r => r.actorId === b);
                            const orderA = rolesA.length > 0 ? Math.min(...rolesA.map(r => importanceOrder[r.importance as keyof typeof importanceOrder] ?? 999)) : 999;
                            const orderB = rolesB.length > 0 ? Math.min(...rolesB.map(r => importanceOrder[r.importance as keyof typeof importanceOrder] ?? 999)) : 999;
                            
                            if (orderA !== orderB) return orderA - orderB;
                            
                            const actorA = allTalent.find(t => t.id === a)?.name || '';
                            const actorB = allTalent.find(t => t.id === b)?.name || '';
                            return actorA.localeCompare(actorB);
                          });
                          
                          return sortedCastIds.map((castId, index) => {
                            const actor = allTalent.find(t => t.id === castId);
                            const roles = filmRoles.filter(r => r.actorId === castId);
                            
                            // Debug: Log actor lookup
                            console.log(`[FRONTEND] Looking for actor with ID ${castId}:`, actor);
                            
                            return actor ? (
                              <div key={`cast-${castId}-${index}`} className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                                {/* Actor Profile Picture */}
                                {actor.imageUrl ? (
                                  <img 
                                    src={actor.imageUrl} 
                                    alt={actor.name}
                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-6 h-6 text-white" />
                                  </div>
                                )}
                                
                                {/* Actor Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-white truncate">{actor.name}</p>
                                  {roles.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {roles.map((role) => (
                                        <p key={role.id} className="text-xs text-gray-400">
                                          {role.roleName} {role.importance && <span className="text-gray-500">({role.importance.toUpperCase()})</span>}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400">Cast Member</p>
                                  )}
                                </div>
                                
                                {/* Fame Badge */}
                                {actor.fame && (
                                  <span className="text-xs text-yellow-400 flex items-center gap-1 flex-shrink-0">
                                    <Star className="w-3 h-3 fill-yellow-400" />
                                    {actor.fame}
                                  </span>
                                )}
                              </div>
                            ) : null;
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(() => {
            // Parse totalBoxOfficeByCountry - it may come as object or need parsing
            let totalByCountry: Record<string, number> | null = null;
            const rawCountryData = film.totalBoxOfficeByCountry;
            
            if (rawCountryData) {
              if (typeof rawCountryData === 'string') {
                try {
                  totalByCountry = JSON.parse(rawCountryData);
                } catch {
                  totalByCountry = null;
                }
              } else if (typeof rawCountryData === 'object') {
                totalByCountry = rawCountryData as Record<string, number>;
              }
            }
            
            // Parse weeklyBoxOfficeByCountry - it may come as array or need parsing
            let weeklyByCountry: Record<string, number>[] | null = null;
            if (film.weeklyBoxOfficeByCountry) {
              if (typeof film.weeklyBoxOfficeByCountry === 'string') {
                try {
                  weeklyByCountry = JSON.parse(film.weeklyBoxOfficeByCountry);
                } catch {
                  weeklyByCountry = null;
                }
              } else if (Array.isArray(film.weeklyBoxOfficeByCountry)) {
                weeklyByCountry = film.weeklyBoxOfficeByCountry as Record<string, number>[];
              }
            }
            
            const hasCountryData = totalByCountry && typeof totalByCountry === 'object' && Object.keys(totalByCountry).length > 0;
            const latestWeekly = weeklyByCountry && Array.isArray(weeklyByCountry) && weeklyByCountry.length > 0 
              ? weeklyByCountry[weeklyByCountry.length - 1] 
              : undefined;
            
            return hasCountryData ? (
              <BoxOfficeCountryBreakdown
                boxOfficeByCountry={totalByCountry!}
                totalBoxOffice={film.totalBoxOffice}
                weeklyBoxOfficeByCountry={latestWeekly}
                theaterCount={film.theaterCount}
              />
            ) : null;
          })()}
          <div className="grid grid-cols-2 md:col-span-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[0.65rem] whitespace-nowrap">Opening Weekend</span>
                </div>
                <p className="font-display text-2xl">{formatMoney(film.weeklyBoxOffice[0] || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[0.65rem] whitespace-nowrap">Total Box Office</span>
                </div>
                <p className="font-display text-2xl">{formatMoney(film.totalBoxOffice)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[0.65rem]">Legs</span>
                </div>
                <p className="font-display text-2xl">
                  {film.weeklyBoxOffice[0] > 0 ? ((film.totalBoxOffice / (film.weeklyBoxOffice[0] || 1)) * 1).toFixed(2) : '0'}x
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-[0.65rem]">Peak Theaters</span>
                </div>
                <p className="font-display text-2xl">{film.theaterCount.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          <Card className={`${isProfitable ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Profit / Loss</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Budget: {formatMoney((film.totalBudget || 0) - (film.marketingBudget || 0))} | Studio Share: 50%
                  </p>
                </div>
                <p className={`font-display text-2xl flex items-center gap-2 ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                  {isProfitable ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {isProfitable ? '+' : ''}{formatMoney(profit)}
                </p>
              </div>
            </CardContent>
          </Card>

          {film.awards && film.awards.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Award className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Awards:</span>
              {film.awards.map((award, i) => (
                <Badge key={i} variant="secondary" className="bg-primary/10 text-primary">
                  {String(award)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BoxOfficeDetail() {
  const { state } = useGame();
  const [expandedFilmId, setExpandedFilmId] = useState<string | null>(null);
  const [territoryFilter, setTerritoryFilter] = useState<string>('ALL');
  
  // In multiplayer, fetch films from the session endpoint to see all players' films
  const { data: sessionFilmsData } = useQuery<{ films: FilmType[]; studios: Studio[] }>({
    queryKey: ['/api/multiplayer/sessions', state.multiplayerSessionId, 'films'],
    queryFn: async () => {
      const res = await fetch(`/api/multiplayer/sessions/${state.multiplayerSessionId}/films`);
      return res.json();
    },
    enabled: state.isMultiplayer && !!state.multiplayerSessionId,
  });

  // Single player: use the regular endpoints
  const { data: singlePlayerFilms = [] } = useQuery<FilmType[]>({
    queryKey: ['/api/all-films', state.studioId],
    enabled: !state.isMultiplayer,
  });
  const { data: singlePlayerStudios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
    enabled: !state.isMultiplayer,
  });

  // Use multiplayer data if available, otherwise single player
  const allFilms = state.isMultiplayer ? (sessionFilmsData?.films || []) : singlePlayerFilms;
  const allStudios = state.isMultiplayer ? (sessionFilmsData?.studios || []) : singlePlayerStudios;

  const studioMap = new Map(allStudios.map(s => [s.id, s.name]));

  // Helper to get box office for a specific territory
  const getTerritoryBoxOffice = (film: FilmType, territory: string): number => {
    if (territory === 'ALL') {
      return film.totalBoxOffice;
    }
    const byCountry = film.totalBoxOfficeByCountry as Record<string, number> || {};
    // Map territory codes to full names as stored in database
    const territoryNameMap: Record<string, string> = {
      'NA': 'North America',
      'CN': 'China',
      'GB': 'UK & Ireland',
      'FR': 'France',
      'JP': 'Japan',
      'DE': 'Germany',
      'KR': 'South Korea',
      'MX': 'Mexico',
      'AU': 'Australia',
      'IN': 'India',
      'OTHER': 'Other Territories',
    };
    const territoryName = territoryNameMap[territory] || territory;
    return byCountry[territoryName] || 0;
  };

  // Helper to get this week's territory earnings
  const getTerritoryWeeklyEarnings = (film: FilmType, territory: string): number => {
    if (territory === 'ALL') {
      return film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0;
    }
    // weeklyBoxOfficeByCountry is an array of objects, where each object is a week
    const weeklyByCountry = film.weeklyBoxOfficeByCountry as Array<Record<string, number>> || [];
    // Map territory codes to full names as stored in database
    const territoryNameMap: Record<string, string> = {
      'NA': 'North America',
      'CN': 'China',
      'GB': 'UK & Ireland',
      'FR': 'France',
      'JP': 'Japan',
      'DE': 'Germany',
      'KR': 'South Korea',
      'MX': 'Mexico',
      'AU': 'Australia',
      'IN': 'India',
      'OTHER': 'Other Territories',
    };
    const territoryName = territoryNameMap[territory] || territory;
    // Get the last week's data
    const thisWeekData = weeklyByCountry[weeklyByCountry.length - 1] || {};
    return thisWeekData[territoryName] || 0;
  };

  const releasedFilms = allFilms.filter(f => f.weeklyBoxOffice.length > 0);
  
  // Calculate weeks until release for a film
  const getWeeksUntilRelease = (film: FilmType): number => {
    const phaseOrder = ['development', 'pre-production', 'production', 'post-production'];
    const currentPhaseIndex = phaseOrder.indexOf(film.phase);
    
    let totalWeeks = 0;
    
    // Add remaining weeks in current phase
    const currentPhaseMaxWeeks = 
      film.phase === 'development' ? film.developmentDurationWeeks :
      film.phase === 'pre-production' ? film.preProductionDurationWeeks :
      film.phase === 'production' ? film.productionDurationWeeks :
      film.phase === 'post-production' ? film.postProductionDurationWeeks : 0;
    
    if (currentPhaseMaxWeeks > 0) {
      totalWeeks += Math.max(0, currentPhaseMaxWeeks - (film.weeksInCurrentPhase || 0));
    }
    
    // Add remaining phases
    for (let i = currentPhaseIndex + 1; i < phaseOrder.length; i++) {
      const phase = phaseOrder[i];
      totalWeeks += 
        phase === 'development' ? (film.developmentDurationWeeks || 0) :
        phase === 'pre-production' ? (film.preProductionDurationWeeks || 0) :
        phase === 'production' ? (film.productionDurationWeeks || 0) :
        phase === 'post-production' ? (film.postProductionDurationWeeks || 0) : 0;
    }
    
    return totalWeeks;
  };
  
  const upcomingFilms = [...allFilms]
    .filter(f => f.weeklyBoxOffice.length === 0 && f.phase !== 'released')
    .sort((a, b) => getWeeksUntilRelease(a) - getWeeksUntilRelease(b));
  
  // Films must make at least $1,000/week to be considered "in theaters"
  // Films making less than this have essentially ended their theatrical run
  const MIN_THEATER_THRESHOLD = 1000;
  
  // Filter to only films still making meaningful money and exclude archived films
  const activeReleasedFilms = releasedFilms.filter(f => {
    const lastWeek = f.weeklyBoxOffice[f.weeklyBoxOffice.length - 1] || 0;
    const isArchived = f.status === 'archived';
    return lastWeek >= MIN_THEATER_THRESHOLD && !isArchived;
  });
  
  // Helper to sort currently in theaters by territory's this week earnings
  const sortCurrentlyInTheaters = (films: FilmType[]): FilmType[] => {
    return [...films].sort((a, b) => {
      const aWeekly = getTerritoryWeeklyEarnings(a, territoryFilter);
      const bWeekly = getTerritoryWeeklyEarnings(b, territoryFilter);
      return bWeekly - aWeekly; // Sort by selected territory's this week earnings
    });
  };

  // Helper to sort by total box office in territory (descending)
  const sortByTerritoryTotal = (films: FilmType[]): FilmType[] => {
    return [...films].sort((a, b) => {
      const aTerritoryBoxOffice = getTerritoryBoxOffice(a, territoryFilter);
      const bTerritoryBoxOffice = getTerritoryBoxOffice(b, territoryFilter);
      return bTerritoryBoxOffice - aTerritoryBoxOffice; // Highest to lowest
    });
  };

  const currentlyInTheaters = sortCurrentlyInTheaters(activeReleasedFilms);

  const yourFilms = sortByTerritoryTotal(
    releasedFilms.filter(f => f.studioId === state.studioId)
  );

  // Filter and sort by territory box office for all-time list (extended to 100)
  const allTimeTopFilms = [...releasedFilms]
    .filter(f => territoryFilter === 'ALL' || getTerritoryBoxOffice(f, territoryFilter) > 0)
    .sort((a, b) => getTerritoryBoxOffice(b, territoryFilter) - getTerritoryBoxOffice(a, territoryFilter))
    .slice(0, 100);

  const topFilm = currentlyInTheaters[0] || (releasedFilms.length > 0 ? 
    [...releasedFilms].sort((a, b) => b.totalBoxOffice - a.totalBoxOffice)[0] : null);
  const expandedFilm = allFilms.find(f => f.id === expandedFilmId);

  return (
    <div className="space-y-8 pb-8">
      {/* Territory Filter at the Top */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-white">Box Office</h1>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-territory-filter">
              <SelectValue placeholder="Select territory" />
            </SelectTrigger>
            <SelectContent>
              {TERRITORIES.map((territory) => (
                <SelectItem key={territory.code} value={territory.code}>
                  {territory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {topFilm && (
        <HeroBanner
          film={topFilm}
          studioName={studioMap.get(topFilm.studioId) || 'Unknown'}
          isYours={topFilm.studioId === state.studioId}
          onExpand={() => setExpandedFilmId(topFilm.id)}
        />
      )}

      {!topFilm && (
        <div className="relative h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
          <div className="text-center space-y-2">
            <Film className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No films currently in theaters</p>
          </div>
        </div>
      )}

      {yourFilms.length > 0 && (
        <HorizontalCarousel title="Your Films" count={yourFilms.length}>
          {yourFilms.map((film, index) => (
            <FilmCard
              key={film.id}
              film={film}
              isYours={true}
              studioName={studioMap.get(film.studioId) || 'Unknown'}
              isExpanded={expandedFilmId === film.id}
              onToggle={() => setExpandedFilmId(expandedFilmId === film.id ? null : film.id)}
              territoryFilter={territoryFilter}
              getTerritoryBoxOffice={getTerritoryBoxOffice}
              getTerritoryWeeklyEarnings={getTerritoryWeeklyEarnings}
            />
          ))}
        </HorizontalCarousel>
      )}

      {currentlyInTheaters.length > 0 && (
        <HorizontalCarousel title="Currently in Theaters" count={currentlyInTheaters.length}>
          {currentlyInTheaters.map((film, index) => (
            <FilmCard
              key={film.id}
              film={film}
              rank={index + 1}
              isYours={film.studioId === state.studioId}
              studioName={studioMap.get(film.studioId) || 'Unknown'}
              isExpanded={expandedFilmId === film.id}
              onToggle={() => setExpandedFilmId(expandedFilmId === film.id ? null : film.id)}
              territoryFilter={territoryFilter}
              getTerritoryBoxOffice={getTerritoryBoxOffice}
              getTerritoryWeeklyEarnings={getTerritoryWeeklyEarnings}
            />
          ))}
        </HorizontalCarousel>
      )}

      {upcomingFilms.length > 0 && (
        <HorizontalCarousel title="Coming Soon" count={upcomingFilms.length}>
          {upcomingFilms.map((film) => (
            <UpcomingFilmCard
              key={film.id}
              film={film}
              isYours={film.studioId === state.studioId}
              studioName={studioMap.get(film.studioId) || 'Unknown'}
            />
          ))}
        </HorizontalCarousel>
      )}

      {allTimeTopFilms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl text-white">All-Time Hits</h2>
            <Badge variant="outline" className="text-xs">{allTimeTopFilms.length} films</Badge>
          </div>
          <HorizontalCarousel title="" count={0}>
            {allTimeTopFilms.map((film, index) => (
              <FilmCard
                key={film.id}
                film={film}
                rank={index + 1}
                isYours={film.studioId === state.studioId}
                studioName={studioMap.get(film.studioId) || 'Unknown'}
                showWeeklyChange={false}
                isExpanded={expandedFilmId === film.id}
                onToggle={() => setExpandedFilmId(expandedFilmId === film.id ? null : film.id)}
                territoryFilter={territoryFilter}
                getTerritoryBoxOffice={getTerritoryBoxOffice}
                getTerritoryWeeklyEarnings={getTerritoryWeeklyEarnings}
              />
            ))}
          </HorizontalCarousel>
        </div>
      )}

      {expandedFilm && (
        <ExpandedFilmDetail
          film={expandedFilm}
          studioName={studioMap.get(expandedFilm.studioId) || 'Unknown'}
          onClose={() => setExpandedFilmId(null)}
        />
      )}
    </div>
  );
}
