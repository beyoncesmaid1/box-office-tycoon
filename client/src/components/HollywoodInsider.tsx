import { useState, useMemo, useEffect } from 'react';
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
import type { Film, Studio, Talent, AwardNomination, FilmRelease } from '@shared/schema';

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

  const [allReleases, setAllReleases] = useState<FilmRelease[]>([]);
  
  // Fetch all releases directly (same pattern as FilmDetail)
  useEffect(() => {
    fetch('/api/all-releases')
      .then(res => res.json())
      .then(releases => {
        // Ensure we have an array
        if (Array.isArray(releases)) {
          setAllReleases(releases);
        } else {
          console.error('Releases is not an array:', releases);
          setAllReleases([]);
        }
      })
      .catch(err => {
        console.error('Error fetching releases:', err);
        setAllReleases([]);
      });
  }, []);

  const studioMap = useMemo(() => new Map(allStudios.map(s => [s.id, s])), [allStudios]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);
  
  // Create a map of filmId to marketing budget from releases
  const marketingBudgetMap = useMemo(() => {
    const map = new Map<string, number>();
    allReleases.forEach(release => {
      if (release.marketingBudget && release.marketingBudget > 0) {
        // Only set if not already set (first release with marketing budget wins)
        if (!map.has(release.filmId)) {
          map.set(release.filmId, release.marketingBudget);
        }
      }
    });
    return map;
  }, [allReleases]);

  // Get available years for filtering
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allFilms.forEach(f => {
      if (f.releaseYear) years.add(f.releaseYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allFilms]);

  // Process films with stats
  const filmsWithStats: FilmWithStats[] = useMemo(() => {
    return allFilms
      .filter(f => f.phase === 'released' && f.totalBoxOffice > 0)
      .map(film => {
        const studio = studioMap.get(film.studioId);
        const director = film.directorId ? talentMap.get(film.directorId) : null;
        
        // Calculate domestic (NA) vs international
        const totalByCountry = film.totalBoxOfficeByCountry as Record<string, number> | null;
        const domesticGross = totalByCountry?.['North America'] || totalByCountry?.['NA'] || 
          Math.floor(film.totalBoxOffice * 0.4); // Default 40% domestic
        const internationalGross = film.totalBoxOffice - domesticGross;
        
        // Use totalBudget which includes all production costs
        // For marketing budget, check releases first (for player films), then fall back to film.marketingBudget
        const marketingBudget = marketingBudgetMap.get(film.id) || film.marketingBudget || 0;
        const investmentBudget = (film.totalBudget || 0) + marketingBudget;
        
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
  }, [allFilms, studioMap, talentMap, marketingBudgetMap]);

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
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
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
                      <th className="py-3 px-2 text-right">Budget</th>
                      <th className="py-3 px-2 text-right">ROI</th>
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
                        <td className="py-3 px-2 text-right">
                          <span className={`font-mono text-sm ${film.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {film.roi >= 0 ? '+' : ''}{film.roi.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredFilms.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
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
                    <div key={talent.id} className="p-4 rounded-lg border border-border">
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
                              <h3 className="font-semibold text-lg">{talent.name}</h3>
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
      </Tabs>
    </div>
  );
}
