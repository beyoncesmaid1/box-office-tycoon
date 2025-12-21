import { useMemo, useState, useEffect } from 'react';
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
  Music,
  Globe,
  TrendingUp,
  DollarSign,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import type { Film, Studio, Talent, AwardNomination, FilmRole } from '@shared/schema';

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

  const { data: filmRoles = [] } = useQuery<FilmRole[]>({
    queryKey: [`/api/films/${filmId}/roles`],
    enabled: !!filmId,
  });

  const [actualMarketingBudget, setActualMarketingBudget] = useState<number>(0);

  const film = useMemo(() => allFilms.find(f => f.id === filmId), [allFilms, filmId]);

  // Fetch marketing budget from releases (same as FilmLibrary)
  useEffect(() => {
    if (film) {
      fetch(`/api/films/${film.id}/releases`)
        .then(res => res.json())
        .then(releases => {
          const releaseWithMarketing = releases.find((r: any) => r.marketingBudget && r.marketingBudget > 0);
          const marketingFromReleases = releaseWithMarketing?.marketingBudget || 0;
          setActualMarketingBudget(marketingFromReleases || film.marketingBudget || 0);
        })
        .catch(() => setActualMarketingBudget(film.marketingBudget || 0));
    } else {
      setActualMarketingBudget(0);
    }
  }, [film]);
  const studio = useMemo(() => film ? allStudios.find(s => s.id === film.studioId) : null, [allStudios, film]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);

  const director = useMemo(() => film?.directorId ? talentMap.get(film.directorId) : null, [film, talentMap]);
  const writer = useMemo(() => film?.writerId ? talentMap.get(film.writerId) : null, [film, talentMap]);
  const composer = useMemo(() => film?.composerId ? talentMap.get(film.composerId) : null, [film, talentMap]);
  const cast = useMemo(() => {
    if (!film?.castIds) return [];
    return film.castIds.map(id => {
      const actor = talentMap.get(id);
      if (!actor) return null;
      // Find the role for this actor
      const role = filmRoles.find(r => r.actorId === id);
      return {
        ...actor,
        roleName: role?.roleName || 'Unknown Role',
      };
    }).filter(Boolean) as (Talent & { roleName: string })[];
  }, [film, talentMap, filmRoles]);

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
    const weeklyByCountry = film.weeklyBoxOfficeByCountry as Array<Record<string, number>> | null;
    
    const domesticGross = totalByCountry?.['North America'] || totalByCountry?.['NA'] || 
      Math.floor(film.totalBoxOffice * 0.4);
    const internationalGross = film.totalBoxOffice - domesticGross;
    const domesticPercent = film.totalBoxOffice > 0 ? (domesticGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    const intlPercent = film.totalBoxOffice > 0 ? (internationalGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    
    // Use totalBudget which includes all production costs + marketing
    const investmentBudget = film.totalBudget || 0;
    
    const profit = film.totalBoxOffice - investmentBudget;
    const roi = investmentBudget > 0 ? (profit / investmentBudget * 100) : 0;

    const openingWeekend = film.weeklyBoxOffice?.[0] || 0;
    const weeklyData = film.weeklyBoxOffice || [];
    
    // Get opening weekend per country (first week's data)
    const openingByCountry: Record<string, number> = {};
    if (weeklyByCountry && weeklyByCountry.length > 0) {
      const firstWeek = weeklyByCountry[0];
      Object.entries(firstWeek).forEach(([country, gross]) => {
        openingByCountry[country] = gross;
      });
    }
    
    // Country breakdown with opening weekend - sort by gross descending
    const countryBreakdown = totalByCountry 
      ? Object.entries(totalByCountry)
          .map(([country, gross]) => ({
            country,
            gross,
            opening: openingByCountry[country] || 0,
            percent: film.totalBoxOffice > 0 ? (gross / film.totalBoxOffice * 100) : 0
          }))
          .sort((a, b) => b.gross - a.gross)
      : [];
    
    // Separate domestic and international markets
    const domesticMarkets = countryBreakdown.filter(c => 
      c.country === 'North America' || c.country === 'NA' || c.country === 'Domestic'
    );
    const internationalMarkets = countryBreakdown.filter(c => 
      c.country !== 'North America' && c.country !== 'NA' && c.country !== 'Domestic'
    );

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
      weeklyData,
      countryBreakdown,
      domesticMarkets,
      internationalMarkets,
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

      {/* Opening Weekend Highlight - Box Office Mojo Style */}
      {grossStats && grossStats.openingWeekend > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-full">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">Opening Weekend</p>
                  <p className="text-4xl font-bold text-primary">{formatMoney(grossStats.openingWeekend)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Legs</p>
                <p className="text-2xl font-semibold">
                  {grossStats.openingWeekend > 0 
                    ? (grossStats.worldwideGross / grossStats.openingWeekend).toFixed(2) 
                    : 0}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Office Summary - Box Office Mojo Style */}
      {grossStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Box Office Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Worldwide Total */}
              <div className="lg:col-span-1 p-6 bg-muted/50 rounded-lg text-center">
                <Globe className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Worldwide</p>
                <p className="text-3xl font-bold text-primary">{formatMoney(grossStats.worldwideGross)}</p>
              </div>
              
              {/* Domestic & International */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Domestic</p>
                  </div>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.domesticGross)}</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${grossStats.domesticPercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{grossStats.domesticPercent}% of worldwide</p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">International</p>
                  </div>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.internationalGross)}</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full" 
                      style={{ width: `${grossStats.intlPercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{grossStats.intlPercent}% of worldwide</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Country Breakdown - Progress Bar Style with Opening & Gross */}
      {grossStats && grossStats.countryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              International Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grossStats.countryBreakdown.map(({ country, gross, opening, percent }) => (
                <div key={country} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium truncate">{country}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all" 
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-24 text-right font-mono text-sm text-muted-foreground">
                    {formatCompactMoney(opening)}
                  </div>
                  <div className="w-24 text-right font-mono text-sm font-medium">
                    {formatCompactMoney(gross)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
              <div className="w-32"></div>
              <div className="flex-1 text-center">% of Worldwide</div>
              <div className="w-24 text-right">Opening</div>
              <div className="w-24 text-right">Total Gross</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Performance */}
      {grossStats && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                // Use same calculation as BoxOfficeDetail
                const investmentBudget = (film.productionBudget || 0) + 
                  (film.setsBudget || 0) + (film.costumesBudget || 0) + (film.stuntsBudget || 0) + 
                  (film.makeupBudget || 0) + (film.practicalEffectsBudget || 0) + (film.soundCrewBudget || 0) +
                  (film.talentBudget || 0);
                const totalInvestment = investmentBudget + actualMarketingBudget;
                // Studios get 70% of box office revenue
                const studioRevenue = film.totalBoxOffice * 0.7;
                const profit = studioRevenue - totalInvestment;
                const roi = totalInvestment > 0 ? (profit / totalInvestment * 100) : 0;
                return (
                  <>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Production Budget</p>
                      <p className="text-xl font-bold">{formatCompactMoney(investmentBudget)}</p>
                    </div>
                    {actualMarketingBudget > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Marketing Budget</p>
                        <p className="text-xl font-bold">{formatCompactMoney(actualMarketingBudget)}</p>
                      </div>
                    )}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Investment</p>
                      <p className="text-xl font-bold">{formatCompactMoney(totalInvestment)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <p className="text-sm text-muted-foreground">Profit/Loss</p>
                      <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? '+' : ''}{formatCompactMoney(profit)}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg ${roi >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <p className="text-sm text-muted-foreground">Return on Investment</p>
                      <p className={`text-xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </p>
                    </div>
                  </>
                );
              })()}
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
                <Link key={actor.id} href={`/talent/${actor.id}`}>
                  <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
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
                      <span className="font-medium hover:underline">{actor.name}</span>
                    </div>
                    <span className="text-muted-foreground">{actor.roleName}</span>
                  </div>
                </Link>
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
              <Link href={`/talent/${director.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
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
                    <span className="font-medium hover:underline">{director.name}</span>
                  </div>
                  <span className="text-muted-foreground">Director</span>
                </div>
              </Link>
            )}
            {writer && (
              <Link href={`/talent/${writer.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
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
                    <span className="font-medium hover:underline">{writer.name}</span>
                  </div>
                  <span className="text-muted-foreground">Writer</span>
                </div>
              </Link>
            )}
            {composer && (
              <Link href={`/talent/${composer.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
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
                    <span className="font-medium hover:underline">{composer.name}</span>
                  </div>
                  <span className="text-muted-foreground">Composer</span>
                </div>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Awards Section - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Awards
            {(filmAwards.wins.length > 0 || filmAwards.nominations.length > 0) && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {filmAwards.wins.length} Win{filmAwards.wins.length !== 1 ? 's' : ''} • {filmAwards.nominations.length} Nomination{filmAwards.nominations.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(filmAwards.wins.length > 0 || filmAwards.nominations.length > 0) ? (
            <div className="space-y-4">
              {filmAwards.wins.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-500 mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Wins ({filmAwards.wins.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.wins.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
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
                  <h4 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Nominations ({filmAwards.nominations.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.nominations.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border">
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
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No awards or nominations yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
