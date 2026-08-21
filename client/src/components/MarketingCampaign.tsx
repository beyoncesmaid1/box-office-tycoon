import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Megaphone, RadioTower, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useGame, formatMoney } from '@/lib/gameState';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  Film,
  FilmRelease,
  MarketingAction,
  PremiumBooking,
} from '@shared/schema';
import { BOX_OFFICE_COUNTRIES } from '@shared/countries';

interface MarketingCampaignProps {
  film: Film;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActionProfile {
  kind: string;
  name: string;
  minimumWeeksFromRelease: number;
  maximumWeeksFromRelease: number;
  awarenessEffect: number;
  interestEffect: number;
  expectationEffect: number;
  buzzEffect: number;
}

interface CampaignResponse {
  film: Film;
  releases: FilmRelease[];
  actions: MarketingAction[];
  bookings: PremiumBooking[];
  actionCatalog: ActionProfile[];
}

type CalendarBooking = PremiumBooking & { filmTitle?: string };

const absoluteWeek = (week: number, year: number) => year * 52 + week;

export function MarketingCampaign({ film, open, onOpenChange }: MarketingCampaignProps) {
  const { state } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campaignLimit, setCampaignLimit] = useState(film.campaignLimit || 30_000_000);
  const [strategy, setStrategy] = useState(film.campaignStrategy || 'balanced');
  const [autoManage, setAutoManage] = useState(Boolean(film.autoManageMarketing));
  const [actionSpend, setActionSpend] = useState(10_000_000);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [bookingTerritory, setBookingTerritory] = useState('NA');
  const [bookingFormat, setBookingFormat] = useState<'imax' | 'dolby'>('imax');
  const [bookingAccess, setBookingAccess] = useState<'standard' | 'priority' | 'exclusive'>('standard');
  const [bookingDuration, setBookingDuration] = useState(1);

  const { data, isLoading } = useQuery<CampaignResponse>({
    queryKey: ['/api/films', film.id, 'campaign'],
    enabled: open,
  });
  const { data: premiumCalendar = [] } = useQuery<CalendarBooking[]>({
    queryKey: ['/api/premium-bookings', state.studioId],
    queryFn: async () => {
      const response = await fetch(`/api/premium-bookings?playerGameId=${encodeURIComponent(state.studioId)}`);
      if (!response.ok) throw new Error('Failed to load premium calendar');
      return response.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!data) return;
    setCampaignLimit(data.film.campaignLimit || 30_000_000);
    setStrategy(data.film.campaignStrategy || 'balanced');
    setAutoManage(Boolean(data.film.autoManageMarketing));
    setSelectedTerritories(data.releases.map(release => release.territoryCode));
    if (data.releases[0]) setBookingTerritory(data.releases[0].territoryCode);
  }, [data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/films', film.id, 'campaign'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/premium-bookings', state.studioId] });
    await queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
  };

  const settingsMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', `/api/films/${film.id}/campaign`, {
      campaignLimit,
      campaignStrategy: strategy,
      autoManageMarketing: autoManage,
    }),
    onSuccess: async () => {
      await refresh();
      toast({ title: 'Campaign plan updated' });
    },
    onError: (error: Error) => toast({
      title: 'Could not update campaign',
      description: error.message,
      variant: 'destructive',
    }),
  });

  const actionMutation = useMutation({
    mutationFn: (action: string) => apiRequest(
      'POST',
      `/api/films/${film.id}/campaign/actions`,
      { action, spend: actionSpend, territoryCodes: selectedTerritories },
    ),
    onSuccess: async () => {
      await refresh();
      toast({ title: 'Campaign action launched' });
    },
    onError: (error: Error) => toast({
      title: 'Campaign action unavailable',
      description: error.message,
      variant: 'destructive',
    }),
  });

  const bookingMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/films/${film.id}/premium-bookings`, {
      territoryCode: bookingTerritory,
      format: bookingFormat,
      accessLevel: bookingAccess,
      durationWeeks: bookingDuration,
    }),
    onSuccess: async (response: Response) => {
      const result = await response.json();
      await refresh();
      toast({
        title: result.booking.status === 'secured' ? 'Premium booking secured' : 'Booking declined',
        description: `${bookingFormat.toUpperCase()} forecast ${result.forecast}`,
        variant: result.booking.status === 'secured' ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => toast({
      title: 'Could not request booking',
      description: error.message,
      variant: 'destructive',
    }),
  });

  const currentAbsoluteWeek = absoluteWeek(state.currentWeek || 1, state.currentYear || 2025);
  if (isLoading || !data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign</DialogTitle>
            <DialogDescription>Loading marketing and premium booking data for this film.</DialogDescription>
          </DialogHeader>
          <p className="py-8 text-center text-muted-foreground">Loading campaign…</p>
        </DialogContent>
      </Dialog>
    );
  }

  const remaining = Math.max(0, campaignLimit - (data.film.campaignSpent || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Campaign: {data.film.title}
          </DialogTitle>
          <DialogDescription>
            Build awareness, interest, and premium format access over the film’s lifecycle.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="campaign">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="campaign">Strategy</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="premium">IMAX & Dolby</TabsTrigger>
          </TabsList>

          <TabsContent value="campaign" className="space-y-4 pt-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Campaign ceiling</p>
                  <p className="text-xl font-semibold">{formatMoney(campaignLimit)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="text-xl font-semibold">{formatMoney(data.film.campaignSpent || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-xl font-semibold">{formatMoney(remaining)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Campaign plan</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Spending ceiling</Label>
                  <Input
                    type="number"
                    min={data.film.campaignSpent || 0}
                    step={1_000_000}
                    value={campaignLimit}
                    onChange={event => setCampaignLimit(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department strategy</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="blockbuster">Blockbuster Launch</SelectItem>
                      <SelectItem value="targeted">Targeted Efficiency</SelectItem>
                      <SelectItem value="prestige">Prestige Platform</SelectItem>
                      <SelectItem value="conservative">Conservative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label>Auto-manage</Label>
                    <p className="text-xs text-muted-foreground">Uses the same actions as AI studios.</p>
                  </div>
                  <Switch checked={autoManage} onCheckedChange={setAutoManage} />
                </div>
                <Button onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
                  Save campaign plan
                </Button>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.releases.map(release => {
                const weeks = absoluteWeek(release.releaseWeek, release.releaseYear) - currentAbsoluteWeek;
                return (
                  <Card key={release.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {BOX_OFFICE_COUNTRIES.find(country => country.code === release.territoryCode)?.name}
                        </span>
                        <Badge variant="outline">{weeks >= 0 ? `${weeks}w to release` : `Week ${Math.abs(weeks)}`}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span>Awareness {Math.round(release.awareness)}%</span>
                        <span>Interest {Math.round(release.interest)}%</span>
                        <span>Expectation {Math.round(release.expectation)}</span>
                        <span>Buzz {Math.round(release.buzz)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action spend</Label>
                <Input
                  type="number"
                  min={250_000}
                  max={remaining}
                  step={250_000}
                  value={actionSpend}
                  onChange={event => setActionSpend(Number(event.target.value))}
                />
              </div>
              <div>
                <Label>Target territories</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {data.releases.map(release => (
                    <label key={release.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedTerritories.includes(release.territoryCode)}
                        onCheckedChange={checked => setSelectedTerritories(current =>
                          checked
                            ? [...current, release.territoryCode]
                            : current.filter(code => code !== release.territoryCode))}
                      />
                      {BOX_OFFICE_COUNTRIES.find(country => country.code === release.territoryCode)?.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {data.actionCatalog.map(action => (
                <Card key={action.kind}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RadioTower className="w-4 h-4" />
                      {action.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Window: {action.maximumWeeksFromRelease} to {action.minimumWeeksFromRelease} weeks before release
                    </p>
                    <p className="text-xs">
                      Emphasis: awareness {Math.round(action.awarenessEffect * 100)} · interest {Math.round(action.interestEffect * 100)} · buzz {Math.round(action.buzzEffect * 100)}
                    </p>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={actionMutation.isPending || selectedTerritories.length === 0 || actionSpend > remaining}
                      onClick={() => actionMutation.mutate(action.kind)}
                    >
                      Launch for {formatMoney(actionSpend)}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="premium" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">IMAX suitability</p>
                  <p className="text-2xl font-semibold">{data.film.imaxSuitability}</p>
                  <p className="text-xs text-muted-foreground">Scale, visuals, VFX and spectacle</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Dolby suitability</p>
                  <p className="text-2xl font-semibold">{data.film.dolbySuitability}</p>
                  <p className="text-xs text-muted-foreground">Sound, music, atmosphere and immersion</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Request a booking</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3 items-end">
                <div className="space-y-2">
                  <Label>Territory</Label>
                  <Select value={bookingTerritory} onValueChange={setBookingTerritory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {data.releases.map(release => (
                        <SelectItem key={release.id} value={release.territoryCode}>
                          {BOX_OFFICE_COUNTRIES.find(country => country.code === release.territoryCode)?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={bookingFormat} onValueChange={value => setBookingFormat(value as 'imax' | 'dolby')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imax">IMAX</SelectItem>
                      <SelectItem value="dolby">Dolby Cinema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access</Label>
                  <Select value={bookingAccess} onValueChange={value => {
                    setBookingAccess(value as typeof bookingAccess);
                    if (value === 'exclusive' && bookingFormat === 'dolby') setBookingDuration(1);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select
                    value={String(bookingDuration)}
                    onValueChange={value => setBookingDuration(Number(value))}
                    disabled={bookingAccess === 'exclusive' && bookingFormat === 'dolby'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(duration => (
                        <SelectItem
                          key={duration}
                          value={String(duration)}
                          disabled={bookingAccess === 'exclusive' &&
                            (bookingFormat === 'dolby' ? duration > 1 : duration > 3)}
                        >
                          {duration} week{duration > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="md:col-span-4" onClick={() => bookingMutation.mutate()}>
                  Request {bookingFormat === 'imax' ? 'IMAX' : 'Dolby'} booking
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Territory booking calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {premiumCalendar
                  .filter(booking => booking.territoryCode === bookingTerritory &&
                    booking.status === 'secured')
                  .sort((left, right) =>
                    absoluteWeek(left.startWeek, left.startYear) -
                    absoluteWeek(right.startWeek, right.startYear))
                  .map(booking => (
                    <div key={booking.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <span className="font-medium">{booking.filmTitle}</span>
                        <span className="text-muted-foreground">
                          {' · '}Week {booking.startWeek}, {booking.startYear}
                          {' · '}{booking.durationWeeks}w
                        </span>
                      </div>
                      <Badge variant="outline">
                        {booking.format.toUpperCase()} · {booking.accessLevel}
                      </Badge>
                    </div>
                  ))}
                {!premiumCalendar.some(booking =>
                  booking.territoryCode === bookingTerritory && booking.status === 'secured') && (
                  <p className="text-sm text-muted-foreground">
                    No secured IMAX or Dolby commitments in this territory.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              {data.bookings.map(booking => (
                <div key={booking.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-3">
                    <CalendarRange className="w-4 h-4" />
                    <div>
                      <p className="font-medium">
                        {booking.format.toUpperCase()} · {booking.accessLevel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {BOX_OFFICE_COUNTRIES.find(country => country.code === booking.territoryCode)?.name}
                        {' · '}Week {booking.startWeek}, {booking.startYear}
                        {' · '}{booking.durationWeeks} week{booking.durationWeeks > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant={booking.status === 'secured' ? 'default' : 'destructive'}>
                    {booking.status}
                  </Badge>
                </div>
              ))}
              {data.bookings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="w-5 h-5 mx-auto mb-2" />
                  No premium bookings requested.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
