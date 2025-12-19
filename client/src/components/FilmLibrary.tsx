import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Grid3X3, List, Star, Award, Search, SortAsc, SortDesc, Loader2, Zap, Tv, Megaphone, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGame, formatMoney, genreColors, genreLabels, type FilmWithTalent } from '@/lib/gameState';
import { useToast } from '@/hooks/use-toast';
import { RatingDisplay } from './RatingDisplay';

type ViewMode = 'grid' | 'list';
type SortField = 'title' | 'boxOffice' | 'rating' | 'releaseDate';

interface FilmCardProps {
  film: FilmWithTalent;
  onClick: () => void;
}

function FilmCard({ film, onClick }: FilmCardProps) {
  const profit = film.totalBoxOffice * 0.5 - film.totalBudget;
  const isProfitable = profit > 0;
  
  // Genre-based fallback posters
  const genreBackgrounds: Record<string, string> = {
    action: 'linear-gradient(135deg, rgba(153, 0, 0, 0.9), rgba(80, 0, 0, 0.9))',
    comedy: 'linear-gradient(135deg, rgba(184, 134, 11, 0.9), rgba(139, 90, 0, 0.9))',
    drama: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(25, 0, 51, 0.9))',
    horror: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(75, 0, 130, 0.9))',
    scifi: 'linear-gradient(135deg, rgba(0, 128, 128, 0.9), rgba(0, 51, 102, 0.9))',
    romance: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(128, 0, 32, 0.9))',
    thriller: 'linear-gradient(135deg, rgba(40, 40, 40, 0.95), rgba(0, 0, 0, 0.95))',
    animation: 'linear-gradient(135deg, rgba(65, 105, 225, 0.9), rgba(25, 25, 112, 0.9))',
    fantasy: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(75, 0, 130, 0.9))',
    musicals: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(138, 43, 226, 0.9))',
  };

  const fallbackBg = genreBackgrounds[film.genre] || 'linear-gradient(135deg, rgba(64, 64, 64, 0.9), rgba(40, 40, 40, 0.9))';
  const posterUrl = film.posterUrl || '';

  return (
    <Card className="hover-elevate cursor-pointer overflow-hidden" onClick={onClick} data-testid={`card-library-film-${film.id}`}>
      <div 
        className="aspect-[2/3] relative flex items-end justify-start p-3"
        style={{
          backgroundImage: posterUrl ? `url(${posterUrl})` : fallbackBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'rgb(40, 40, 40)',
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        
        {/* Content */}
        <div className="relative z-10 w-full">
          <h3 className="font-medium text-white truncate text-sm mb-2" data-testid={`text-library-title-${film.id}`}>{film.title}</h3>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={genreColors[film.genre]}>
              {genreLabels[film.genre]}
            </Badge>
            {film.awards.length > 0 && (
              <Badge className="bg-yellow-500 text-gray-900 font-bold">
                <Award className="w-3 h-3 mr-1" />
                {film.awards.length}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Status badge */}
        {film.status === 'archived' && (
          <div className="absolute top-2 left-2 z-20">
            <Badge className="bg-gray-600 text-white text-xs">Finished</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

function FilmListRow({ film, onClick }: FilmCardProps) {
  const profit = film.totalBoxOffice * 0.5 - film.totalBudget;
  const isProfitable = profit > 0;
  
  // Genre-based fallback posters
  const genreBackgrounds: Record<string, string> = {
    action: 'linear-gradient(135deg, rgba(153, 0, 0, 0.9), rgba(80, 0, 0, 0.9))',
    comedy: 'linear-gradient(135deg, rgba(184, 134, 11, 0.9), rgba(139, 90, 0, 0.9))',
    drama: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(25, 0, 51, 0.9))',
    horror: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(75, 0, 130, 0.9))',
    scifi: 'linear-gradient(135deg, rgba(0, 128, 128, 0.9), rgba(0, 51, 102, 0.9))',
    romance: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(128, 0, 32, 0.9))',
    thriller: 'linear-gradient(135deg, rgba(40, 40, 40, 0.95), rgba(0, 0, 0, 0.95))',
    animation: 'linear-gradient(135deg, rgba(65, 105, 225, 0.9), rgba(25, 25, 112, 0.9))',
    fantasy: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(75, 0, 130, 0.9))',
    musicals: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(138, 43, 226, 0.9))',
  };
  
  const fallbackBg = genreBackgrounds[film.genre] || 'linear-gradient(135deg, rgba(64, 64, 64, 0.9), rgba(40, 40, 40, 0.9))';
  const posterUrl = film.posterUrl || '';

  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-lg hover-elevate cursor-pointer border border-border"
      onClick={onClick}
      data-testid={`row-library-film-${film.id}`}
    >
      <div 
        className="w-16 h-24 rounded flex-shrink-0 relative overflow-hidden"
        style={{
          backgroundImage: posterUrl ? `url(${posterUrl})` : fallbackBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'rgb(40, 40, 40)',
        }}
      >
        {film.status === 'archived' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-xs font-bold text-white">Finished</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{film.title}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className={genreColors[film.genre]}>
            {genreLabels[film.genre]}
          </Badge>
          {film.awards.length > 0 && (
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              <Award className="w-3 h-3 mr-1" />
              {film.awards.length} awards
            </Badge>
          )}
        </div>
      </div>

      <div className="text-right hidden md:block">
        <p className="text-sm text-muted-foreground">Box Office</p>
        <p className="font-medium">{formatMoney(film.totalBoxOffice)}</p>
      </div>

      <div className="text-right hidden md:block">
        <p className="text-sm text-muted-foreground">Budget</p>
        <p className="font-medium">{formatMoney(film.totalBudget)}</p>
      </div>

      <div className="text-right hidden lg:block">
        <p className="text-sm text-muted-foreground">Profit</p>
        <p className={`font-medium ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isProfitable ? '+' : ''}{formatMoney(profit)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-primary fill-primary" />
        <span className="font-medium">{film.audienceScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function FilmLibrary() {
  const { state } = useGame();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('releaseDate');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedFilm, setSelectedFilm] = useState<FilmWithTalent | null>(null);
  const [streamingRevenue, setStreamingRevenue] = useState<number>(0);
  const [actualMarketingBudget, setActualMarketingBudget] = useState<number>(0);
  const [isChangingPoster, setIsChangingPoster] = useState(false);
  const [newPosterUrl, setNewPosterUrl] = useState('');
  const posterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFilm) {
      fetch(`/api/streaming-deals/film/${selectedFilm.id}`)
        .then(res => res.json())
        .then(deals => {
          const totalStreamingRevenue = deals.reduce((sum: number, deal: any) => {
            if (deal.totalRevenue && deal.totalRevenue > 0) {
              return sum + deal.totalRevenue;
            }
            const weeklySum = Array.isArray(deal.weeklyRevenue) 
              ? deal.weeklyRevenue.reduce((a: number, b: number) => a + b, 0) 
              : 0;
            return sum + (deal.licenseFee || 0) + weeklySum;
          }, 0);
          setStreamingRevenue(totalStreamingRevenue);
        })
        .catch(() => setStreamingRevenue(0));
      
      fetch(`/api/films/${selectedFilm.id}/releases`)
        .then(res => res.json())
        .then(releases => {
          const releaseWithMarketing = releases.find((r: any) => r.marketingBudget && r.marketingBudget > 0);
          const marketingFromReleases = releaseWithMarketing?.marketingBudget || 0;
          setActualMarketingBudget(marketingFromReleases || selectedFilm.marketingBudget || 0);
        })
        .catch(() => setActualMarketingBudget(selectedFilm.marketingBudget || 0));
    } else {
      setStreamingRevenue(0);
      setActualMarketingBudget(0);
    }
  }, [selectedFilm]);

  const startSequelDevelopment = async (film: FilmWithTalent) => {
    try {
      // Fetch the original film's roles
      const rolesRes = await fetch(`/api/films/${film.id}/roles`);
      const originalRoles = await rolesRes.json();
      
      // Store film data
      localStorage.setItem('sequelOriginalFilm', JSON.stringify({
        id: film.id,
        title: film.title,
        genre: film.genre,
        synopsis: film.synopsis,
        directorId: film.directorId,
        writerId: film.writerId,
        productionBudget: film.productionBudget,
        marketingBudget: film.marketingBudget,
        totalBoxOffice: film.totalBoxOffice,
      }));
      
      // Store the roles
      localStorage.setItem('sequelOriginalRoles', JSON.stringify(originalRoles));
      
      toast({
        title: "Starting sequel development",
        description: `Create the sequel to "${film.title}" through the full development process.`,
      });
      setSelectedFilm(null);
      navigate('/develop?sequel=true');
    } catch (error) {
      console.error('Failed to fetch roles for sequel:', error);
      toast({
        title: "Error",
        description: "Failed to load original film's roles. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePoster = async () => {
    if (!selectedFilm || !newPosterUrl.trim()) return;
    
    try {
      const response = await fetch(`/api/films/${selectedFilm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterUrl: newPosterUrl.trim() }),
      });
      
      if (response.ok) {
        toast({
          title: "Poster updated",
          description: `Poster for "${selectedFilm.title}" has been changed.`,
        });
        setIsChangingPoster(false);
        setNewPosterUrl('');
        // Update local state
        setSelectedFilm({ ...selectedFilm, posterUrl: newPosterUrl.trim() });
      } else {
        throw new Error('Failed to update poster');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update poster. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const allFilms = [...state.releasedFilms, ...state.films.filter(f => f.phase === 'released')];

  const filteredFilms = allFilms
    .filter(film => 
      film.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      genreLabels[film.genre].toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'boxOffice':
          comparison = a.totalBoxOffice - b.totalBoxOffice;
          break;
        case 'rating':
          comparison = a.audienceScore - b.audienceScore;
          break;
        case 'releaseDate':
          comparison = (a.releaseWeek || 0) - (b.releaseWeek || 0);
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

  // Stats
  const totalGross = allFilms.reduce((acc, f) => acc + f.totalBoxOffice, 0);
  const totalProfit = allFilms.reduce((acc, f) => acc + (f.totalBoxOffice * 0.5 - f.totalBudget), 0);
  const avgRating = allFilms.length > 0 
    ? allFilms.reduce((acc, f) => acc + f.audienceScore, 0) / allFilms.length 
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">Film Library</h2>
        <p className="text-muted-foreground mt-1">Your complete filmography</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Films</p>
            <p className="font-display text-2xl">{allFilms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Gross</p>
            <p className="font-display text-2xl">{formatMoney(totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Profit</p>
            <p className={`font-display text-2xl ${totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Average Rating</p>
            <p className="font-display text-2xl flex items-center gap-2">
              <Star className="w-5 h-5 text-primary fill-primary" />
              {avgRating.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search films..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-films"
          />
        </div>
        
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-40" data-testid="select-sort-field">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="releaseDate">Release Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="boxOffice">Box Office</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setSortDesc(!sortDesc)}
          data-testid="button-sort-direction"
        >
          {sortDesc ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
        </Button>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <Button
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('grid')}
            className="rounded-none"
            data-testid="button-view-grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('list')}
            className="rounded-none"
            data-testid="button-view-list"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Film Grid/List */}
      {filteredFilms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No films match your search' : 'No films released yet'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFilms.map(film => (
            <FilmCard key={film.id} film={film} onClick={() => setSelectedFilm(film)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFilms.map(film => (
            <FilmListRow key={film.id} film={film} onClick={() => setSelectedFilm(film)} />
          ))}
        </div>
      )}

      {/* Film Detail Dialog */}
      <Dialog open={!!selectedFilm} onOpenChange={() => setSelectedFilm(null)}>
        <DialogContent className="max-w-2xl">
          {selectedFilm && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{selectedFilm.title}</DialogTitle>
              </DialogHeader>
              
              <div className="grid md:grid-cols-3 gap-6">
                {(() => {
                  const genreBackgrounds: Record<string, string> = {
                    action: 'linear-gradient(135deg, rgba(153, 0, 0, 0.9), rgba(80, 0, 0, 0.9))',
                    comedy: 'linear-gradient(135deg, rgba(184, 134, 11, 0.9), rgba(139, 90, 0, 0.9))',
                    drama: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(25, 0, 51, 0.9))',
                    horror: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(75, 0, 130, 0.9))',
                    scifi: 'linear-gradient(135deg, rgba(0, 128, 128, 0.9), rgba(0, 51, 102, 0.9))',
                    romance: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(128, 0, 32, 0.9))',
                    thriller: 'linear-gradient(135deg, rgba(40, 40, 40, 0.95), rgba(0, 0, 0, 0.95))',
                    animation: 'linear-gradient(135deg, rgba(65, 105, 225, 0.9), rgba(25, 25, 112, 0.9))',
                    fantasy: 'linear-gradient(135deg, rgba(75, 0, 130, 0.9), rgba(75, 0, 130, 0.9))',
                    musicals: 'linear-gradient(135deg, rgba(199, 21, 133, 0.9), rgba(138, 43, 226, 0.9))',
                  };
                  const fallbackBg = genreBackgrounds[selectedFilm.genre] || 'linear-gradient(135deg, rgba(64, 64, 64, 0.9), rgba(40, 40, 40, 0.9))';
                  const posterUrl = selectedFilm.posterUrl || '';
                  
                  return (
                    <div className="space-y-2">
                      <div 
                        className="aspect-[2/3] rounded-lg overflow-hidden"
                        style={{
                          backgroundImage: posterUrl ? `url(${posterUrl})` : fallbackBg,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: 'rgb(40, 40, 40)',
                        }}
                      />
                      {isChangingPoster ? (
                        <div className="space-y-2">
                          <Input
                            ref={posterInputRef}
                            placeholder="Enter image URL..."
                            value={newPosterUrl}
                            onChange={(e) => setNewPosterUrl(e.target.value)}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleChangePoster} className="flex-1">
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setIsChangingPoster(false); setNewPosterUrl(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setIsChangingPoster(true)}
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Change Poster
                        </Button>
                      )}
                    </div>
                  );
                })()}
                
                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className={genreColors[selectedFilm.genre]}>
                      {genreLabels[selectedFilm.genre]}
                    </Badge>
                    {selectedFilm.awards.map((award, i) => (
                      <Badge key={i} variant="secondary" className="bg-primary/20 text-primary">
                        <Award className="w-3 h-3 mr-1" />
                        {award}
                      </Badge>
                    ))}
                  </div>

                  <RatingDisplay 
                    audienceScore={selectedFilm.audienceScore}
                    criticScore={selectedFilm.criticScore}
                    voteCount={1000}
                    openingWeekend={selectedFilm.weeklyBoxOffice[0] || 0}
                    size="sm"
                  />

                  {selectedFilm.synopsis && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground font-semibold mb-2">Synopsis</p>
                      <p className="text-sm leading-relaxed text-foreground">{selectedFilm.synopsis}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Budget</p>
                      <p className="font-medium">{formatMoney(selectedFilm.totalBudget)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Box Office</p>
                      <p className="font-medium">{formatMoney(selectedFilm.totalBoxOffice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Megaphone className="w-3 h-3" />
                        Marketing Budget
                      </p>
                      <p className="font-medium">{formatMoney(actualMarketingBudget)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Tv className="w-3 h-3" />
                        Streaming Revenue
                      </p>
                      <p className="font-medium text-purple-500">{streamingRevenue > 0 ? formatMoney(streamingRevenue) : 'No deals yet'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Director</p>
                      <p className="font-medium">{selectedFilm.director?.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cast</p>
                      <p className="font-medium">
                        {(selectedFilm.cast?.length || 0) > 0 
                          ? selectedFilm.cast?.map(a => a.name).join(', ')
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => startSequelDevelopment(selectedFilm)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white mt-4"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Create Sequel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
