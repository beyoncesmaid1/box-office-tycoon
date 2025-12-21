import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  TrendingUp, 
  Trophy, 
  Users, 
  Film as FilmIcon, 
  Calendar,
  Filter,
  ArrowUpDown,
  Star,
  Globe,
  MapPin,
  Building2,
  Clapperboard,
  PenTool,
  Music,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import type { Film, Studio, Talent, AwardNomination } from '@shared/schema';

type SortField = 'worldwide' | 'domestic' | 'international';
type TimeFilter = 'all-time' | 'yearly';
type TalentTypeFilter = 'all' | 'director' | 'actor' | 'composer' | 'writer';
type TalentSortField = 'gross' | 'alphabetical';

function formatCompactMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

interface FilmWithStats extends Film {
  studioName: string;
  directorName: string;
  domesticGross: number;
  internationalGross: number;
  worldwideGross: number;
  profit: number;
  roi: number;
}

interface TalentWithFilmography extends Talent {
  filmography: {
    film: Film;
    role: string;
    boxOffice: number;
  }[];
  totalBoxOffice: number;
  awardWins: number;
  awardNominations: number;
}

export function HollywoodInsider() {
  const { state } = useGame();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('box-office');
  const [sortField, setSortField] = useState<SortField>('worldwide');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [studioFilter, setStudioFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all-time');
  const [selectedYear, setSelectedYear] = useState<number>(state.currentYear);
  const [talentTypeFilter, setTalentTypeFilter] = useState<TalentTypeFilter>('all');
  const [talentSortField, setTalentSortField] = useState<TalentSortField>('gross');
  const [filmSearchQuery, setFilmSearchQuery] = useState('');
  const [talentSearchQuery, setTalentSearchQuery] = useState('');

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

  const studioMap = useMemo(() => new Map(allStudios.map(s => [s.id, s])), [allStudios]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);

  // Get available years for filtering (only up to current game year)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allFilms.forEach(f => {
      if (f.releaseYear && f.releaseYear <= state.currentYear) years.add(f.releaseYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allFilms, state.currentYear]);

  // Process films with stats (only show films released up to current game year)
  const filmsWithStats: FilmWithStats[] = useMemo(() => {
    return allFilms
      .filter(f => f.phase === 'released' && f.totalBoxOffice > 0 && (!f.releaseYear || f.releaseYear <= state.currentYear))
      .map(film => {
        const studio = studioMap.get(film.studioId);
        const director = film.directorId ? talentMap.get(film.directorId) : null;
        
        // Calculate domestic (NA) vs international
        const totalByCountry = film.totalBoxOfficeByCountry as Record<string, number> | null;
        const domesticGross = totalByCountry?.['North America'] || totalByCountry?.['NA'] || 
          Math.floor(film.totalBoxOffice * 0.4); // Default 40% domestic
        const internationalGross = film.totalBoxOffice - domesticGross;
        
        // Use totalBudget which includes all production costs + marketing budget from film
        const investmentBudget = (film.totalBudget || 0) + (film.marketingBudget || 0);
        
        // Studios get 70% of box office revenue
        const studioRevenue = film.totalBoxOffice * 0.7;
        const profit = studioRevenue - investmentBudget;
        const roi = investmentBudget > 0 ? (profit / investmentBudget) * 100 : 0;

        return {
          ...film,
          studioName: studio?.name || 'Unknown Studio',
          directorName: director?.name || 'Unknown',
          domesticGross,
          internationalGross,
          worldwideGross: film.totalBoxOffice,
          profit,
          roi,
        };
      });
  }, [allFilms, studioMap, talentMap, state.currentYear]);

  // Filter and sort films
  const filteredFilms = useMemo(() => {
    let filtered = [...filmsWithStats];

    // Search filter
    if (filmSearchQuery.trim()) {
      const query = filmSearchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.title.toLowerCase().includes(query) ||
        f.studioName.toLowerCase().includes(query) ||
        f.directorName.toLowerCase().includes(query)
      );
    }

    // Time filter
    if (timeFilter === 'yearly') {
      filtered = filtered.filter(f => f.releaseYear === selectedYear);
    }

    // Genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(f => f.genre === genreFilter);
    }

    // Studio filter
    if (studioFilter !== 'all') {
      filtered = filtered.filter(f => f.studioId === studioFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortField) {
        case 'domestic':
          return b.domesticGross - a.domesticGross;
        case 'international':
          return b.internationalGross - a.internationalGross;
        case 'worldwide':
        default:
          return b.worldwideGross - a.worldwideGross;
      }
    });

    return filtered;
  }, [filmsWithStats, timeFilter, selectedYear, genreFilter, studioFilter, sortField, filmSearchQuery]);

  // Process talent with filmography (include all types)
  const talentWithFilmography: TalentWithFilmography[] = useMemo(() => {
    return allTalent
      .map(talent => {
        const filmography: TalentWithFilmography['filmography'] = [];
        
        for (const film of allFilms) {
          if (film.phase !== 'released') continue;
          
          if (film.directorId === talent.id) {
            filmography.push({
              film,
              role: 'Director',
              boxOffice: film.totalBoxOffice,
            });
          }
          if (film.writerId === talent.id) {
            filmography.push({
              film,
              role: 'Writer',
              boxOffice: film.totalBoxOffice,
            });
          }
          if (film.composerId === talent.id) {
            filmography.push({
              film,
              role: 'Composer',
              boxOffice: film.totalBoxOffice,
            });
          }
          if (film.castIds?.includes(talent.id)) {
            filmography.push({
              film,
              role: 'Actor',
              boxOffice: film.totalBoxOffice,
            });
          }
        }

        const talentNominations = nominations.filter(n => 
          n.talentId === talent.id || 
          (n.filmId && filmography.some(f => f.film.id === n.filmId))
        );
        const awardWins = talentNominations.filter(n => n.isWinner).length;
        const awardNominations = talentNominations.length;

        return {
          ...talent,
          filmography: filmography.sort((a, b) => b.boxOffice - a.boxOffice),
          totalBoxOffice: filmography.reduce((sum, f) => sum + f.boxOffice, 0),
          awardWins,
          awardNominations,
        };
      })
      .filter(t => t.filmography.length > 0);
  }, [allTalent, allFilms, nominations]);

  // Filter and sort talent
  const filteredTalent = useMemo(() => {
    let filtered = [...talentWithFilmography];
    
    // Search filter
    if (talentSearchQuery.trim()) {
      const query = talentSearchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (talentTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === talentTypeFilter);
    }
    
    // Sort
    if (talentSortField === 'alphabetical') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => b.totalBoxOffice - a.totalBoxOffice);
    }
    
    return filtered;
  }, [talentWithFilmography, talentTypeFilter, talentSortField, talentSearchQuery]);

  // Get unique genres and studios for filters
  const genres = useMemo(() => {
    const genreSet = new Set(allFilms.map(f => f.genre).filter(Boolean));
    return Array.from(genreSet).sort();
  }, [allFilms]);

  const studios = useMemo(() => {
    return allStudios.filter(s => filmsWithStats.some(f => f.studioId === s.id));
  }, [allStudios, filmsWithStats]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const films = timeFilter === 'yearly' 
      ? filmsWithStats.filter(f => f.releaseYear === selectedYear)
      : filmsWithStats;
    
    return {
      totalFilms: films.length,
      totalBoxOffice: films.reduce((sum, f) => sum + f.worldwideGross, 0),
      avgBoxOffice: films.length > 0 ? films.reduce((sum, f) => sum + f.worldwideGross, 0) / films.length : 0,
      topGrossing: films[0]?.title || 'N/A',
    };
  }, [filmsWithStats, timeFilter, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">The Hollywood Insider</h1>
          <p className="text-muted-foreground">Industry statistics, rankings, and talent profiles</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FilmIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {timeFilter === 'yearly' ? `${selectedYear} Films` : 'All-Time Films'}
                </p>
                <p className="text-2xl font-bold">{summaryStats.totalFilms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Box Office</p>
                <p className="text-2xl font-bold">{formatCompactMoney(summaryStats.totalBoxOffice)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Star className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Box Office</p>
                <p className="text-2xl font-bold">{formatCompactMoney(summaryStats.avgBoxOffice)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Film</p>
                <p className="text-lg font-bold truncate">{summaryStats.topGrossing}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="box-office" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Box Office Charts
          </TabsTrigger>
          <TabsTrigger value="studios" className="gap-2">
            <Building2 className="w-4 h-4" />
            Studio Rankings
          </TabsTrigger>
          <TabsTrigger value="talent" className="gap-2">
            <Users className="w-4 h-4" />
            Talent Profiles
          </TabsTrigger>
          <TabsTrigger value="inside-scoop" className="gap-2">
            <Star className="w-4 h-4" />
            Inside Scoop
          </TabsTrigger>
        </TabsList>

        {/* Box Office Charts Tab */}
        <TabsContent value="box-office" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search films by title, studio, or director..."
                  value={filmSearchQuery}
                  onChange={(e) => setFilmSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters and Sort */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                  <SelectTrigger className="w-[140px]">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-time">All Time</SelectItem>
                    <SelectItem value="yearly">By Year</SelectItem>
                  </SelectContent>
                </Select>

                {timeFilter === 'yearly' && (
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={genreFilter} onValueChange={setGenreFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map(genre => (
                      <SelectItem key={genre} value={genre}>
                        {genreLabels[genre as keyof typeof genreLabels] || genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={studioFilter} onValueChange={setStudioFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Building2 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Studio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Studios</SelectItem>
                    {studios.map(studio => (
                      <SelectItem key={studio.id} value={studio.id}>{studio.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Sort:</span>
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worldwide">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Worldwide
                        </div>
                      </SelectItem>
                      <SelectItem value="domestic">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Domestic
                        </div>
                      </SelectItem>
                      <SelectItem value="international">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          International
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Box Office Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {timeFilter === 'yearly' ? `${selectedYear} ` : 'All-Time '}
                Box Office Rankings
                {genreFilter !== 'all' && ` - ${genreLabels[genreFilter as keyof typeof genreLabels] || genreFilter}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="py-3 px-2 w-12">#</th>
                      <th className="py-3 px-2">Title</th>
                      <th className="py-3 px-2">Studio</th>
                      <th className="py-3 px-2">Genre</th>
                      <th className="py-3 px-2 text-right">Domestic</th>
                      <th className="py-3 px-2 text-right">International</th>
                      <th className="py-3 px-2 text-right font-semibold">Worldwide</th>
                      <th className="py-3 px-2 text-right">Total Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredFilms.map((film, index) => (
                      <tr key={film.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/film/${film.id}`)}>
                        <td className="py-3 px-2 font-bold text-muted-foreground">{index + 1}</td>
                        <td className="py-3 px-2">
                          <Link href={`/film/${film.id}`} className="flex items-center gap-3 hover:text-primary">
                            {film.posterUrl && (
                              <img 
                                src={film.posterUrl} 
                                alt={film.title}
                                className="w-8 h-12 object-cover rounded"
                              />
                            )}
                            <div>
                              <p className="font-medium hover:underline">{film.title}</p>
                              <p className="text-xs text-muted-foreground">{film.releaseYear}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-sm">{film.studioName}</td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">
                            {genreLabels[film.genre as keyof typeof genreLabels] || film.genre}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-sm">
                          {formatCompactMoney(film.domesticGross)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-sm">
                          {formatCompactMoney(film.internationalGross)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-sm font-semibold">
                          {formatCompactMoney(film.worldwideGross)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-sm text-muted-foreground">
                          {formatCompactMoney(film.totalBudget || 0)}
                        </td>
                      </tr>
                    ))}
                    {filteredFilms.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No films match the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Studio Rankings Tab */}
        <TabsContent value="studios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Studio Box Office Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {studios
                    .map(studio => {
                      const studioFilms = filmsWithStats.filter(f => f.studioId === studio.id);
                      const totalGross = studioFilms.reduce((sum, f) => sum + f.worldwideGross, 0);
                      const avgGross = studioFilms.length > 0 ? totalGross / studioFilms.length : 0;
                      const topFilm = studioFilms[0];
                      return { studio, studioFilms, totalGross, avgGross, topFilm };
                    })
                    .sort((a, b) => b.totalGross - a.totalGross)
                    .map(({ studio, studioFilms, totalGross, avgGross, topFilm }, index) => (
                      <div 
                        key={studio.id} 
                        className={`p-4 rounded-lg border ${studio.id === state.studioId ? 'border-primary bg-primary/5' : 'border-border'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-muted-foreground w-8">
                              #{index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{studio.name}</h3>
                                {studio.id === state.studioId && (
                                  <Badge variant="secondary" className="text-xs">Your Studio</Badge>
                                )}
                                {studio.isAI && (
                                  <Badge variant="outline" className="text-xs">AI</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {studioFilms.length} films released
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{formatCompactMoney(totalGross)}</p>
                            <p className="text-sm text-muted-foreground">Total Gross</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Avg. per Film</p>
                            <p className="font-medium">{formatCompactMoney(avgGross)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Top Film</p>
                            <p className="font-medium truncate">{topFilm?.title || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Top Film Gross</p>
                            <p className="font-medium">{topFilm ? formatCompactMoney(topFilm.worldwideGross) : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Talent Profiles Tab */}
        <TabsContent value="talent" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search talent by name..."
                  value={talentSearchQuery}
                  onChange={(e) => setTalentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters and Sort */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filter:</span>
                </div>
                
                <Select value={talentTypeFilter} onValueChange={(v) => setTalentTypeFilter(v as TalentTypeFilter)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        All Talent
                      </div>
                    </SelectItem>
                    <SelectItem value="director">
                      <div className="flex items-center gap-2">
                        <Clapperboard className="w-4 h-4" />
                        Directors
                      </div>
                    </SelectItem>
                    <SelectItem value="actor">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Actors
                      </div>
                    </SelectItem>
                    <SelectItem value="composer">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        Composers
                      </div>
                    </SelectItem>
                    <SelectItem value="writer">
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4" />
                        Writers
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Sort:</span>
                  <Select value={talentSortField} onValueChange={(v) => setTalentSortField(v as TalentSortField)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gross">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Box Office
                        </div>
                      </SelectItem>
                      <SelectItem value="alphabetical">
                        <div className="flex items-center gap-2">
                          A-Z
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Talent Filmography & Awards
                {talentTypeFilter !== 'all' && ` - ${talentTypeFilter.charAt(0).toUpperCase() + talentTypeFilter.slice(1)}s`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-6">
                  {filteredTalent.slice(0, 50).map((talent, index) => (
                    <div 
                      key={talent.id} 
                      className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/talent/${talent.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {/* Profile Picture */}
                          {talent.imageUrl ? (
                            <img 
                              src={talent.imageUrl} 
                              alt={talent.name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                              {talent.type === 'director' && <Clapperboard className="w-6 h-6 text-muted-foreground" />}
                              {talent.type === 'actor' && <Users className="w-6 h-6 text-muted-foreground" />}
                              {talent.type === 'composer' && <Music className="w-6 h-6 text-muted-foreground" />}
                              {talent.type === 'writer' && <PenTool className="w-6 h-6 text-muted-foreground" />}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                              <h3 className="font-semibold text-lg hover:underline">{talent.name}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {talent.type}
                              </Badge>
                              {talent.awardWins > 0 && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Trophy className="w-3 h-3" />
                                  {talent.awardWins} Win{talent.awardWins !== 1 ? 's' : ''}
                                </Badge>
                              )}
                              {talent.awardNominations > talent.awardWins && (
                                <Badge variant="outline" className="text-xs">
                                  {talent.awardNominations} Nom{talent.awardNominations !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatCompactMoney(talent.totalBoxOffice)}</p>
                          <p className="text-sm text-muted-foreground">Career Box Office</p>
                        </div>
                      </div>
                      
                      {/* Filmography */}
                      <div className="mt-3">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Filmography ({talent.filmography.length} films)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {talent.filmography.slice(0, 8).map(({ film, role, boxOffice }) => (
                            <Link 
                              key={`${film.id}-${role}`}
                              href={`/film/${film.id}`}
                              className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-sm hover:bg-muted transition-colors"
                            >
                              <span className="font-medium hover:underline">{film.title}</span>
                              <span className="text-muted-foreground">({film.releaseYear})</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs">{role}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs font-mono">{formatCompactMoney(boxOffice)}</span>
                            </Link>
                          ))}
                          {talent.filmography.length > 8 && (
                            <div className="px-3 py-1.5 text-sm text-muted-foreground">
                              +{talent.filmography.length - 8} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredTalent.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      No talent with released films yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inside Scoop Tab */}
        <TabsContent value="inside-scoop" className="space-y-6">
          {/* Box Office Projections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Opening Weekend Projections
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Industry analysts predict the following opening weekends for upcoming releases
              </p>
            </CardHeader>
            <CardContent>
              {(() => {
                // Get films that are close to release - either scheduled in next 4 weeks OR in late production phases
                const upcomingFilms = allFilms.filter(f => {
                  // Skip already released films
                  if (f.phase === 'released') {
                    return false;
                  }
                  
                  // Include films in late production phases (close to release)
                  const latePhases = ['post-production', 'production-complete', 'awaiting-release'];
                  if (latePhases.includes(f.phase)) {
                    return true;
                  }
                  
                  // Also include any film with a release date in the next 4 weeks
                  if (f.releaseWeek && f.releaseYear) {
                    const filmWeekNum = f.releaseYear * 52 + f.releaseWeek;
                    const currentWeekNum = state.currentYear * 52 + state.currentWeek;
                    const weeksUntilRelease = filmWeekNum - currentWeekNum;
                    return weeksUntilRelease >= 0 && weeksUntilRelease <= 4;
                  }
                  return false;
                });
                
                if (upcomingFilms.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      No upcoming releases scheduled
                    </div>
                  );
                }
                
                // Calculate projected openings based on genre, budget, marketing, sequel status
                const projections = upcomingFilms.map(film => {
                  const studio = studioMap.get(film.studioId);
                  
                  // Base projection from budget
                  const totalBudget = film.totalBudget || film.productionBudget || 50000000;
                  const marketingBudget = film.marketingBudget || 0;
                  
                  // Genre multipliers for expected opening
                  const genreMultipliers: Record<string, number> = {
                    'action': 0.45, 'scifi': 0.40, 'animation': 0.35, 'fantasy': 0.38,
                    'horror': 0.55, 'comedy': 0.30, 'thriller': 0.28, 'drama': 0.15,
                    'romance': 0.20, 'musicals': 0.25
                  };
                  const genreMultiplier = genreMultipliers[film.genre] || 0.25;
                  
                  // Marketing boost (up to 50% more)
                  const marketingBoost = marketingBudget > 0 ? 1 + (marketingBudget / totalBudget) * 0.5 : 1;
                  
                  // Sequel boost (25-40%)
                  const isSequel = film.title.match(/\s[2-9]$|\sII|III|IV|Part\s/i) !== null;
                  const sequelBoost = isSequel ? 1.3 : 1;
                  
                  // Calculate base projection
                  let baseProjection = totalBudget * genreMultiplier * marketingBoost * sequelBoost;
                  
                  // Add ±20% variance for display range
                  const lowEstimate = Math.floor(baseProjection * 0.75);
                  const highEstimate = Math.floor(baseProjection * 1.25);
                  
                  // Calculate weeks until release
                  const filmWeekNum = (film.releaseYear || state.currentYear) * 52 + (film.releaseWeek || state.currentWeek);
                  const currentWeekNum = state.currentYear * 52 + state.currentWeek;
                  const weeksUntilRelease = Math.max(0, filmWeekNum - currentWeekNum);
                  
                  return {
                    film,
                    studioName: studio?.name || 'Unknown Studio',
                    lowEstimate,
                    highEstimate,
                    isSequel,
                    weeksUntilRelease,
                    releaseWeek: film.releaseWeek,
                    releaseYear: film.releaseYear
                  };
                }).sort((a, b) => a.weeksUntilRelease - b.weeksUntilRelease); // Sort by release date (soonest first);
                
                return (
                  <div className="space-y-3">
                    {projections.slice(0, 10).map(({ film, studioName, lowEstimate, highEstimate, isSequel, weeksUntilRelease, releaseWeek }) => (
                      <div key={film.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {film.posterUrl && (
                            <img src={film.posterUrl} alt={film.title} className="w-10 h-14 object-cover rounded" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{film.title}</span>
                              {isSequel && <Badge variant="secondary" className="text-xs">Sequel</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{studioName}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {genreLabels[film.genre as keyof typeof genreLabels] || film.genre}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-green-600">
                            {formatCompactMoney(lowEstimate)} - {formatCompactMoney(highEstimate)}
                          </p>
                          <p className="text-xs text-muted-foreground">Projected Opening</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {weeksUntilRelease === 0 ? 'This week' : 
                             weeksUntilRelease === 1 ? 'Next week' : 
                             `Week ${releaseWeek} (${weeksUntilRelease}w)`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Oscar Predictions - Only show in Nov, Dec, Jan */}
          {(() => {
            const currentWeek = state.currentWeek;
            const currentYear = state.currentYear;
            const isNovember = currentWeek >= 44 && currentWeek <= 48; // Early November
            const isDecember = currentWeek >= 48 && currentWeek <= 52; // December
            const isJanuary = currentWeek >= 1 && currentWeek <= 4; // January
            
            const showPredictions = isNovember || isDecember || isJanuary;
            const isUpdated = isDecember || isJanuary;
            
            if (!showPredictions) return null;
            
            // Seeded random function for stable predictions
            // Seed changes only at the start of each prediction period (Nov, Dec, Jan)
            const getPredictionSeed = () => {
              if (isJanuary) return currentYear * 1000 + 1; // January seed
              if (isDecember) return currentYear * 1000 + 12; // December seed
              return currentYear * 1000 + 11; // November seed
            };
            const seed = getPredictionSeed();
            
            // Simple seeded random number generator
            const seededRandom = (filmId: string, categoryOffset: number = 0) => {
              // Create a hash from film ID and seed
              let hash = seed + categoryOffset;
              for (let i = 0; i < filmId.length; i++) {
                hash = ((hash << 5) - hash) + filmId.charCodeAt(i);
                hash = hash & hash; // Convert to 32bit integer
              }
              // Return a pseudo-random number between 0 and 1
              return Math.abs(Math.sin(hash) * 10000) % 1;
            };
            
            // Get eligible films (released this year or last year, with good scores)
            const eligibleFilms = allFilms.filter(f => 
              f.phase === 'released' && 
              f.criticScore !== null && 
              f.criticScore !== undefined &&
              (f.releaseYear === currentYear || f.releaseYear === currentYear - 1)
            );
            
            // Oscar-friendly genres boost
            const oscarGenreBoost: Record<string, number> = {
              'drama': 20, 'biography': 18, 'historical': 15, 'romance': 8,
              'comedy': 5, 'musicals': 10, 'thriller': 3, 'scifi': 2,
              'animation': 5, 'action': 0, 'horror': -5, 'fantasy': 0
            };
            
            // Score films for general Oscar potential (with seeded random for stability)
            const scoredFilms = eligibleFilms.map(film => {
              const studio = studioMap.get(film.studioId);
              const director = film.directorId ? talentMap.get(film.directorId) : null;
              const criticScore = film.criticScore || 0;
              const genreBoost = oscarGenreBoost[film.genre] || 0;
              const boxOfficeBonus = Math.min(10, Math.log10(Math.max(1, film.totalBoxOffice) / 1000000) * 2);
              // Use seeded random instead of Math.random() for stable predictions
              const randomFactor = (seededRandom(film.id) - 0.5) * 30;
              const oscarScore = criticScore + genreBoost + boxOfficeBonus + randomFactor;
              
              // Get lead/supporting actor/actress from enriched film data (based on role importance)
              const leadActorId = (film as any).leadActorId as string | null;
              const leadActressId = (film as any).leadActressId as string | null;
              const supportingActorId = (film as any).supportingActorId as string | null;
              const supportingActressId = (film as any).supportingActressId as string | null;
              
              const leadActor = leadActorId ? talentMap.get(leadActorId) : null;
              const leadActress = leadActressId ? talentMap.get(leadActressId) : null;
              const supportingActor = supportingActorId ? talentMap.get(supportingActorId) : null;
              const supportingActress = supportingActressId ? talentMap.get(supportingActressId) : null;
              
              return {
                film,
                studioName: studio?.name || 'Unknown Studio',
                directorName: director?.name || 'Unknown Director',
                leadActorName: leadActor?.name || 'Unknown Actor',
                leadActressName: leadActress?.name || 'Unknown Actress',
                supportingActorName: supportingActor?.name || 'Unknown Actor',
                supportingActressName: supportingActress?.name || 'Unknown Actress',
                oscarScore,
                criticScore
              };
            });
            
            // Helper to get top N for a category with winner (uses category-specific seeded random)
            const getTopNominees = (films: typeof scoredFilms, count: number = 5, categoryOffset: number = 0) => {
              // Re-score with category-specific offset for variety between categories
              const categoryScored = films.map(f => ({
                ...f,
                categoryScore: f.oscarScore + (seededRandom(f.film.id, categoryOffset) - 0.5) * 15
              }));
              const sorted = [...categoryScored].sort((a, b) => b.categoryScore - a.categoryScore);
              const nominees = sorted.slice(0, count);
              const winner = nominees[0];
              return { nominees: nominees.sort((a, b) => a.film.title.localeCompare(b.film.title)), winner };
            };
            
            // Category-specific filtering
            const animatedFilms = scoredFilms.filter(f => f.film.genre === 'animation');
            const vfxFilms = scoredFilms.filter(f => (f.film.practicalEffectsBudget || 0) > 5000000 || ['scifi', 'fantasy', 'action', 'animation'].includes(f.film.genre));
            
            // Get predictions for each category (with unique category offsets for variety)
            // Animation is ONLY eligible for Score and Animated Feature
            const nonAnimatedFilms = scoredFilms.filter(f => f.film.genre !== 'animation');
            
            // For acting categories, only include films with eligible actors for that category
            const filmsWithLeadActor = nonAnimatedFilms.filter(f => f.leadActorName !== 'Unknown Actor');
            const filmsWithLeadActress = nonAnimatedFilms.filter(f => f.leadActressName !== 'Unknown Actress');
            const filmsWithSupportingActor = nonAnimatedFilms.filter(f => f.supportingActorName !== 'Unknown Actor');
            const filmsWithSupportingActress = nonAnimatedFilms.filter(f => f.supportingActressName !== 'Unknown Actress');
            
            const bestPicture = getTopNominees(nonAnimatedFilms, 10, 1);
            const bestDirector = getTopNominees(nonAnimatedFilms, 5, 2);
            const bestActor = getTopNominees(filmsWithLeadActor, 5, 3);
            const bestActress = getTopNominees(filmsWithLeadActress, 5, 4);
            const bestSuppActor = getTopNominees(filmsWithSupportingActor, 5, 5);
            const bestSuppActress = getTopNominees(filmsWithSupportingActress, 5, 6);
            const bestOrigScreenplay = getTopNominees(nonAnimatedFilms.filter(f => !f.film.title.match(/\s[2-9]$|\sII|III|IV|Part\s/i)), 5, 7);
            const bestAnimated = getTopNominees(animatedFilms, 5, 8);
            const bestCinematography = getTopNominees(nonAnimatedFilms, 5, 9);
            const bestEditing = getTopNominees(nonAnimatedFilms, 5, 10);
            const bestProdDesign = getTopNominees(nonAnimatedFilms.filter(f => (f.film.setsBudget || 0) > 3000000), 5, 11);
            const bestCostume = getTopNominees(nonAnimatedFilms.filter(f => (f.film.costumesBudget || 0) > 1000000), 5, 12);
            const bestMakeup = getTopNominees(nonAnimatedFilms.filter(f => (f.film.makeupBudget || 0) > 500000), 5, 13);
            const bestVFX = getTopNominees(vfxFilms.filter(f => f.film.genre !== 'animation'), 5, 14);
            const bestScore = getTopNominees(scoredFilms, 5, 15); // Animation IS eligible for Score
            
            // Render a category section - different display for different category types
            type CategoryType = 'film' | 'director' | 'actor' | 'actress' | 'supporting_actor' | 'supporting_actress' | 'screenplay' | 'score' | 'technical';
            const renderCategory = (title: string, data: { nominees: typeof scoredFilms, winner: typeof scoredFilms[0] | undefined }, categoryType: CategoryType = 'film') => {
              if (data.nominees.length === 0) return null;
              return (
                <div className="space-y-2">
                  <h3 className="font-bold text-lg border-b pb-2">{title}</h3>
                  <div className="space-y-1">
                    {data.nominees.map(({ film, studioName, directorName, leadActorName, leadActressName, supportingActorName, supportingActressName }) => {
                      // Determine what name to show based on category type
                      let displayName = `"${film.title}"`;
                      let subText = studioName;
                      
                      if (categoryType === 'director') {
                        displayName = directorName;
                        subText = `"${film.title}"`;
                      } else if (categoryType === 'actor') {
                        // Best Actor - lead male role
                        displayName = leadActorName;
                        subText = `"${film.title}"`;
                      } else if (categoryType === 'actress') {
                        // Best Actress - lead female role
                        displayName = leadActressName;
                        subText = `"${film.title}"`;
                      } else if (categoryType === 'supporting_actor') {
                        // Best Supporting Actor - supporting male role
                        displayName = supportingActorName;
                        subText = `"${film.title}"`;
                      } else if (categoryType === 'supporting_actress') {
                        // Best Supporting Actress - supporting female role
                        displayName = supportingActressName;
                        subText = `"${film.title}"`;
                      } else if (categoryType === 'screenplay') {
                        displayName = `"${film.title}"`;
                        subText = studioName;
                      } else if (categoryType === 'score') {
                        displayName = `"${film.title}"`;
                        subText = studioName;
                      }
                      
                      return (
                        <div key={film.id} className="flex items-center py-1 hover:bg-muted/30 rounded px-2 cursor-pointer" onClick={() => navigate(`/film/${film.id}`)}>
                          <span className="font-medium">{displayName}</span>
                          <span className="text-muted-foreground ml-2">{subText}</span>
                          {data.winner && film.id === data.winner.film.id && (
                            <span className="text-yellow-500 font-bold ml-2">★★★</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Oscar Predictions {isUpdated && <Badge variant="secondary">Updated Predictions</Badge>}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-yellow-600 font-semibold">★★★</span> = PREDICTED WINNER
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    (All predicted nominees listed below are in alphabetical order)
                  </p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-6">
                      {renderCategory('Best Picture', bestPicture, 'film')}
                      {renderCategory('Best Director', bestDirector, 'director')}
                      {renderCategory('Best Actor', bestActor, 'actor')}
                      {renderCategory('Best Actress', bestActress, 'actress')}
                      {renderCategory('Best Supporting Actor', bestSuppActor, 'supporting_actor')}
                      {renderCategory('Best Supporting Actress', bestSuppActress, 'supporting_actress')}
                      {renderCategory('Best Original Screenplay', bestOrigScreenplay, 'screenplay')}
                      {bestAnimated.nominees.length > 0 && renderCategory('Best Animated Feature', bestAnimated, 'film')}
                      {renderCategory('Best Cinematography', bestCinematography, 'technical')}
                      {renderCategory('Best Film Editing', bestEditing, 'technical')}
                      {renderCategory('Best Production Design', bestProdDesign, 'technical')}
                      {renderCategory('Best Costume Design', bestCostume, 'technical')}
                      {renderCategory('Best Makeup and Hairstyling', bestMakeup, 'technical')}
                      {bestVFX.nominees.length > 0 && renderCategory('Best Visual Effects', bestVFX, 'technical')}
                      {renderCategory('Best Original Score', bestScore, 'score')}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
