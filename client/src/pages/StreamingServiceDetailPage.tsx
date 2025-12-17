import { useContext, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Play, ShoppingBag, Tv, Sparkles, MonitorPlay, ArrowLeft, Film, Eye, Clock, TrendingUp, Calendar, DollarSign, Users, Check, Star, BarChart3, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GameContext, formatMoney } from '@/lib/gameState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Film as FilmType, StreamingService, StreamingDeal } from '@shared/schema';

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

const serviceThemes: Record<string, { 
  gradient: string; 
  bgPattern: string; 
  tagline: string;
  description: string;
}> = {
  'streamflix': {
    gradient: 'from-red-600 via-red-700 to-red-900',
    bgPattern: 'radial-gradient(circle at 20% 80%, rgba(255,0,0,0.1) 0%, transparent 50%)',
    tagline: 'Where Stories Come Alive',
    description: 'The premier destination for blockbuster entertainment. StreamFlix delivers the biggest hits straight to your screen.',
  },
  'primestream': {
    gradient: 'from-blue-500 via-blue-600 to-blue-800',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(0,150,255,0.1) 0%, transparent 50%)',
    tagline: 'Entertainment Without Limits',
    description: 'Unlimited access to a vast library of premium content. PrimeStream brings quality entertainment to every home.',
  },
  'cinemax-plus': {
    gradient: 'from-purple-600 via-purple-700 to-indigo-900',
    bgPattern: 'radial-gradient(circle at 50% 50%, rgba(150,0,255,0.1) 0%, transparent 50%)',
    tagline: 'Cinema Excellence, Streaming Perfection',
    description: 'For true film lovers. CineMax+ curates the finest in cinematic achievement.',
  },
  'galaxy-tv': {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-800',
    bgPattern: 'radial-gradient(circle at 30% 70%, rgba(0,255,200,0.1) 0%, transparent 50%)',
    tagline: 'A Universe of Content',
    description: 'Explore endless worlds of entertainment. Galaxy TV takes you on adventures across every genre.',
  },
  'aurora-stream': {
    gradient: 'from-orange-500 via-amber-600 to-yellow-700',
    bgPattern: 'radial-gradient(circle at 70% 30%, rgba(255,150,0,0.1) 0%, transparent 50%)',
    tagline: 'Illuminate Your Screen',
    description: 'Bright, bold, and brilliant content. Aurora Stream lights up your entertainment experience.',
  },
};

function FilmCard({ 
  film, 
  deal, 
  service,
  currentWeek,
  currentYear,
}: { 
  film: FilmType; 
  deal?: StreamingDeal;
  service: StreamingService;
  currentWeek: number;
  currentYear: number;
}) {
  const Icon = getServiceIcon(service.logo);
  const isActive = deal?.isActive;
  const weeklyViews = deal?.weeklyViews || [];
  const lastWeekViews = weeklyViews.length > 0 ? weeklyViews[weeklyViews.length - 1] : 0;
  const weeksRemaining = deal ? ((deal.licenseYears || 2) * 52) - (deal.weeksActive || 0) : 0;
  const progress = deal ? ((deal.weeksActive || 0) / ((deal.licenseYears || 2) * 52)) * 100 : 0;
  
  const expectedViews = service.subscriberCount * 1000000 * 0.50 * (deal?.licenseYears || 2);
  const viewPerformance = deal?.totalViews ? (Number(deal.totalViews) / expectedViews) * 100 : 0;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div 
        className="h-2" 
        style={{ 
          backgroundColor: service.color,
          opacity: isActive ? 1 : 0.5 
        }} 
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">
              {film.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="capitalize text-xs">
                {film.genre}
              </Badge>
              {deal?.dealType === 'production' && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                  Original
                </Badge>
              )}
            </div>
          </div>
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: service.color }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        {deal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Total Views:</span>
              </div>
              <span className="text-right font-medium">
                {((deal.totalViews || 0) / 1000000).toFixed(1)}M
              </span>
              
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">This Week:</span>
              </div>
              <span className="text-right font-medium">
                {(Number(lastWeekViews) / 1000000).toFixed(2)}M
              </span>

              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">License Fee:</span>
              </div>
              <span className="text-right font-medium text-primary">
                {formatMoney(deal.licenseFee)}
              </span>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  License Progress
                </span>
                <span className="font-medium">{weeksRemaining} weeks left</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Performance:</span>
              </div>
              <Badge 
                variant={viewPerformance >= 80 ? "default" : viewPerformance >= 50 ? "secondary" : "outline"}
                className="text-xs"
              >
                {viewPerformance.toFixed(0)}% of target
              </Badge>
            </div>
          </div>
        )}

        {!deal && (
          <div className="py-4 text-center text-muted-foreground text-sm">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>License pending</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Top10Chart({
  content,
  service,
  currentWeek,
  currentYear,
}: {
  content: { deal: StreamingDeal; film: FilmType; studioName: string; isAI: boolean }[];
  service: StreamingService;
  currentWeek: number;
  currentYear: number;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Get views for a specific week offset from the weeklyViews array
  // weekOffset 0 = most recent week (last element), 1 = previous week, etc.
  const getViewsForWeek = (deal: StreamingDeal, offset: number): number => {
    const weeklyViews = deal.weeklyViews || [];
    if (weeklyViews.length === 0) return 0;
    
    // Index from the end: offset 0 = last element, offset 1 = second to last, etc.
    const index = weeklyViews.length - 1 - offset;
    if (index < 0) return 0; // Film wasn't streaming during this week
    
    return Number(weeklyViews[index]) || 0;
  };
  
  // Filter to only include films that were streaming during the selected week
  // and sort by that week's views
  const sortedContent = [...content]
    .map(item => ({
      ...item,
      weekViews: getViewsForWeek(item.deal, weekOffset),
      // Calculate cumulative views up to and including this week
      cumulativeViews: (item.deal.weeklyViews || [])
        .slice(0, (item.deal.weeklyViews?.length || 0) - weekOffset)
        .reduce((sum, v) => sum + Number(v), 0)
    }))
    .filter(item => item.weekViews > 0) // Only show films that had views during this week
    .sort((a, b) => b.weekViews - a.weekViews)
    .slice(0, 10);

  const maxViews = sortedContent[0]?.weekViews || 1;
  
  // Calculate max weeks we can go back based on available data
  const maxWeeksBack = Math.max(...content.map(c => c.deal.weeklyViews?.length || 0)) - 1;

  const displayWeek = currentWeek - weekOffset;
  const displayYear = displayWeek <= 0 ? currentYear - 1 : currentYear;
  const adjustedWeek = displayWeek <= 0 ? 52 + displayWeek : displayWeek;

  const weekStart = new Date(displayYear, 0, 1);
  weekStart.setDate(weekStart.getDate() + (adjustedWeek - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (content.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 text-white border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="w-5 h-5 text-red-500" />
            Top 10 Films
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
            <div className="text-center min-w-[200px]">
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 text-sm font-medium">
                <span>{formatDate(weekStart)} - {formatDate(weekEnd).split(' ').slice(1).join(' ')}</span>
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
        <div className="border-b border-zinc-700 pb-2 mb-2">
          <div className="grid grid-cols-[40px_1fr_140px_140px] gap-4 text-xs text-zinc-400 uppercase tracking-wide">
            <span>#</span>
            <span className="flex items-center gap-1">
              Films <span className="text-red-500">▼</span>
            </span>
            <span className="text-center">Weeks in Top 10</span>
            <span className="text-right">Views</span>
          </div>
        </div>
        
        <div className="space-y-1">
          {sortedContent.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <p>No streaming data available for this week</p>
            </div>
          ) : (
            sortedContent.map((item, index) => {
              const { deal, film, studioName, weekViews } = item;
              const weeksActive = deal.weeksActive || 0;
              const weeksInTop10 = Math.min(weeksActive, 10);
              const viewsWithCommas = Number(weekViews).toLocaleString();
              
              return (
                <div 
                  key={deal.id}
                  className="grid grid-cols-[40px_1fr_140px_140px] gap-4 items-center py-3 border-b border-zinc-800/50 hover:bg-white/5 transition-colors rounded"
                >
                  <span className="text-2xl font-bold text-zinc-300">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{film.title}</div>
                    <div className="text-xs text-zinc-500 truncate">{studioName}</div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-zinc-300 font-medium w-6 text-center">{weeksInTop10}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(weeksInTop10, 10) }).map((_, i) => (
                        <div 
                          key={i}
                          className="w-2 h-4 rounded-sm"
                          style={{ backgroundColor: service.color || '#E50914' }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right overflow-hidden">
                    <span className="text-white font-medium">{viewsWithCommas}</span>
                    <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(Math.max((weekViews / maxViews) * 100, 5), 100)}%`,
                          backgroundColor: service.color || '#3b82f6'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LicenseFilmCard({ 
  film, 
  service,
  onLicense,
  isPending,
}: { 
  film: FilmType; 
  service: StreamingService;
  onLicense: (filmId: string, licenseFee: number) => void;
  isPending: boolean;
}) {
  const normalizedAudienceScore = (film.audienceScore || 0) * 10;
  const qualityScore = (normalizedAudienceScore + (film.criticScore || 0)) / 2;
  const genreMatch = service.genrePreferences?.includes(film.genre) ? 1.2 : 1.0;
  const multiplier = service.licenseFeeMultiplier ?? 1.0;
  const baseFee = (film.totalBoxOffice || 0) * 0.15;
  const qualityBonus = baseFee * (qualityScore / 100) * 0.3;
  const licenseFee = Math.round((baseFee + qualityBonus) * genreMatch * multiplier);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{film.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="capitalize text-xs">
                {film.genre}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatMoney(film.totalBoxOffice || 0)} Box Office
              </span>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: service.color }}>
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
                    onClick={() => onLicense(film.id, licenseFee)}
                    disabled={isPending}
                    style={{ backgroundColor: service.color }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept Deal
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StreamingServiceDetailPage() {
  const params = useParams();
  const serviceId = params.serviceId as string;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const gameContext = useContext(GameContext);
  
  const studioId = gameContext?.state?.studioId;
  const currentWeek = gameContext?.state?.currentWeek || 1;
  const currentYear = gameContext?.state?.currentYear || 2025;

  const { data: services = [] } = useQuery<StreamingService[]>({
    queryKey: ['/api/streaming-services'],
    enabled: !!studioId,
  });

  const { data: allDeals = [] } = useQuery<StreamingDeal[]>({
    queryKey: ['/api/streaming-deals', studioId],
    queryFn: async () => {
      const res = await fetch(`/api/streaming-deals?playerGameId=${studioId}`);
      return res.json();
    },
    enabled: !!studioId,
  });

  const { data: films = [] } = useQuery<FilmType[]>({
    queryKey: ['/api/studio', studioId, 'films'],
    enabled: !!studioId,
  });

  // Fetch ALL films on this streaming service (including AI films)
  const { data: allServiceContent = [] } = useQuery<{ deal: StreamingDeal; film: FilmType; studioName: string; isAI: boolean }[]>({
    queryKey: ['/api/streaming-deals/service', serviceId],
    queryFn: async () => {
      const res = await fetch(`/api/streaming-deals/service/${serviceId}`);
      return res.json();
    },
    enabled: !!serviceId,
  });

  const service = services.find(s => s.id === serviceId);
  const serviceDeals = allDeals.filter(d => d.streamingServiceId === serviceId);
  const activeDeals = serviceDeals.filter(d => d.isActive);
  
  // Separate player and AI content
  const playerContent = allServiceContent.filter(c => !c.isAI && c.deal.isActive);
  const aiContent = allServiceContent.filter(c => c.isAI && c.deal.isActive);
  const allActiveContent = allServiceContent.filter(c => c.deal.isActive);
  
  const licensedFilmIds = new Set(allDeals.map(d => d.filmId));
  const eligibleFilms = films.filter(film => {
    if (film.phase !== 'released') return false;
    if (licensedFilmIds.has(film.id)) return false;
    const normalizedAudienceScore = (film.audienceScore || 0) * 10;
    const qualityScore = (normalizedAudienceScore + (film.criticScore || 0)) / 2;
    return qualityScore >= (service?.minimumQualityScore ?? 50);
  });

  const acceptDealMutation = useMutation({
    mutationFn: async ({ filmId, licenseFee }: { filmId: string; licenseFee: number }) => {
      return await apiRequest('POST', '/api/streaming-deals', {
        filmId,
        streamingServiceId: serviceId,
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
        description: `Your film is now streaming on ${service?.name}.`,
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

  if (!service) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/streaming')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Streaming
        </Button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Streaming service not found.</p>
        </Card>
      </div>
    );
  }

  const Icon = getServiceIcon(service.logo);
  const theme = serviceThemes[serviceId] || serviceThemes['streamflix'];
  
  // Total views across ALL content on the platform
  const totalPlatformViews = allActiveContent.reduce((sum, c) => sum + (c.deal.totalViews || 0), 0);
  // Player's revenue from this platform
  const totalRevenue = serviceDeals.reduce((sum, d) => sum + (d.licenseFee || 0), 0);
  // Player's views on this platform
  const playerViews = activeDeals.reduce((sum, d) => sum + (d.totalViews || 0), 0);

  return (
    <div className="min-h-screen">
      <div 
        className={`relative bg-gradient-to-br ${theme.gradient} text-white`}
        style={{ backgroundImage: theme.bgPattern }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative p-6 pb-12">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/streaming')} 
            className="mb-6 text-white/80 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Streaming
          </Button>

          <div className="flex items-start gap-6">
            <div 
              className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0"
            >
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-4xl font-bold mb-2">{service.name}</h1>
              <p className="text-xl text-white/80 italic mb-4">{theme.tagline}</p>
              <p className="text-white/70 max-w-2xl">{theme.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <p className="text-2xl font-display font-bold text-white">{service.subscriberCount}M</p>
                <p className="text-sm text-white/70">Subscribers</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 text-center">
                <Film className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <p className="text-2xl font-display font-bold text-white">{allActiveContent.length}</p>
                <p className="text-sm text-white/70">Total Films</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 text-center">
                <Film className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <p className="text-2xl font-display font-bold text-white">{playerContent.length}</p>
                <p className="text-sm text-white/70">Your Films</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 text-center">
                <Eye className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <p className="text-2xl font-display font-bold text-white">{(totalPlatformViews / 1000000).toFixed(1)}M</p>
                <p className="text-sm text-white/70">Platform Views</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 text-center">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <p className="text-2xl font-display font-bold text-white">{formatMoney(totalRevenue)}</p>
                <p className="text-sm text-white/70">Your Earnings</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="p-6 -mt-6">
        {serviceId === 'streamflix' && allActiveContent.length > 0 && (
          <div className="mb-6">
            <Top10Chart 
              content={allActiveContent}
              service={service}
              currentWeek={currentWeek}
              currentYear={currentYear}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Your Films on {service.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeDeals.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>You don't have any films on {service.name} yet.</p>
                    <p className="text-sm mt-1">License a film to start earning views!</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeDeals.map(deal => {
                      const film = films.find(f => f.id === deal.filmId);
                      if (!film) return null;
                      return (
                        <FilmCard 
                          key={deal.id}
                          film={film}
                          deal={deal}
                          service={service}
                          currentWeek={currentWeek}
                          currentYear={currentYear}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  All Films on {service.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allActiveContent.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No films are currently streaming on {service.name}.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allActiveContent.map(({ deal, film, studioName, isAI }) => (
                      <Card key={deal.id} className="overflow-hidden">
                        <div 
                          className="h-1.5" 
                          style={{ backgroundColor: service.color, opacity: isAI ? 0.6 : 1 }} 
                        />
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{film.title}</h4>
                              <p className="text-xs text-muted-foreground truncate">{studioName}</p>
                            </div>
                            {isAI ? (
                              <Badge variant="outline" className="text-xs shrink-0 ml-2">Competitor</Badge>
                            ) : (
                              <Badge className="text-xs shrink-0 ml-2" style={{ backgroundColor: service.color }}>Yours</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-muted-foreground" />
                              <span>{((deal.totalViews || 0) / 1000000).toFixed(1)}M</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span>{deal.weeksActive || 0}w</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="mt-2 text-xs capitalize">{film.genre}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Genre Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {service.genrePreferences?.map(genre => (
                    <Badge 
                      key={genre} 
                      className="px-3 py-1 capitalize text-sm"
                      style={{ backgroundColor: service.color }}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Films in these genres receive a 20% bonus to their license fee.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Available Licensing Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eligibleFilms.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <p className="text-sm">No eligible films available.</p>
                    <p className="text-xs mt-1">Films need a quality score of {service.minimumQualityScore ?? 50}+</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {eligibleFilms.map(film => (
                      <LicenseFilmCard
                        key={film.id}
                        film={film}
                        service={service}
                        onLicense={(filmId, licenseFee) => acceptDealMutation.mutate({ filmId, licenseFee })}
                        isPending={acceptDealMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Platform Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ARPU:</span>
                  <span className="font-medium">${service.monthlyRevenuePerSub}/month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min. Quality Score:</span>
                  <span className="font-medium">{service.minimumQualityScore ?? 50}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">License Multiplier:</span>
                  <span className="font-medium">{service.licenseFeeMultiplier ?? 1.0}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">License Duration:</span>
                  <span className="font-medium">2 years</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
