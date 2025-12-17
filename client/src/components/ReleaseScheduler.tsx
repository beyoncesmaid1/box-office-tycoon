import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { useGame, formatMoney, formatWeekDate } from '@/lib/gameState';
import { DateWithWeek } from './DateWithWeek';
import { useToast } from '@/hooks/use-toast';
import { BOX_OFFICE_COUNTRIES } from '@shared/countries';
import type { Film, FilmRelease } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface ReleaseSchedulerProps {
  film: Film;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DISTRIBUTION_FEES: Record<string, number> = {
  'NA': 2000000,    // $2M - North America
  'CN': 1500000,    // $1.5M - China
  'GB': 1000000,    // $1M - UK & Ireland
  'FR': 1000000,    // $1M - France
  'JP': 1000000,    // $1M - Japan
  'DE': 800000,     // $800K - Germany
  'KR': 800000,     // $800K - South Korea
  'MX': 500000,     // $500K - Mexico
  'AU': 500000,     // $500K - Australia
  'IN': 500000,     // $500K - India
  'OTHER': 300000,  // $300K - Other territories
};

const getDistributionFee = (territoryCode: string): number => {
  return DISTRIBUTION_FEES[territoryCode] || 500000;
};

export function ReleaseScheduler({ film, open, onOpenChange }: ReleaseSchedulerProps) {
  const { state } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch fresh film data to ensure up-to-date production budget
  const { data: freshFilm } = useQuery<Film>({
    queryKey: ['/api/films', film.id],
    enabled: open,
  });
  const currentFilm = freshFilm || film;
  
  const [releaseType, setReleaseType] = useState('worldwide');
  const [marketingFocus, setMarketingFocus] = useState('everyone');
  const [globalMarketingBudget, setGlobalMarketingBudget] = useState(30000000);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReleaseWeek, setSelectedReleaseWeek] = useState(0);
  const [selectedReleaseYear, setSelectedReleaseYear] = useState(0);
  
  // Fetch existing releases
  const { data: existingReleases = [], isLoading } = useQuery<FilmRelease[]>({
    queryKey: ['/api/films', film.id, 'releases'],
    enabled: open,
  });

  // Fetch composer data if film has a composer
  const { data: composer } = useQuery({
    queryKey: ['/api/talent', film.composerId],
    enabled: open && !!film.composerId,
  });

  // Fetch all VFX studios to find the one for this film
  const { data: allVfxStudios = [] } = useQuery({
    queryKey: ['/api/vfx-studios'],
    enabled: open,
  });

  // Find the specific VFX studio for this film
  const vfxStudio = film.vfxStudioId ? (allVfxStudios as any[]).find(s => s.id === film.vfxStudioId) : null;
  
  // Calculate earliest release date using fresh film data
  const totalProductionWeeks = (currentFilm.developmentDurationWeeks || 4) + 
    (currentFilm.preProductionDurationWeeks || 2) + 
    (currentFilm.productionDurationWeeks || 8) + 
    (currentFilm.postProductionDurationWeeks || 2);
  const filmCreatedAbsoluteWeek = (currentFilm.createdAtYear || state.currentYear) * 52 + (currentFilm.createdAtWeek || state.currentWeek);
  const currentAbsoluteWeek = (state.currentYear || 2025) * 52 + (state.currentWeek || 1);
  let earliestReleaseAbsoluteWeek = filmCreatedAbsoluteWeek + totalProductionWeeks;
  
  // Ensure earliest release date is never before current game week
  if (earliestReleaseAbsoluteWeek < currentAbsoluteWeek) {
    earliestReleaseAbsoluteWeek = currentAbsoluteWeek;
  }
  
  const earliestReleaseYear = Math.floor((earliestReleaseAbsoluteWeek - 1) / 52);
  const earliestReleaseWeek = ((earliestReleaseAbsoluteWeek - 1) % 52) + 1;
  
  // Calculate distribution fees based on release type
  const territoriesToRelease = releaseType === 'worldwide' ? BOX_OFFICE_COUNTRIES.map(c => c.code) : ['NA'];
  const totalDistributionFees = territoriesToRelease.reduce((sum, code) => sum + getDistributionFee(code), 0);
  
  // Calculate total production cost with actual composer and VFX costs using fresh film data
  const composerExpense = (composer as any)?.askingPrice || 0;
  const vfxExpense = vfxStudio?.cost || 0;
  
  const totalProductionCost = (currentFilm.productionBudget || 0) +
    (currentFilm.setsBudget || 0) +
    (currentFilm.costumesBudget || 0) +
    (currentFilm.stuntsBudget || 0) +
    (currentFilm.makeupBudget || 0) +
    (currentFilm.practicalEffectsBudget || 0) +
    (currentFilm.soundCrewBudget || 0) +
    (currentFilm.talentBudget || 0) +
    composerExpense +
    vfxExpense;
  
  const totalReleaseCost = totalProductionCost + globalMarketingBudget + totalDistributionFees;
  
  useEffect(() => {
    if (existingReleases && existingReleases.length > 0 && open) {
      const totalMarketing = existingReleases.reduce((sum, r) => sum + (r.marketingBudget || 0), 0);
      setGlobalMarketingBudget(totalMarketing);
    }
    // Initialize selected release date to earliest date
    setSelectedReleaseWeek(earliestReleaseWeek);
    setSelectedReleaseYear(earliestReleaseYear);
  }, [existingReleases, open, earliestReleaseWeek, earliestReleaseYear]);
  
  const handlePosterSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setPosterFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
    }
  };
  
  const createReleasesMutation = useMutation({
    mutationFn: async () => {
      const territories = releaseType === 'worldwide' ? BOX_OFFICE_COUNTRIES.map(c => c.code) : ['NA'];
      
      // Validate all territories first (all-or-nothing approach)
      // Check for existing releases
      for (const territory of territories) {
        const existing = existingReleases.find(r => r.territoryCode === territory);
        if (existing) {
          throw new Error(`Release already scheduled for ${territory}`);
        }
      }
      
      // Create releases sequentially to prevent budget deduction race conditions
      for (const territory of territories) {
        await apiRequest('POST', `/api/films/${film.id}/releases`, {
          territoryCode: territory,
          releaseWeek: selectedReleaseWeek,
          releaseYear: selectedReleaseYear,
          productionBudget: Math.floor(totalProductionCost),
          marketingBudget: Math.floor(globalMarketingBudget),
          posterUrl: posterPreview,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/films', film.id, 'releases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
      toast({
        title: 'Release Scheduled',
        description: 'Release schedule has been configured.',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to schedule release';
      
      // Suppress insufficient funds errors (already shown in UI calculations)
      if (errorMessage.includes('Insufficient')) {
        console.log('Insufficient funds - validation already shown in UI');
        return;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
  
  const handleSubmit = async () => {
    // Validate release date using absolute weeks
    const selectedAbsoluteWeek = selectedReleaseYear * 52 + selectedReleaseWeek;
    
    if (selectedAbsoluteWeek < earliestReleaseAbsoluteWeek) {
      toast({
        title: 'Invalid Release Date',
        description: `Release date must be on or after ${formatWeekDate(earliestReleaseWeek, earliestReleaseYear)}`,
        variant: 'destructive',
      });
      return;
    }

    if (existingReleases.length === 0) {
      setIsSubmitting(true);
      try {
        await createReleasesMutation.mutateAsync();
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onOpenChange(false);
    }
  };
  
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isAlreadyScheduled = existingReleases.length > 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto sleek-scrollbar">
        <DialogHeader>
          <DialogTitle>Release Schedule: {currentFilm.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Movie Poster Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-72 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden">
              {posterPreview ? (
                <img src={posterPreview} alt="Movie Poster" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Movie Poster</p>
                </div>
              )}
            </div>
            <Label htmlFor="poster-upload" className="cursor-pointer">
              <div className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                {posterPreview ? 'Change Poster' : 'Upload Poster'}
              </div>
            </Label>
            <Input
              id="poster-upload"
              type="file"
              accept="image/*"
              onChange={handlePosterSelect}
              className="hidden"
            />
          </div>
          
          {/* Release Options */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Release Type */}
              <div className="space-y-2">
                <Label htmlFor="release-type" className="text-base font-medium">Release</Label>
                <Select value={releaseType} onValueChange={setReleaseType} disabled={isAlreadyScheduled}>
                  <SelectTrigger id="release-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worldwide">Worldwide Release</SelectItem>
                    <SelectItem value="na-only">North America Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Marketing Focus */}
              <div className="space-y-2">
                <Label htmlFor="marketing-focus" className="text-base font-medium">Marketing Focus</Label>
                <Select value={marketingFocus} onValueChange={setMarketingFocus}>
                  <SelectTrigger id="marketing-focus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="families">Families</SelectItem>
                    <SelectItem value="adults">Adults</SelectItem>
                    <SelectItem value="teens">Teens</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Global Marketing Budget */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Marketing Budget</Label>
                  <span className="text-lg font-semibold text-primary">{formatMoney(globalMarketingBudget)}</span>
                </div>
                <Slider
                  value={[globalMarketingBudget]}
                  onValueChange={([value]) => setGlobalMarketingBudget(value)}
                  min={0}
                  max={500000000}
                  step={1000000}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$0</span>
                  <span>${(globalMarketingBudget / 1000000).toFixed(0)}M</span>
                  <span>$500M</span>
                </div>
              </div>
              
              {/* Release Date Selection */}
              <div className="space-y-2">
                <Label htmlFor="release-week" className="text-base font-medium">Release Date</Label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="release-week" className="text-xs text-muted-foreground">Week</Label>
                    <Select value={selectedReleaseWeek.toString()} onValueChange={(val) => setSelectedReleaseWeek(parseInt(val))} disabled={isAlreadyScheduled}>
                      <SelectTrigger id="release-week">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(52)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Week {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="release-year" className="text-xs text-muted-foreground">Year</Label>
                    <Select value={selectedReleaseYear.toString()} onValueChange={(val) => setSelectedReleaseYear(parseInt(val))} disabled={isAlreadyScheduled}>
                      <SelectTrigger id="release-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(5)].map((_, i) => (
                          <SelectItem key={i} value={(earliestReleaseYear + i).toString()}>
                            {earliestReleaseYear + i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedReleaseWeek < earliestReleaseWeek && selectedReleaseYear === earliestReleaseYear && (
                  <p className="text-xs text-amber-600">Release date must be after {formatWeekDate(earliestReleaseWeek, earliestReleaseYear)}</p>
                )}
              </div>

              {/* Release Info */}
              <div className="pt-4 border-t space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Release Date</span>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <DateWithWeek week={selectedReleaseWeek} year={selectedReleaseYear} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Territories</span>
                  <span className="font-medium">{releaseType === 'worldwide' ? BOX_OFFICE_COUNTRIES.length : 1} territories</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Production:</span>
                  <span className="font-medium">{formatMoney(currentFilm.productionBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sets:</span>
                  <span className="font-medium">{formatMoney(currentFilm.setsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costumes:</span>
                  <span className="font-medium">{formatMoney(currentFilm.costumesBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stunts:</span>
                  <span className="font-medium">{formatMoney(currentFilm.stuntsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Makeup:</span>
                  <span className="font-medium">{formatMoney(currentFilm.makeupBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Practical Effects:</span>
                  <span className="font-medium">{formatMoney(currentFilm.practicalEffectsBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sound Crew:</span>
                  <span className="font-medium">{formatMoney(currentFilm.soundCrewBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Talent:</span>
                  <span className="font-medium">{formatMoney(currentFilm.talentBudget || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Composer:</span>
                  <span className="font-medium">{formatMoney(composerExpense)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VFX Studio:</span>
                  <span className="font-medium">{formatMoney(vfxExpense)}</span>
                </div>
              </div>

              {/* Release Cost Section */}
              <div className="pt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Production Cost:</span>
                  <span className="font-medium">{formatMoney(totalProductionCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marketing:</span>
                  <span className="font-medium">{formatMoney(globalMarketingBudget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distribution Fees ({territoriesToRelease.length} territories):</span>
                  <span className="font-medium">{formatMoney(totalDistributionFees)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
                  <span>Total Release Cost:</span>
                  <span className="text-primary">{formatMoney(totalReleaseCost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isAlreadyScheduled}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : isAlreadyScheduled ? (
              'Already Scheduled'
            ) : (
              'Schedule Release'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
