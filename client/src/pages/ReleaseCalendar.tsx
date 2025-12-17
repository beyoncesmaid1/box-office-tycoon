import { useQuery } from '@tanstack/react-query';
import { useGame } from '@/lib/gameState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Studio, Film } from '@shared/schema';
import { HOLIDAYS, HOLIDAY_GENRE_MODIFIERS, MONTH_NAMES, getSeasonIcon, getMonthFromWeek } from '@shared/holidays';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FilmWithStudio extends Film {
  studioName: string;
  isPlayerStudio: boolean;
}

export default function ReleaseCalendar() {
  const { state } = useGame();
  const currentMonth = getMonthFromWeek(state.currentWeek);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(state.currentYear);

  const { data: studios = [], isLoading: studiosLoading } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
    enabled: !!state.studioId,
  });

  const { data: allFilms = [], isLoading: filmsLoading } = useQuery<Film[]>({
    queryKey: ['/api/all-films', state.studioId],
    enabled: !!state.studioId,
  });

  if (studiosLoading || filmsLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const filmsWithStudio: FilmWithStudio[] = allFilms.map(film => {
    const studio = studios.find(s => s.id === film.studioId);
    return {
      ...film,
      studioName: studio?.name || 'Unknown Studio',
      isPlayerStudio: film.studioId === state.studioId,
    };
  });

  const getWeeksForMonth = (month: number): number[] => {
    const weekRanges: Record<number, [number, number]> = {
      1: [1, 4],
      2: [5, 8],
      3: [9, 13],
      4: [14, 17],
      5: [18, 22],
      6: [23, 26],
      7: [27, 30],
      8: [31, 35],
      9: [36, 39],
      10: [40, 43],
      11: [44, 47],
      12: [48, 52],
    };
    const [start, end] = weekRanges[month] || [1, 4];
    const weeks: number[] = [];
    for (let w = start; w <= end; w++) {
      weeks.push(w);
    }
    return weeks;
  };

  const weeks = getWeeksForMonth(viewMonth);
  const seasonInfo = getSeasonIcon(viewMonth);

  const getFilmsForWeek = (week: number, year: number): FilmWithStudio[] => {
    return filmsWithStudio.filter(film => {
      const filmYear = (film as any).releaseYear || state.currentYear;
      return film.releaseWeek === week && filmYear === year;
    });
  };

  const getHolidayForWeek = (week: number): typeof HOLIDAYS[0] | undefined => {
    return HOLIDAYS.find(h => h.week === week);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMonth === 1) {
        setViewMonth(12);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    } else {
      if (viewMonth === 12) {
        setViewMonth(1);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    }
  };

  const isCurrentWeek = (week: number, year: number) => {
    return week === state.currentWeek && year === state.currentYear;
  };

  const formatModifier = (modifier: number) => {
    if (modifier > 1) {
      return `+${Math.round((modifier - 1) * 100)}%`;
    } else if (modifier < 1) {
      return `-${Math.round((1 - modifier) * 100)}%`;
    }
    return '';
  };

  const genreLabels: Record<string, string> = {
    action: 'Action', comedy: 'Comedy', drama: 'Drama', horror: 'Horror',
    scifi: 'Sci-Fi', romance: 'Romance', thriller: 'Thriller',
    animation: 'Animation', fantasy: 'Fantasy', musicals: 'Musicals',
  };

  const getGenreEffects = (holidayName: string) => {
    const genreModifiers = HOLIDAY_GENRE_MODIFIERS[holidayName];
    if (!genreModifiers) return null;
    
    const boosts = Object.entries(genreModifiers)
      .filter(([_, mod]) => mod > 1)
      .sort(([_, a], [__, b]) => b - a);
    
    const penalties = Object.entries(genreModifiers)
      .filter(([_, mod]) => mod < 1)
      .sort(([_, a], [__, b]) => a - b);
    
    return { boosts, penalties };
  };

  return (
    <div className="h-full bg-gradient-to-b from-background to-muted/20 overflow-hidden flex flex-col p-4">
      <div className="flex items-center justify-between flex-shrink-0 bg-card rounded-xl shadow-md p-4 border mb-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigateMonth('prev')}
          className="hover:bg-primary/10"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
        
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold flex items-center gap-3 justify-center">
            <span className="text-2xl">{seasonInfo.icon}</span>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {seasonInfo.name} Season
          </p>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigateMonth('next')}
          className="hover:bg-primary/10"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-4 gap-4">
        {weeks.slice(0, 4).map((week, index) => {
          const films = getFilmsForWeek(week, viewYear);
          const holiday = getHolidayForWeek(week);
          const isCurrent = isCurrentWeek(week, viewYear);

          return (
            <Card 
              key={week} 
              className={`flex flex-col transition-all ${
                isCurrent ? 'border-2 border-primary shadow-lg bg-primary/5' : 'hover:shadow-md'
              }`}
            >
              <div className={`text-center py-3 border-b flex-shrink-0 ${isCurrent ? 'bg-primary/10' : 'bg-muted/30'}`}>
                <h2 className={`text-lg font-bold ${isCurrent ? 'text-primary underline decoration-2' : ''}`}>
                  Week {index + 1}
                </h2>
                <p className="text-xs text-muted-foreground">Week {week}</p>
              </div>

              <CardContent className="flex-1 p-3 flex flex-col overflow-hidden">
                <div className="flex-1 space-y-2">
                  {films.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 italic">
                      No releases
                    </p>
                  ) : (
                    films.map(film => (
                      <div 
                        key={film.id} 
                        className={`p-2 rounded-lg text-sm ${
                          film.isPlayerStudio 
                            ? 'bg-primary/20 border border-primary' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-1">
                          {film.isPlayerStudio && (
                            <span className="text-yellow-500 text-xs">★</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{film.studioName}</p>
                            <p className="text-muted-foreground">releases {film.title}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {holiday && (
                  <div className="mt-auto pt-3 border-t">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 cursor-help">
                            <span className="text-2xl">{holiday.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{holiday.name}</p>
                              <Badge 
                                variant={holiday.boxOfficeModifier > 1 ? 'default' : 'destructive'}
                                className="text-xs mt-1"
                              >
                                {formatModifier(holiday.boxOfficeModifier)} Base
                              </Badge>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <p className="font-bold mb-2">{holiday.name} Genre Effects</p>
                          {(() => {
                            const effects = getGenreEffects(holiday.name);
                            if (!effects) return <p className="text-xs text-muted-foreground">No genre-specific effects</p>;
                            return (
                              <div className="space-y-2 text-xs">
                                {effects.boosts.length > 0 && (
                                  <div>
                                    <p className="text-green-500 font-medium mb-1">Boosted:</p>
                                    {effects.boosts.map(([genre, mod]) => (
                                      <span key={genre} className="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-green-500/20 rounded text-green-600">
                                        {genreLabels[genre]} +{Math.round((mod - 1) * 100)}%
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {effects.penalties.length > 0 && (
                                  <div>
                                    <p className="text-red-500 font-medium mb-1">Hurt:</p>
                                    {effects.penalties.map(([genre, mod]) => (
                                      <span key={genre} className="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-red-500/20 rounded text-red-600">
                                        {genreLabels[genre]} -{Math.round((1 - mod) * 100)}%
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {weeks.length > 4 && (
        <div className="flex-1 overflow-hidden grid grid-cols-4 gap-4">
          {weeks.slice(4).map((week, index) => {
            const films = getFilmsForWeek(week, viewYear);
            const holiday = getHolidayForWeek(week);
            const isCurrent = isCurrentWeek(week, viewYear);

            return (
              <Card 
                key={week} 
                className={`flex flex-col transition-all ${
                  isCurrent ? 'border-2 border-primary shadow-lg bg-primary/5' : 'hover:shadow-md'
                }`}
              >
                <div className={`text-center py-3 border-b flex-shrink-0 ${isCurrent ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <h2 className={`text-lg font-bold ${isCurrent ? 'text-primary underline decoration-2' : ''}`}>
                    Week {index + 5}
                  </h2>
                  <p className="text-xs text-muted-foreground">Week {week}</p>
                </div>

                <CardContent className="flex-1 p-3 flex flex-col overflow-hidden">
                  <div className="flex-1 space-y-2">
                    {films.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 italic">
                        No releases
                      </p>
                    ) : (
                      films.map(film => (
                        <div 
                          key={film.id} 
                          className={`p-2 rounded-lg text-sm ${
                            film.isPlayerStudio 
                              ? 'bg-primary/20 border border-primary' 
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-1">
                            {film.isPlayerStudio && (
                              <span className="text-yellow-500 text-xs">★</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{film.studioName}</p>
                              <p className="text-muted-foreground">releases {film.title}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {holiday && (
                    <div className="mt-auto pt-3 border-t">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 cursor-help">
                              <span className="text-2xl">{holiday.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{holiday.name}</p>
                                <Badge 
                                  variant={holiday.boxOfficeModifier > 1 ? 'default' : 'destructive'}
                                  className="text-xs mt-1"
                                >
                                  {formatModifier(holiday.boxOfficeModifier)}
                                </Badge>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs p-3">
                            <p className="font-bold mb-2">{holiday.name} Genre Effects</p>
                            {(() => {
                              const effects = getGenreEffects(holiday.name);
                              if (!effects) return <p className="text-xs text-muted-foreground">No genre-specific effects</p>;
                              return (
                                <div className="space-y-2 text-xs">
                                  {effects.boosts.length > 0 && (
                                    <div>
                                      <p className="text-green-500 font-medium mb-1">Boosted:</p>
                                      {effects.boosts.map(([genre, mod]) => (
                                        <span key={genre} className="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-green-500/20 rounded text-green-600">
                                          {genreLabels[genre]} +{Math.round((mod - 1) * 100)}%
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {effects.penalties.length > 0 && (
                                    <div>
                                      <p className="text-red-500 font-medium mb-1">Hurt:</p>
                                      {effects.penalties.map(([genre, mod]) => (
                                        <span key={genre} className="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-red-500/20 rounded text-red-600">
                                          {genreLabels[genre]} -{Math.round((1 - mod) * 100)}%
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
