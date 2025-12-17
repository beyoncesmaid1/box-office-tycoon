import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGame, formatMoney } from '@/lib/gameState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Tv, Film, Calendar, Users, DollarSign, Play, Pause, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { TVShow, TVSeason, StreamingService } from '@shared/schema';

const TV_GENRES = ['drama', 'comedy', 'thriller', 'scifi', 'horror', 'action', 'fantasy', 'romance', 'animation'];
const SHOW_TYPES = [
  { value: 'drama', label: 'Drama Series' },
  { value: 'comedy', label: 'Comedy Series' },
  { value: 'limited', label: 'Limited Series' },
  { value: 'anthology', label: 'Anthology Series' },
  { value: 'documentary', label: 'Documentary Series' },
];

const PHASE_COLORS: Record<string, string> = {
  'concept': 'bg-gray-500',
  'writers-room': 'bg-yellow-500',
  'pre-production': 'bg-blue-500',
  'production': 'bg-orange-500',
  'post-production': 'bg-purple-500',
  'airing': 'bg-green-500',
  'hiatus': 'bg-gray-400',
  'wrapped': 'bg-slate-600',
  'cancelled': 'bg-red-500',
};

const PHASE_LABELS: Record<string, string> = {
  'concept': 'Concept',
  'writers-room': "Writers' Room",
  'pre-production': 'Pre-Production',
  'production': 'Production',
  'post-production': 'Post-Production',
  'airing': 'Airing',
  'hiatus': 'Hiatus',
  'wrapped': 'Wrapped',
  'cancelled': 'Cancelled',
};

export default function TVShowsPage() {
  const { state } = useGame();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedShow, setSelectedShow] = useState<TVShow | null>(null);

  const { data: tvShows = [], isLoading } = useQuery<TVShow[]>({
    queryKey: ['/api/tv-shows', state.studioId],
    queryFn: async () => {
      const response = await fetch(`/api/tv-shows?studioId=${state.studioId}`);
      return response.json();
    },
    enabled: !!state.studioId,
  });

  const { data: streamingServices = [] } = useQuery<StreamingService[]>({
    queryKey: ['/api/streaming-services'],
  });


  const createShowMutation = useMutation({
    mutationFn: async (showData: Partial<TVShow>) => {
      const response = await apiRequest('POST', '/api/tv-shows', {
        ...showData,
        studioId: state.studioId,
        createdAtWeek: state.currentWeek,
        createdAtYear: state.currentYear,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tv-shows', state.studioId] });
      setIsCreateDialogOpen(false);
    },
  });

  const activeShows = tvShows.filter(show => 
    !['wrapped', 'cancelled'].includes(show.phase)
  );
  const completedShows = tvShows.filter(show => 
    ['wrapped', 'cancelled'].includes(show.phase)
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">TV Shows</h1>
          <p className="text-muted-foreground">Develop and pitch television series to streaming platforms</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Develop New Show
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <CreateShowDialog 
              streamingServices={streamingServices}
              onSubmit={(data) => createShowMutation.mutate(data)}
              isLoading={createShowMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {activeShows.length === 0 && completedShows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tv className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No TV Shows Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Start developing your first television series. Create episodic content and 
              pitch it to streaming platforms.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Show
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeShows.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Active Shows ({activeShows.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeShows.map(show => (
                  <ShowCard 
                    key={show.id} 
                    show={show} 
                    onClick={() => setSelectedShow(show)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedShows.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Completed Shows ({completedShows.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedShows.map(show => (
                  <ShowCard 
                    key={show.id} 
                    show={show} 
                    onClick={() => setSelectedShow(show)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedShow && (
        <ShowDetailDialog 
          show={selectedShow}
          studioId={state.studioId || ''}
          open={!!selectedShow}
          onClose={() => setSelectedShow(null)}
        />
      )}
    </div>
  );
}

function ShowCard({ show, onClick }: { show: TVShow; onClick: () => void }) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{show.title}</CardTitle>
            <CardDescription className="capitalize">{show.genre} {show.showType}</CardDescription>
          </div>
          <Badge className={`${PHASE_COLORS[show.phase] || 'bg-gray-500'} text-white`}>
            {PHASE_LABELS[show.phase] || show.phase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {show.synopsis || 'No synopsis yet'}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Film className="w-3.5 h-3.5" />
            <span>{show.totalSeasons} Season{show.totalSeasons !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{formatMoney(show.episodeBudget)}/ep</span>
          </div>
          {show.totalViews > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
              <Users className="w-3.5 h-3.5" />
              <span>{(show.totalViews / 1000000).toFixed(1)}M views</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateShowDialog({ 
  streamingServices, 
  onSubmit, 
  isLoading 
}: { 
  streamingServices: StreamingService[];
  onSubmit: (data: Partial<TVShow>) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('drama');
  const [showType, setShowType] = useState('drama');
  const [synopsis, setSynopsis] = useState('');
  const [episodeBudget, setEpisodeBudget] = useState('5000000');
  const [streamingServiceId, setStreamingServiceId] = useState('');
  const [releaseStrategy, setReleaseStrategy] = useState('weekly');

  const handleSubmit = () => {
    onSubmit({
      title,
      genre,
      showType,
      synopsis,
      episodeBudget: parseInt(episodeBudget),
      isStreamingExclusive: true,
      streamingServiceId,
      releaseStrategy,
      phase: 'concept',
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Develop New TV Show</DialogTitle>
        <DialogDescription>
          Create a new television series concept for development
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">Show Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter show title..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TV_GENRES.map(g => (
                  <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Show Type</Label>
            <Select value={showType} onValueChange={setShowType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOW_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="synopsis">Synopsis</Label>
          <Textarea
            id="synopsis"
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="Describe your show concept..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget">Budget Per Episode</Label>
          <Select value={episodeBudget} onValueChange={setEpisodeBudget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2000000">$2M (Budget)</SelectItem>
              <SelectItem value="5000000">$5M (Standard)</SelectItem>
              <SelectItem value="10000000">$10M (Premium)</SelectItem>
              <SelectItem value="15000000">$15M (Prestige)</SelectItem>
              <SelectItem value="25000000">$25M (Blockbuster)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Pitch to Streaming Platform</Label>
          <Select value={streamingServiceId} onValueChange={setStreamingServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select platform to pitch to..." />
            </SelectTrigger>
            <SelectContent>
              {streamingServices.map(service => (
                <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            All TV shows are streaming exclusives. Select which platform you want to pitch this show to.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Release Strategy</Label>
          <Select value={releaseStrategy} onValueChange={setReleaseStrategy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly Episodes</SelectItem>
              <SelectItem value="binge">Full Season Drop (Binge)</SelectItem>
              <SelectItem value="split">Split Season</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={!title || isLoading}>
          {isLoading ? 'Creating...' : 'Create Show'}
        </Button>
      </DialogFooter>
    </>
  );
}

function ShowDetailDialog({ 
  show, 
  studioId,
  open, 
  onClose 
}: { 
  show: TVShow; 
  studioId: string;
  open: boolean; 
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: seasons = [] } = useQuery<TVSeason[]>({
    queryKey: ['/api/tv-shows', show.id, 'seasons'],
    queryFn: async () => {
      const response = await fetch(`/api/tv-shows/${show.id}/seasons`);
      return response.json();
    },
    enabled: open,
  });

  const createSeasonMutation = useMutation({
    mutationFn: async () => {
      const nextSeasonNumber = seasons.length + 1;
      const response = await apiRequest('POST', '/api/tv-seasons', {
        tvShowId: show.id,
        seasonNumber: nextSeasonNumber,
        episodeCount: 10,
        seasonBudget: show.episodeBudget * 10,
        phase: 'concept',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tv-shows', show.id, 'seasons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tv-shows', studioId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-2xl">{show.title}</DialogTitle>
            <Badge className={`${PHASE_COLORS[show.phase] || 'bg-gray-500'} text-white`}>
              {PHASE_LABELS[show.phase] || show.phase}
            </Badge>
          </div>
          <DialogDescription className="capitalize">
            {show.genre} {show.showType} | {formatMoney(show.episodeBudget)} per episode
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{show.synopsis || 'No synopsis'}</p>

          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{show.totalSeasons}</div>
              <div className="text-xs text-muted-foreground">Seasons</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{show.totalEpisodes}</div>
              <div className="text-xs text-muted-foreground">Episodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatMoney(show.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Seasons</h3>
              {show.phase !== 'cancelled' && show.phase !== 'wrapped' && (
                <Button 
                  size="sm" 
                  onClick={() => createSeasonMutation.mutate()}
                  disabled={createSeasonMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Season
                </Button>
              )}
            </div>
            
            {seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No seasons yet. Add a season to start production.
              </p>
            ) : (
              <div className="space-y-2">
                {seasons.map(season => (
                  <div 
                    key={season.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-semibold">Season {season.seasonNumber}</div>
                      <Badge variant="outline">{season.episodeCount} episodes</Badge>
                      <Badge className={`${PHASE_COLORS[season.phase] || 'bg-gray-500'} text-white text-xs`}>
                        {PHASE_LABELS[season.phase] || season.phase}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMoney(season.seasonBudget)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
