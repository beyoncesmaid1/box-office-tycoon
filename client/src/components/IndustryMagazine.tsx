import { Newspaper, Trophy, Film, Tv, TrendingUp, Star, Award, Clapperboard, TrendingDown, XCircle, Mic, AlertTriangle, Plane } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Film as FilmType, Studio, TVShow, Talent, AwardShow, AwardNomination, AwardCeremony } from '@shared/schema';

type StoryType = 'box-office' | 'director-signs' | 'tv-pickup' | 'record-break' | 'award-win' | 'award-nomination' | 'tv-renewal' | 'talent-cast' | 'tv-cancelled' | 'talent-interview' | 'talent-scandal' | 'box-office-flop' | 'premiere-tour';

interface NewsStory {
  id: string;
  type: StoryType;
  headline: string;
  content: string;
  priority: number;
  imageUrl?: string;
  week: number;
  year: number;
}

function formatCompactMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function StoryIcon({ type }: { type: StoryType }) {
  switch (type) {
    case 'box-office':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'director-signs':
      return <Clapperboard className="w-4 h-4 text-blue-500" />;
    case 'tv-pickup':
      return <Tv className="w-4 h-4 text-purple-500" />;
    case 'record-break':
      return <Trophy className="w-4 h-4 text-amber-500" />;
    case 'award-win':
      return <Award className="w-4 h-4 text-yellow-500" />;
    case 'award-nomination':
      return <Trophy className="w-4 h-4 text-amber-400" />;
    case 'tv-renewal':
      return <Tv className="w-4 h-4 text-emerald-500" />;
    case 'talent-cast':
      return <Star className="w-4 h-4 text-pink-500" />;
    case 'tv-cancelled':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'talent-interview':
      return <Mic className="w-4 h-4 text-indigo-500" />;
    case 'talent-scandal':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'box-office-flop':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    case 'premiere-tour':
      return <Plane className="w-4 h-4 text-sky-500" />;
    default:
      return <Film className="w-4 h-4 text-gray-500" />;
  }
}

export function IndustryMagazine() {
  const { state } = useGame();
  
  const { data: allFilms = [] } = useQuery<FilmType[]>({
    queryKey: ['/api/all-films', state.studioId],
  });
  
  const { data: allStudios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
  });
  
  const { data: allTalent = [] } = useQuery<Talent[]>({
    queryKey: ['/api/talent'],
  });
  
  const { data: tvShows = [] } = useQuery<TVShow[]>({
    queryKey: ['/api/tv-shows', state.studioId],
  });
  
  const { data: awardShows = [] } = useQuery<AwardShow[]>({
    queryKey: ['/api/award-shows'],
  });
  
  const { data: nominations = [] } = useQuery<AwardNomination[]>({
    queryKey: ['/api/nominations', state.studioId],
    enabled: !!state.studioId,
  });
  
  const { data: ceremonies = [] } = useQuery<AwardCeremony[]>({
    queryKey: ['/api/ceremonies', state.studioId],
    enabled: !!state.studioId,
  });

  const studioMap = useMemo(() => new Map(allStudios.map(s => [s.id, s])), [allStudios]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);
  const filmMap = useMemo(() => new Map(allFilms.map(f => [f.id, f])), [allFilms]);
  const awardShowMap = useMemo(() => new Map(awardShows.map(s => [s.id, s])), [awardShows]);
  
  const allStories = useMemo(() => {
    const stories: NewsStory[] = [];
    const currentWeek = state.currentWeek;
    const currentYear = state.currentYear;
    
    const territories = ['London', 'Paris', 'Tokyo', 'Berlin', 'Sydney', 'Toronto', 'Mexico City', 'Seoul', 'Rome', 'Madrid'];
    
    for (let weeksAgo = 0; weeksAgo < 12; weeksAgo++) {
      let storyWeek = currentWeek - weeksAgo;
      let storyYear = currentYear;
      while (storyWeek <= 0) {
        storyWeek += 52;
        storyYear -= 1;
      }
      
      const weekSeed = storyWeek * 1000 + storyYear;
      
      const releasedFilms = allFilms
        .filter(f => f.phase === 'released' && f.weeklyBoxOffice && f.weeklyBoxOffice.length > weeksAgo)
        .map(f => {
          const weekIndex = f.weeklyBoxOffice.length - 1 - weeksAgo;
          return {
            ...f,
            studio: studioMap.get(f.studioId),
            director: f.directorId ? talentMap.get(f.directorId) : null,
            weekGross: weekIndex >= 0 ? (f.weeklyBoxOffice[weekIndex] || 0) : 0,
          };
        })
        .filter(f => f.weekGross > 0)
        .sort((a, b) => b.weekGross - a.weekGross);
      
      if (releasedFilms.length >= 1 && weeksAgo === 0) {
        const topFilm = releasedFilms[0];
        const studioName = topFilm.studio?.name || 'Unknown Studio';
        const directorName = topFilm.director?.name || 'an acclaimed director';
        const genreLabel = genreLabels[topFilm.genre as keyof typeof genreLabels] || topFilm.genre;
        
        let content = `${studioName}'s "${topFilm.title}" grabs Box Office Spot No. 1, making ${formatCompactMoney(topFilm.weekGross)} just this week. The ${genreLabel} from director ${directorName}`;
        
        if (releasedFilms.length >= 2) {
          content += ` beat "${releasedFilms[1].title}" (#2)`;
        }
        if (releasedFilms.length >= 3) {
          content += ` and "${releasedFilms[2].title}" (#3)`;
        }
        content += ' to the top spot.';
        
        stories.push({
          id: `top-box-office-w${storyWeek}-y${storyYear}`,
          type: 'box-office',
          headline: `"${topFilm.title}" at #1 this week.`,
          content,
          priority: 100,
          imageUrl: topFilm.posterUrl || undefined,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const inProductionFilms = allFilms.filter(f => 
        (f.phase === 'production' || f.phase === 'pre-production') && 
        f.directorId
      );
      
      const filmForDirectorStory = inProductionFilms[Math.floor(seededRandom(weekSeed + 1) * inProductionFilms.length)];
      if (filmForDirectorStory && weeksAgo <= 4) {
        const director = filmForDirectorStory.directorId ? talentMap.get(filmForDirectorStory.directorId) : null;
        const studio = studioMap.get(filmForDirectorStory.studioId);
        if (director && studio) {
          stories.push({
            id: `director-w${storyWeek}-y${storyYear}-${filmForDirectorStory.id}`,
            type: 'director-signs',
            headline: `${director.name} to Direct "${filmForDirectorStory.title}"`,
            content: `${studio.name} has tapped ${director.name} to helm their upcoming ${genreLabels[filmForDirectorStory.genre as keyof typeof genreLabels] || filmForDirectorStory.genre} project "${filmForDirectorStory.title}". Production is currently underway.`,
            priority: 50 - weeksAgo * 5,
            week: storyWeek,
            year: storyYear,
          });
        }
      }
      
      const airingShows = tvShows.filter(s => s.phase === 'airing' && s.streamingServiceId);
      const showForPickup = airingShows[Math.floor(seededRandom(weekSeed + 2) * airingShows.length)];
      if (showForPickup && weeksAgo <= 6) {
        const studio = studioMap.get(showForPickup.studioId);
        stories.push({
          id: `tv-pickup-w${storyWeek}-y${storyYear}-${showForPickup.id}`,
          type: 'tv-pickup',
          headline: `"${showForPickup.title}" Streaming Now`,
          content: `${studio?.name || 'A major studio'}'s ${showForPickup.genre} series "${showForPickup.title}" is now streaming. The show has been generating buzz among subscribers.`,
          priority: 40 - weeksAgo * 3,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const cancelledShows = tvShows.filter(s => s.renewalStatus === 'cancelled' || s.isCancelled);
      const showForCancel = cancelledShows[Math.floor(seededRandom(weekSeed + 3) * cancelledShows.length)];
      if (showForCancel && weeksAgo <= 3) {
        const studio = studioMap.get(showForCancel.studioId);
        stories.push({
          id: `cancelled-w${storyWeek}-y${storyYear}-${showForCancel.id}`,
          type: 'tv-cancelled',
          headline: `"${showForCancel.title}" Cancelled After ${showForCancel.currentSeason || 1} Season${(showForCancel.currentSeason || 1) > 1 ? 's' : ''}`,
          content: `Disappointing news for fans: ${studio?.name || 'The studio'} has pulled the plug on "${showForCancel.title}". The ${showForCancel.genre} series will not be returning for another season.`,
          priority: 85 - weeksAgo * 10,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const underperformingFilms = releasedFilms.filter(f => {
        const roi = f.totalBudget > 0 ? f.totalBoxOffice / f.totalBudget : 0;
        return roi < 0.6;
      });
      const flopFilm = underperformingFilms[Math.floor(seededRandom(weekSeed + 4) * underperformingFilms.length)];
      if (flopFilm && weeksAgo <= 4) {
        stories.push({
          id: `flop-w${storyWeek}-y${storyYear}-${flopFilm.id}`,
          type: 'box-office-flop',
          headline: `"${flopFilm.title}" Struggles at Box Office`,
          content: `${flopFilm.studio?.name || 'Unknown Studio'}'s "${flopFilm.title}" is facing an uphill battle, earning just ${formatCompactMoney(flopFilm.totalBoxOffice)} against a ${formatCompactMoney(flopFilm.totalBudget)} budget.`,
          priority: 75 - weeksAgo * 8,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const upcomingFilms = allFilms.filter(f => 
        (f.phase === 'production-complete' || f.phase === 'awaiting-release' || f.phase === 'post-production') &&
        f.castIds && f.castIds.length > 0
      );
      const filmForInterview = upcomingFilms[Math.floor(seededRandom(weekSeed + 5) * upcomingFilms.length)];
      if (filmForInterview && weeksAgo <= 8) {
        const castMember = filmForInterview.castIds[0] ? talentMap.get(filmForInterview.castIds[0]) : null;
        const studio = studioMap.get(filmForInterview.studioId);
        const territory = territories[Math.floor(seededRandom(weekSeed + 6) * territories.length)];
        if (castMember) {
          stories.push({
            id: `interview-w${storyWeek}-y${storyYear}-${filmForInterview.id}`,
            type: 'talent-interview',
            headline: `${castMember.name} Talks "${filmForInterview.title}" in ${territory}`,
            content: `${castMember.name} sat down for an exclusive interview ahead of "${filmForInterview.title}"'s release. The ${castMember.type} discussed working with ${studio?.name || 'the studio'} on this ${genreLabels[filmForInterview.genre as keyof typeof genreLabels] || filmForInterview.genre} project.`,
            priority: 45 - weeksAgo * 3,
            week: storyWeek,
            year: storyYear,
          });
        }
      }
      
      const filmForPremiere = upcomingFilms[Math.floor(seededRandom(weekSeed + 7) * upcomingFilms.length)];
      if (filmForPremiere && filmForPremiere !== filmForInterview && weeksAgo <= 6) {
        const director = filmForPremiere.directorId ? talentMap.get(filmForPremiere.directorId) : null;
        const territory = territories[Math.floor(seededRandom(weekSeed + 8) * territories.length)];
        if (director) {
          stories.push({
            id: `premiere-w${storyWeek}-y${storyYear}-${filmForPremiere.id}`,
            type: 'premiere-tour',
            headline: `"${filmForPremiere.title}" Premiere Tour Hits ${territory}`,
            content: `Director ${director.name} and cast attended the ${territory} premiere of "${filmForPremiere.title}" to enthusiastic crowds. The film is generating strong early buzz.`,
            priority: 42 - weeksAgo * 3,
            week: storyWeek,
            year: storyYear,
          });
        }
      }
      
      for (const show of awardShows) {
        if (storyWeek === show.nominationsWeek) {
          const ceremonyYear = show.ceremonyWeek < show.nominationsWeek ? storyYear + 1 : storyYear;
          const showNominations = nominations.filter(n => 
            n.awardShowId === show.id && n.ceremonyYear === ceremonyYear
          );
          
          if (showNominations.length > 0) {
            const nominationsByFilm = new Map<string, number>();
            for (const nom of showNominations) {
              nominationsByFilm.set(nom.filmId, (nominationsByFilm.get(nom.filmId) || 0) + 1);
            }
            
            let topFilmId = '';
            let topCount = 0;
            nominationsByFilm.forEach((count, filmId) => {
              if (count > topCount) {
                topCount = count;
                topFilmId = filmId;
              }
            });
            
            const topFilm = filmMap.get(topFilmId);
            if (topFilm) {
              const studio = studioMap.get(topFilm.studioId);
              stories.push({
                id: `nominations-w${storyWeek}-y${storyYear}-${show.id}`,
                type: 'award-nomination',
                headline: `"${topFilm.title}" Leads ${show.name} Nominations with ${topCount}`,
                content: `${studio?.name || 'A studio'}'s "${topFilm.title}" leads the ${show.shortName || show.name} nomination ceremony with ${topCount} nomination${topCount > 1 ? 's' : ''}. The ceremony is scheduled for Week ${show.ceremonyWeek}.`,
                priority: 90 - weeksAgo * 5,
                week: storyWeek,
                year: storyYear,
              });
            }
          }
        }
        
        if (storyWeek === show.ceremonyWeek) {
          const ceremonyYear = storyYear;
          const showNominations = nominations.filter(n => 
            n.awardShowId === show.id && n.ceremonyYear === ceremonyYear && n.isWinner
          );
          
          if (showNominations.length > 0) {
            const winsByFilm = new Map<string, AwardNomination[]>();
            for (const nom of showNominations) {
              const existing = winsByFilm.get(nom.filmId) || [];
              existing.push(nom);
              winsByFilm.set(nom.filmId, existing);
            }
            
            let topFilmId = '';
            let topWins: AwardNomination[] = [];
            winsByFilm.forEach((wins, filmId) => {
              if (wins.length > topWins.length) {
                topWins = wins;
                topFilmId = filmId;
              }
            });
            
            const topFilm = filmMap.get(topFilmId);
            if (topFilm && topWins.length > 0) {
              const studio = studioMap.get(topFilm.studioId);
              const winCount = topWins.length;
              
              const topCategories = topWins.slice(0, 3).map(w => w.categoryId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
              const categoryList = topCategories.join(', ');
              
              stories.push({
                id: `wins-w${storyWeek}-y${storyYear}-${show.id}`,
                type: 'award-win',
                headline: `"${topFilm.title}" Sweeps at the ${show.name}, Taking Home ${winCount} Award${winCount > 1 ? 's' : ''}`,
                content: `${studio?.name || 'A studio'}'s "${topFilm.title}" dominated the ${show.shortName || show.name} ceremony, winning ${winCount} award${winCount > 1 ? 's' : ''} including ${categoryList}.`,
                priority: 95 - weeksAgo * 5,
                week: storyWeek,
                year: storyYear,
              });
            }
          }
        }
      }
      
      const popularTalent = allTalent.filter(t => (t.popularity || 0) > 70 && t.type !== 'composer');
      if (seededRandom(weekSeed + 11) < 0.08 && popularTalent.length > 0) {
        const scandalIndex = Math.floor(seededRandom(weekSeed + 12) * popularTalent.length);
        const scandalTalent = popularTalent[scandalIndex];
        const scandalTypes = [
          { headline: `${scandalTalent.name} Faces Backlash Over Controversial Comments`, content: `${scandalTalent.name} is under fire after controversial statements made during a recent interview. Several projects may be reconsidered as studios assess the situation.` },
          { headline: `${scandalTalent.name} Steps Back Amid Personal Controversy`, content: `Sources close to ${scandalTalent.name} confirm the ${scandalTalent.type} is taking time away from the spotlight following recent personal revelations.` },
          { headline: `Industry Reacts to ${scandalTalent.name} Allegations`, content: `The entertainment world is buzzing after allegations surfaced against ${scandalTalent.name}. Representatives have yet to comment on the situation.` },
        ];
        const scandalType = scandalTypes[Math.floor(seededRandom(weekSeed + 13) * scandalTypes.length)];
        stories.push({
          id: `scandal-w${storyWeek}-y${storyYear}-${scandalTalent.id}`,
          type: 'talent-scandal',
          headline: scandalType.headline,
          content: scandalType.content,
          priority: 95 - weeksAgo * 8,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const bigHitFilms = allFilms.filter(f => f.totalBoxOffice > 500000000);
      const recordFilm = bigHitFilms[Math.floor(seededRandom(weekSeed + 14) * bigHitFilms.length)];
      if (recordFilm && weeksAgo <= 4) {
        const studio = studioMap.get(recordFilm.studioId);
        stories.push({
          id: `record-w${storyWeek}-y${storyYear}-${recordFilm.id}`,
          type: 'record-break',
          headline: `"${recordFilm.title}" Crosses ${formatCompactMoney(recordFilm.totalBoxOffice)} Mark`,
          content: `${studio?.name || 'A major studio'}'s blockbuster "${recordFilm.title}" has officially crossed the ${formatCompactMoney(recordFilm.totalBoxOffice)} threshold at the worldwide box office, cementing its status as one of the year's biggest hits.`,
          priority: 70 - weeksAgo * 10,
          week: storyWeek,
          year: storyYear,
        });
      }
      
      const renewedShows = tvShows.filter(s => s.renewalStatus === 'renewed' && s.currentSeason && s.currentSeason > 1);
      const renewalShow = renewedShows[Math.floor(seededRandom(weekSeed + 15) * renewedShows.length)];
      if (renewalShow && weeksAgo <= 6) {
        const studio = studioMap.get(renewalShow.studioId);
        stories.push({
          id: `renewal-w${storyWeek}-y${storyYear}-${renewalShow.id}`,
          type: 'tv-renewal',
          headline: `"${renewalShow.title}" Renewed for Season ${renewalShow.currentSeason}`,
          content: `Great news for fans of "${renewalShow.title}"! ${studio?.name || 'The studio'} has confirmed the ${renewalShow.genre} series will return for another season.`,
          priority: 35 - weeksAgo * 3,
          week: storyWeek,
          year: storyYear,
        });
      }
    }
    
    if (stories.length === 0) {
      stories.push({
        id: 'fallback-quiet-week',
        type: 'box-office',
        headline: 'Quiet Week at the Box Office',
        content: 'No films currently in theatrical release. Industry insiders predict new releases coming soon as studios gear up for the next season.',
        priority: 50,
        week: currentWeek,
        year: currentYear,
      });
      
      stories.push({
        id: 'fallback-industry',
        type: 'director-signs',
        headline: 'Studios Gear Up for New Projects',
        content: 'Major studios are actively developing new content across all genres. Stay tuned for announcements about upcoming productions.',
        priority: 40,
        week: currentWeek,
        year: currentYear,
      });
      
      stories.push({
        id: 'fallback-streaming',
        type: 'tv-pickup',
        headline: 'Streaming Wars Heat Up',
        content: 'Competition among streaming platforms continues to intensify as services fight for exclusive content and subscriber growth.',
        priority: 30,
        week: currentWeek,
        year: currentYear,
      });
    }
    
    const uniqueStories = stories.filter((story, index, self) => 
      index === self.findIndex(s => s.id === story.id)
    );
    
    return uniqueStories.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.week !== b.week) return b.week - a.week;
      return b.priority - a.priority;
    });
  }, [allFilms, allStudios, allTalent, tvShows, studioMap, talentMap, filmMap, awardShows, nominations, awardShowMap, state.currentWeek, state.currentYear]);
  
  const thisWeekStories = allStories.filter(s => s.week === state.currentWeek && s.year === state.currentYear);
  const topStory = thisWeekStories[0];
  const olderStories = allStories.filter(s => s !== topStory).slice(0, 20);

  // Split stories into columns for newspaper layout
  const secondaryStories = thisWeekStories.slice(1, 3);
  const columnStories = olderStories.slice(0, 12);
  const leftColumnStories = columnStories.filter((_, i) => i % 2 === 0);
  const rightColumnStories = columnStories.filter((_, i) => i % 2 === 1);

  return (
    <Card className="overflow-hidden flex flex-col bg-amber-50 dark:bg-stone-900 border-2 border-stone-400 dark:border-stone-600" style={{ maxHeight: '650px' }}>
      {/* Newspaper Masthead */}
      <div className="bg-stone-100 dark:bg-stone-800 border-b-4 border-double border-stone-800 dark:border-stone-400 px-4 py-3 flex-shrink-0">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="h-px flex-1 bg-stone-800 dark:bg-stone-400"></div>
            <span className="text-[10px] tracking-[0.3em] text-stone-600 dark:text-stone-400 uppercase">The Entertainment Industry's Leading Source</span>
            <div className="h-px flex-1 bg-stone-800 dark:bg-stone-400"></div>
          </div>
          <h1 className="font-serif text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
            VARIETY WEEKLY
          </h1>
          <div className="flex items-center justify-between mt-1 text-[10px] text-stone-600 dark:text-stone-400">
            <span>Est. 1905</span>
            <span className="font-medium">Week {state.currentWeek}, {state.currentYear}</span>
            <span>Vol. CXIX No. {state.currentWeek}</span>
          </div>
        </div>
      </div>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3">
            {/* Lead Story - Full Width */}
            {topStory ? (
              <div className="border-b-2 border-stone-300 dark:border-stone-600 pb-3 mb-3">
                <div className="flex gap-4">
                  {topStory.imageUrl && (
                    <div className="w-28 h-36 flex-shrink-0 border border-stone-400 dark:border-stone-600 bg-stone-200 dark:bg-stone-700">
                      <img 
                        src={topStory.imageUrl} 
                        alt="" 
                        className="w-full h-full object-cover grayscale-[30%]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold tracking-wider text-red-700 dark:text-red-400 uppercase">Breaking</span>
                      <StoryIcon type={topStory.type} />
                    </div>
                    <h2 className="font-serif text-xl font-bold leading-tight mb-2 text-stone-900 dark:text-stone-100" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                      {topStory.headline}
                    </h2>
                    <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                      {topStory.content}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-stone-500 dark:text-stone-400 border-b-2 border-stone-300 dark:border-stone-600 mb-3">
                <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-serif italic">No major industry news this week.</p>
                <p className="text-xs mt-1">Release some films to make headlines!</p>
              </div>
            )}

            {/* Secondary Stories Row */}
            {secondaryStories.length > 0 && (
              <div className="grid grid-cols-2 gap-3 border-b-2 border-stone-300 dark:border-stone-600 pb-3 mb-3">
                {secondaryStories.map((story) => (
                  <div key={story.id} className="border-r last:border-r-0 border-stone-200 dark:border-stone-700 pr-3 last:pr-0">
                    <div className="flex items-center gap-1 mb-1">
                      <StoryIcon type={story.type} />
                      <span className="text-[9px] text-stone-500 dark:text-stone-400 uppercase tracking-wide">This Week</span>
                    </div>
                    <h3 className="font-serif text-sm font-bold leading-tight mb-1 text-stone-900 dark:text-stone-100" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                      {story.headline}
                    </h3>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-3" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                      {story.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Two-Column Layout for Older Stories */}
            {columnStories.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {/* Left Column */}
                <div className="border-r border-stone-200 dark:border-stone-700 pr-3 space-y-3">
                  {leftColumnStories.map((story) => (
                    <div key={story.id} className="border-b border-dashed border-stone-300 dark:border-stone-600 pb-2 last:border-b-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <StoryIcon type={story.type} />
                        <span className="text-[9px] text-stone-400 dark:text-stone-500">Wk {story.week}</span>
                      </div>
                      <h4 className="font-serif text-xs font-semibold leading-tight text-stone-800 dark:text-stone-200" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                        {story.headline}
                      </h4>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                        {story.content}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Right Column */}
                <div className="space-y-3">
                  {rightColumnStories.map((story) => (
                    <div key={story.id} className="border-b border-dashed border-stone-300 dark:border-stone-600 pb-2 last:border-b-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <StoryIcon type={story.type} />
                        <span className="text-[9px] text-stone-400 dark:text-stone-500">Wk {story.week}</span>
                      </div>
                      <h4 className="font-serif text-xs font-semibold leading-tight text-stone-800 dark:text-stone-200" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                        {story.headline}
                      </h4>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
                        {story.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
