import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  Building2, 
  Film as FilmIcon,
  Users,
  Clapperboard,
  PenTool,
  Music
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import type { Film, Studio, Talent, AwardNomination } from '@shared/schema';

interface FilmDetailProps {
  filmId: string;
}

function formatCompactMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function ScoreCircle({ score, label, type }: { score: number; label: string; type: 'critic' | 'audience' }) {
  const displayScore = type === 'audience' ? Math.round(score * 10) : Math.round(score);
  const color = displayScore >= 70 ? 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/20' :
                displayScore >= 50 ? 'text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                'text-red-600 border-red-500 bg-red-50 dark:bg-red-900/20';
  
  return (
    <div className="flex flex-col items-center">
      <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${color}`}>
        <span className="text-2xl font-bold">{displayScore}</span>
      </div>
      <span className="mt-2 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function FilmDetail({ filmId }: FilmDetailProps) {
  const { state } = useGame();

  const { data: allFilms = [] } = useQuery<Film[]>({
    queryKey: ['/api/all-films', state.studioId],
  });

  const { data: allStudios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
  });

  const { data: allTalent = [] } = useQuery<Talent[]>({
    queryKey: ['/api/talent'],
  });

  const { data: nominations = [] } = useQuery<AwardNomination[]>({
    queryKey: ['/api/nominations', state.studioId],
    enabled: !!state.studioId,
  });

  const film = useMemo(() => allFilms.find(f => f.id === filmId), [allFilms, filmId]);
  const studio = useMemo(() => film ? allStudios.find(s => s.id === film.studioId) : null, [allStudios, film]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);

  const director = useMemo(() => film?.directorId ? talentMap.get(film.directorId) : null, [film, talentMap]);
  const writer = useMemo(() => film?.writerId ? talentMap.get(film.writerId) : null, [film, talentMap]);
  const composer = useMemo(() => film?.composerId ? talentMap.get(film.composerId) : null, [film, talentMap]);
  const cast = useMemo(() => {
    if (!film?.castIds) return [];
    return film.castIds.map(id => talentMap.get(id)).filter(Boolean) as Talent[];
  }, [film, talentMap]);

  const filmAwards = useMemo(() => {
    if (!film) return { wins: [], nominations: [] };
    const filmNoms = nominations.filter(n => n.filmId === film.id);
    return {
      wins: filmNoms.filter(n => n.isWinner),
      nominations: filmNoms.filter(n => !n.isWinner),
    };
  }, [film, nominations]);

  const grossStats = useMemo(() => {
    if (!film) return null;
    const totalByCountry = film.totalBoxOfficeByCountry as Record<string, number> | null;
    const domesticGross = totalByCountry?.['North America'] || totalByCountry?.['NA'] || 
      Math.floor(film.totalBoxOffice * 0.4);
    const internationalGross = film.totalBoxOffice - domesticGross;
    const domesticPercent = film.totalBoxOffice > 0 ? (domesticGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    const intlPercent = film.totalBoxOffice > 0 ? (internationalGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    
    const investmentBudget = (film.productionBudget || 0) + 
      (film.talentBudget || 0) + 
      (film.setsBudget || 0) + 
      (film.costumesBudget || 0) + 
      (film.stuntsBudget || 0) + 
      (film.makeupBudget || 0) + 
      (film.practicalEffectsBudget || 0) + 
      (film.soundCrewBudget || 0) +
      (film.marketingBudget || 0);
    
    const profit = film.totalBoxOffice - investmentBudget;
    const roi = investmentBudget > 0 ? (profit / investmentBudget * 100) : 0;

    const openingWeekend = film.weeklyBoxOffice?.[0] || 0;

    return {
      domesticGross,
      internationalGross,
      worldwideGross: film.totalBoxOffice,
      domesticPercent,
      intlPercent,
      investmentBudget,
      profit,
      roi,
      openingWeekend,
    };
  }, [film]);

  if (!film) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FilmIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Film Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested film could not be found.</p>
        <Link href="/insider">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hollywood Insider
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/insider">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hollywood Insider
        </Button>
      </Link>

      {/* Header Section */}
      <div className="flex gap-6">
        {/* Poster */}
        <div className="flex-shrink-0">
          {film.posterUrl ? (
            <img 
              src={film.posterUrl} 
              alt={film.title}
              className="w-48 h-72 object-cover rounded-lg shadow-lg"
            />
          ) : (
            <div className="w-48 h-72 bg-muted rounded-lg flex items-center justify-center">
              <FilmIcon className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title & Basic Info */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{film.title}</h1>
          {film.synopsis && (
            <p className="text-lg text-muted-foreground italic mb-4 line-clamp-2">{film.synopsis}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className="text-sm">
              {genreLabels[film.genre as keyof typeof genreLabels] || film.genre}
            </Badge>
            {film.releaseYear && (
              <Badge variant="outline" className="text-sm">
                <Calendar className="w-3 h-3 mr-1" />
                {film.releaseYear}
              </Badge>
            )}
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-sm text-muted-foreground">Studio</p>
              <p className="font-medium flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {studio?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Director</p>
              <p className="font-medium flex items-center gap-1">
                <Clapperboard className="w-4 h-4" />
                {director?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Writer</p>
              <p className="font-medium flex items-center gap-1">
                <PenTool className="w-4 h-4" />
                {writer?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-medium">{formatCompactMoney(film.productionBudget || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scores Section */}
      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-16">
            <ScoreCircle 
              score={film.audienceScore || 5} 
              label="Audience" 
              type="audience" 
            />
            <ScoreCircle 
              score={film.criticScore || 50} 
              label="Critics" 
              type="critic" 
            />
          </div>
        </CardContent>
      </Card>

      {/* Grosses Section */}
      {grossStats && (
        <Card>
          <CardHeader>
            <CardTitle>Grosses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Gross Breakdown */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">
                    Domestic ({grossStats.domesticPercent}%)
                  </p>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.domesticGross)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">
                    International ({grossStats.intlPercent}%)
                  </p>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.internationalGross)}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">Worldwide</p>
                  <p className="text-3xl font-bold text-primary">{formatMoney(grossStats.worldwideGross)}</p>
                </div>
              </div>

              {/* Right: Additional Stats */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Opening Weekend</p>
                    <p className="text-lg font-semibold">{formatCompactMoney(grossStats.openingWeekend)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Budget</p>
                    <p className="text-lg font-semibold">{formatCompactMoney(grossStats.investmentBudget)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Profit/Loss</p>
                    <p className={`text-lg font-semibold ${grossStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {grossStats.profit >= 0 ? '+' : ''}{formatCompactMoney(grossStats.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className={`text-lg font-semibold ${grossStats.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {grossStats.roi >= 0 ? '+' : ''}{grossStats.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {film.marketingBudget && (
                  <div>
                    <p className="text-sm text-muted-foreground">Marketing Budget</p>
                    <p className="text-lg font-semibold">{formatCompactMoney(film.marketingBudget)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cast Section */}
      {cast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Cast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {cast.map((actor, index) => (
                <div key={actor.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {actor.imageUrl ? (
                      <img 
                        src={actor.imageUrl} 
                        alt={actor.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium">{actor.name}</span>
                  </div>
                  <span className="text-muted-foreground">Cast Member {index + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crew Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5" />
            Crew
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {director && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {director.imageUrl ? (
                    <img 
                      src={director.imageUrl} 
                      alt={director.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Clapperboard className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{director.name}</span>
                </div>
                <span className="text-muted-foreground">Director</span>
              </div>
            )}
            {writer && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {writer.imageUrl ? (
                    <img 
                      src={writer.imageUrl} 
                      alt={writer.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <PenTool className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{writer.name}</span>
                </div>
                <span className="text-muted-foreground">Writer</span>
              </div>
            )}
            {composer && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {composer.imageUrl ? (
                    <img 
                      src={composer.imageUrl} 
                      alt={composer.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium">{composer.name}</span>
                </div>
                <span className="text-muted-foreground">Composer</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Awards Section */}
      {(filmAwards.wins.length > 0 || filmAwards.nominations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filmAwards.wins.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">
                    Wins ({filmAwards.wins.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.wins.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium">
                            {award.categoryId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">{award.ceremonyYear}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {filmAwards.nominations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-2">
                    Nominations ({filmAwards.nominations.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.nominations.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                        <Trophy className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {award.categoryId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">{award.ceremonyYear}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
