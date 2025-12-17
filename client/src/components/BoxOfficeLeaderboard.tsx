import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGame, formatMoney, genreColors, genreLabels, type FilmWithTalent } from '@/lib/gameState';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { Film, Studio } from '@shared/schema';

interface LeaderboardRowProps {
  rank: number;
  film: Film & { studioName: string };
  isYours?: boolean;
}

function LeaderboardRow({ rank, film, isYours }: LeaderboardRowProps) {
  const lastWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0;
  const prevWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 2] || lastWeek;
  const change = prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : 0;
  const weeksInRelease = film.weeklyBoxOffice.length;
  const isFinished = film.status === 'archived';

  return (
    <div 
      className={`flex items-center gap-4 p-3 rounded-lg ${isYours ? 'bg-primary/10 border border-primary/20' : 'hover-elevate'}`}
      data-testid={`row-leaderboard-${film.id}`}
    >
      <div className="w-8 text-center">
        <span className={`font-display text-xl ${rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          {rank}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium truncate" data-testid={`text-film-title-${film.id}`}>
            {film.title}
          </h4>
          {isYours && (
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
              Your Film
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {film.studioName}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className={`text-xs ${genreColors[film.genre as keyof typeof genreColors]}`}>
            {genreLabels[film.genre as keyof typeof genreLabels]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Week {weeksInRelease} in release
          </span>
        </div>
      </div>

      <div className="text-right">
        {isFinished ? (
          <Badge className="bg-green-600 dark:bg-green-700 text-white">
            Finished
          </Badge>
        ) : (
          <>
            <p className="font-medium" data-testid={`text-weekly-gross-${film.id}`}>
              {formatMoney(lastWeek)}
            </p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </>
        )}
      </div>

      <div className="text-right w-20">
        <p className={`text-sm flex items-center justify-end gap-1 ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change).toFixed(0)}%
        </p>
      </div>

      <div className="text-right">
        <p className="font-display text-lg" data-testid={`text-total-gross-${film.id}`}>
          {formatMoney(film.totalBoxOffice)}
        </p>
        <p className="text-xs text-muted-foreground">Total</p>
      </div>
    </div>
  );
}

export function BoxOfficeLeaderboard() {
  const { state } = useGame();
  const { data: allFilms = [] } = useQuery<Film[]>({
    queryKey: ['/api/all-films', state.studioId],
  });
  const { data: allStudios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
  });

  // Create a map of studio IDs to names
  const studioMap = new Map(allStudios.map(s => [s.id, s.name]));
  
  // Sort all films by total box office and get top 10
  const sortedFilms = [...allFilms]
    .filter(f => f.weeklyBoxOffice.length > 0)
    .map(f => ({ ...f, studioName: studioMap.get(f.studioId) || 'Unknown' }))
    .sort((a, b) => b.totalBoxOffice - a.totalBoxOffice)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="font-display text-xl">Box Office Leaderboard</CardTitle>
        <Link href="/boxoffice">
          <Button variant="ghost" size="sm" data-testid="link-view-all-boxoffice">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {sortedFilms.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No films currently in theaters
          </p>
        ) : (
          <div className="space-y-2">
            {sortedFilms.map((film, index) => (
              <LeaderboardRow 
                key={film.id} 
                rank={index + 1} 
                film={film}
                isYours={film.studioId === state.studioId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
