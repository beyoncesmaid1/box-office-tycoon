import { useContext, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Play, ShoppingBag, Tv, Sparkles, MonitorPlay, TrendingUp, Film, DollarSign, Users, Clock, Check, AlertCircle, Eye, BarChart3, ChevronRight, ChevronLeft, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GameContext, formatMoney, formatWeekDate } from '@/lib/gameState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Film as FilmType, StreamingService, StreamingDeal, TVShow } from '@shared/schema';

const iconMap: Record<string, typeof Play> = {
  Play: Play,
  ShoppingBag: ShoppingBag,
  Tv: Tv,
  Sparkles: Sparkles,
  MonitorPlay: MonitorPlay,
};

function getServiceIcon(logo: string) {
  return iconMap[logo] || Play;
}

function StreamingServiceCard({ service, films, currentWeek, currentYear, studioId, activeDeals }: { 
  service: StreamingService; 
  films: FilmType[];
  currentWeek: number;
  currentYear: number;
  studioId: string;
  activeDeals: StreamingDeal[];
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const Icon = getServiceIcon(service.logo);
  
  // Get IDs of films that already have active streaming deals
  const licensedFilmIds = new Set(activeDeals.filter(d => d.isActive).map(d => d.filmId));
  
  const eligibleFilms = films.filter(film => {
    if (film.phase !== 'released') return false;
    // Exclude films that already have an active streaming deal
    if (licensedFilmIds.has(film.id)) return false;
    // Audience score is on 1-10 scale, critic score is on 0-100 scale
    // Normalize audience score to 0-100 scale by multiplying by 10
    const normalizedAudienceScore = (film.audienceScore || 0) * 10;
    const qualityScore = normalizedAudienceScore + (film.criticScore || 0);
    const avgQuality = qualityScore / 2;
    return avgQuality >= (service.minimumQualityScore ?? 50);
  });

  const calculateLicenseFee = (film: FilmType) => {
    const boxOffice = film.totalBoxOffice || 0;
    // Normalize audience score to 0-100 scale
    const normalizedAudienceScore = (film.audienceScore || 0) * 10;
    const qualityScore = (normalizedAudienceScore + (film.criticScore || 0)) / 2;
    const genreMatch = service.genrePreferences?.includes(film.genre) ? 1.2 : 1.0;
    const multiplier = service.licenseFeeMultiplier ?? 1.0;
    
    const baseFee = boxOffice * 0.15;
    const qualityBonus = baseFee * (qualityScore / 100) * 0.3;
    return Math.round((baseFee + qualityBonus) * genreMatch * multiplier);
  };

  const acceptDealMutation = useMutation({
    mutationFn: async ({ filmId, licenseFee }: { filmId: string; licenseFee: number }) => {
      return await apiRequest('POST', '/api/streaming-deals', {
        filmId,
        streamingServiceId: service.id,
        playerGameId: studioId,
        licenseFee,
        startWeek: currentWeek,
        startYear: currentYear,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
      toast({
        title: 'Deal Accepted!',
        description: `Your film is now streaming on ${service.name}.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to accept streaming deal.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Card className="overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:opacity-90 transition-opacity group" 
        style={{ backgroundColor: service.color }}
        onClick={() => navigate(`/streaming/${service.id}`)}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-xl text-white">{service.name}</h3>
            <p className="text-sm text-white/80">{service.subscriberCount}M subscribers</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Subscribers:</span>
              <span className="font-medium">{service.subscriberCount}M</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">ARPU:</span>
              <span className="font-medium">${service.monthlyRevenuePerSub}/mo</span>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-2">Genre Preferences:</p>
            <div className="flex flex-wrap gap-1">
              {service.genrePreferences?.map((genre) => (
                <Badge key={genre} variant="secondary" className="text-xs capitalize">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-sm font-medium mb-3">Available Licensing Deals</p>
            {eligibleFilms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eligible films. Films need quality score of {service.minimumQualityScore ?? 50}+.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {eligibleFilms.map((film) => {
                  const licenseFee = calculateLicenseFee(film);
                  return (
                    <div key={film.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{film.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{film.genre}</p>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" data-testid={`button-license-${film.id}`}>
                            {formatMoney(licenseFee)}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>License "{film.title}" to {service.name}?</DialogTitle>
                          </DialogHeader>
                          <div className="py-4 space-y-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">License Fee:</span>
                              <span className="font-display text-lg text-primary">{formatMoney(licenseFee)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Streaming Platform:</span>
                              <span>{service.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">License Duration:</span>
                              <span>2 years</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subscribers Reached:</span>
                              <span>{service.subscriberCount}M</span>
                            </div>
                            <p className="text-sm text-muted-foreground pt-2">
                              This licensing deal is a one-time payment. Your film will be available on {service.name} for 2 years.
                            </p>
                          </div>
                          <DialogFooter className="gap-2">
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button 
                                onClick={() => acceptDealMutation.mutate({ filmId: film.id, licenseFee })}
                                disabled={acceptDealMutation.isPending}
                                data-testid={`button-confirm-license-${film.id}`}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Accept Deal
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type GlobalStreamingContent = {
  deal: StreamingDeal;
  film: FilmType;
  tvShow?: TVShow;
  studioName: string;
  isAI: boolean;
  serviceName: string;
  serviceId: string;
  serviceColor: string;
  contentType: 'movie' | 'tvshow';
};

function GlobalTop10Charts({ 
  content, 
  currentWeek, 
  currentYear 
}: { 
  content: GlobalStreamingContent[];
  currentWeek: number;
  currentYear: number;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('overall');

  const getViewsForWeek = (deal: StreamingDeal, offset: number): number => {
    const weeklyViews = deal.weeklyViews || [];
    if (weeklyViews.length === 0) return 0;
    const index = weeklyViews.length - 1 - offset;
    if (index < 0) return 0;
    return Number(weeklyViews[index]) || 0;
  };

  const filterAndSort = (items: GlobalStreamingContent[]) => {
    return items
      .filter(item => item.deal.isActive)
      .map(item => ({
        ...item,
        weekViews: getViewsForWeek(item.deal, weekOffset),
      }))
      .filter(item => item.weekViews > 0)
      .sort((a, b) => b.weekViews - a.weekViews)
      .slice(0, 10);
  };

  const allContent = filterAndSort(content);
  const moviesContent = filterAndSort(content.filter(c => c.contentType === 'movie'));
  const showsContent = filterAndSort(content.filter(c => c.contentType === 'tvshow'));

  const maxWeeksBack = Math.max(...content.map(c => c.deal.weeklyViews?.length || 0)) - 1;

  const displayWeek = currentWeek - weekOffset;
  const displayYear = displayWeek <= 0 ? currentYear - 1 : currentYear;
  const adjustedWeek = displayWeek <= 0 ? 52 + displayWeek : displayWeek;

  const weekStart = new Date(displayYear, 0, 1);
  weekStart.setDate(weekStart.getDate() + (adjustedWeek - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderTop10List = (items: (GlobalStreamingContent & { weekViews: number })[]) => {
    if (items.length === 0) {
      return (
        <div className="py-8 text-center text-zinc-500">
          <p>No streaming data available for this week</p>
        </div>
      );
    }

    const maxViews = items[0]?.weekViews || 1;

    return (
      <div className="space-y-1">
        {items.map((item, index) => {
          const { deal, film, tvShow, studioName, weekViews, serviceName, serviceColor, contentType } = item;
          const weeksActive = deal.weeksActive || 0;
          const weeksInTop10 = Math.min(weeksActive, 10);
          const episodeCount = contentType === 'tvshow' && tvShow ? (tvShow as any).episodesPerSeason || 8 : 1;
          
          return (
            <div 
              key={deal.id}
              className="grid grid-cols-[40px_1fr_100px_80px_120px] gap-4 items-center py-2 px-2 rounded hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center justify-center">
                <span className={`text-2xl font-bold ${index < 3 ? 'text-red-500' : 'text-zinc-400'}`}>
                  {index + 1}
                </span>
              </div>
              
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{film.title}</p>
                  <p className="text-xs text-zinc-400 truncate">{studioName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-300 font-medium w-6 text-center">{weeksInTop10}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(weeksInTop10, 10) }).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 h-3 rounded-sm"
                      style={{ backgroundColor: serviceColor }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="text-center text-xs text-zinc-400">
                {episodeCount}
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {(weekViews / 1000000).toFixed(1)}M
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(Math.max((weekViews / maxViews) * 100, 5), 100)}%`,
                      backgroundColor: serviceColor
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (content.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 text-white border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="w-5 h-5 text-amber-500" />
            Global Streaming Charts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setWeekOffset(prev => Math.min(prev + 1, Math.max(maxWeeksBack, 0)))}
              disabled={weekOffset >= maxWeeksBack}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center min-w-[180px]">
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/90 text-sm font-medium">
                <span>{formatDate(weekStart)} - {formatDate(weekEnd)}, {displayYear}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setWeekOffset(prev => Math.max(prev - 1, 0))}
              disabled={weekOffset <= 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-800 mb-4">
            <TabsTrigger value="overall" className="data-[state=active]:bg-amber-600">
              Top 10 Overall
            </TabsTrigger>
            <TabsTrigger value="movies" className="data-[state=active]:bg-blue-600">
              Top 10 Movies
            </TabsTrigger>
            <TabsTrigger value="shows" className="data-[state=active]:bg-purple-600">
              Top 10 Shows
            </TabsTrigger>
          </TabsList>
          
          <div className="border-b border-zinc-700 pb-2 mb-2">
            <div className="grid grid-cols-[40px_1fr_100px_80px_120px] gap-4 text-xs text-zinc-400 uppercase tracking-wide">
              <span>#</span>
              <span>Program</span>
              <span className="text-center">Weeks in Top 10</span>
              <span className="text-center"># Episodes</span>
              <span className="text-right">Minutes (Millions)</span>
            </div>
          </div>
          
          <TabsContent value="overall" className="mt-0">
            {renderTop10List(allContent)}
          </TabsContent>
          <TabsContent value="movies" className="mt-0">
            {renderTop10List(moviesContent)}
          </TabsContent>
          <TabsContent value="shows" className="mt-0">
            {renderTop10List(showsContent)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ActiveDealsSection({ deals, films, services }: { 
  deals: StreamingDeal[]; 
  films: FilmType[];
  services: StreamingService[];
}) {
  if (deals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="font-medium mb-2">No Active Streaming Deals</h3>
        <p className="text-sm text-muted-foreground">License your released films to streaming services to earn additional revenue.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => {
        const film = films.find(f => f.id === deal.filmId);
        const service = services.find(s => s.id === deal.streamingServiceId);
        if (!film || !service) return null;
        const Icon = getServiceIcon(service.logo);

        return (
          <Card key={deal.id} className="overflow-hidden">
            <div className="h-2" style={{ backgroundColor: service.color }} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{film.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">{film.genre}</p>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: service.color }}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform:</span>
                  <span>{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License Fee:</span>
                  <span className="text-primary font-medium">{formatMoney(deal.licenseFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Total Views:
                  </span>
                  <span className="font-medium">{((deal.totalViews || 0) / 1000000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    Streaming Revenue:
                  </span>
                  <span className="text-green-500 font-medium">{formatMoney(deal.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weeks Active:</span>
                  <span>{deal.weeksActive || 0} / {(deal.licenseYears || 2) * 52}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={deal.isActive ? 'default' : 'secondary'}>
                    {deal.isActive ? 'Active' : 'Completed'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function StreamingPage() {
  const gameContext = useContext(GameContext);
  
  if (!gameContext) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { state } = gameContext;

  const { data: services = [], isLoading: servicesLoading } = useQuery<StreamingService[]>({
    queryKey: ['/api/streaming-services'],
  });

  const { data: films = [], isLoading: filmsLoading } = useQuery<FilmType[]>({
    queryKey: ['/api/studio', state.studioId, 'films'],
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery<StreamingDeal[]>({
    queryKey: ['/api/streaming-deals', state.studioId],
    queryFn: async () => {
      const response = await fetch(`/api/streaming-deals?playerGameId=${state.studioId}`);
      if (!response.ok) throw new Error('Failed to fetch streaming deals');
      return response.json();
    },
  });

  const { data: allStreamingContent = [] } = useQuery<GlobalStreamingContent[]>({
    queryKey: ['/api/streaming-deals/all-content', state.studioId],
    queryFn: async () => {
      const response = await fetch(`/api/streaming-deals/all-content?playerGameId=${state.studioId}`);
      if (!response.ok) throw new Error('Failed to fetch streaming content');
      return response.json();
    },
  });

  const releasedFilms = films.filter(f => f.phase === 'released');
  const totalStreamingRevenue = deals.reduce((sum, deal) => sum + (deal.totalRevenue || 0), 0);
  const totalStreamingViews = deals.reduce((sum, deal) => sum + (deal.totalViews || 0), 0);

  if (servicesLoading || filmsLoading || dealsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="font-display text-3xl mb-2">Streaming Distribution</h1>
        <p className="text-muted-foreground">License your films to streaming platforms for additional revenue.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tv className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Platforms</p>
              <p className="font-display text-2xl">{services.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Film className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Released Films</p>
              <p className="font-display text-2xl">{releasedFilms.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Deals</p>
              <p className="font-display text-2xl">{deals.filter(d => d.isActive).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="font-display text-2xl">{(totalStreamingViews / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Streaming Revenue</p>
              <p className="font-display text-2xl text-primary">{formatMoney(totalStreamingRevenue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {allStreamingContent.length > 0 && (
        <GlobalTop10Charts 
          content={allStreamingContent}
          currentWeek={state.currentWeek}
          currentYear={state.currentYear}
        />
      )}

      <div>
        <h2 className="font-display text-xl mb-4">Streaming Platforms</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <StreamingServiceCard 
              key={service.id} 
              service={service} 
              films={releasedFilms}
              currentWeek={state.currentWeek}
              currentYear={state.currentYear}
              studioId={state.studioId}
              activeDeals={deals}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl mb-4">Your Streaming Deals</h2>
        <ActiveDealsSection deals={deals} films={films} services={services} />
      </div>
    </div>
  );
}
