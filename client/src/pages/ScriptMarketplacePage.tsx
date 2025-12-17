import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  DollarSign, 
  Star, 
  Film as FilmIcon, 
  ArrowLeft, 
  ShoppingCart,
  Users,
  Sparkles,
  Target,
  BookOpen
} from 'lucide-react';
import { useGame, formatMoney as gameFormatMoney } from '@/lib/gameState';
import { apiRequest } from '@/lib/queryClient';
import type { MarketplaceScript } from '@shared/schema';

const genreColors: Record<string, string> = {
  action: 'bg-red-500/20 text-red-400 border-red-500/30',
  comedy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  drama: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  horror: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'sci-fi': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  romance: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  thriller: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  fantasy: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  animation: 'bg-green-500/20 text-green-400 border-green-500/30',
  musical: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
};

const audienceLabels: Record<string, string> = {
  general: 'General Audience',
  family: 'Family',
  teenagers: 'Teen',
  adults: 'Adult',
};

function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  return `$${(amount / 1000).toFixed(0)}K`;
}

function getQualityLabel(quality: number): { label: string; color: string } {
  if (quality >= 85) return { label: 'Excellent', color: 'text-emerald-400' };
  if (quality >= 75) return { label: 'Good', color: 'text-green-400' };
  if (quality >= 65) return { label: 'Decent', color: 'text-yellow-400' };
  return { label: 'Average', color: 'text-gray-400' };
}

export default function ScriptMarketplacePage() {
  const [, setLocation] = useLocation();
  const { state } = useGame();
  const queryClient = useQueryClient();
  const [selectedScript, setSelectedScript] = useState<MarketplaceScript | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  
  const studioId = state.studioId;
  const budget = state.budget;

  const { data: scripts, isLoading } = useQuery<MarketplaceScript[]>({
    queryKey: ['marketplace-scripts'],
    queryFn: () => fetch('/api/marketplace-scripts').then(res => res.json()),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await apiRequest('POST', `/api/marketplace-scripts/${scriptId}/purchase`, {
        studioId
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
      setPurchaseSuccess(data.message);
      setSelectedScript(null);
      
      if (data.script) {
        localStorage.setItem('purchasedScript', JSON.stringify(data.script));
      }
      
      setTimeout(() => setPurchaseSuccess(null), 5000);
    },
  });

  const canAfford = (price: number) => budget >= price;

  if (!studioId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6 text-center">
            <p className="text-gray-400">Please select a studio to browse scripts.</p>
            <Button 
              onClick={() => setLocation('/')} 
              className="mt-4"
            >
              Go to Main Menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/develop')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Development
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-amber-400" />
              Script Marketplace
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Purchase professionally written scripts to fast-track your production
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-4 py-2">
          <DollarSign className="h-4 w-4 text-green-400" />
          <span className="text-white font-medium">
            Studio Budget: {formatMoney(budget)}
          </span>
        </div>
      </div>

      {purchaseSuccess && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-4 text-emerald-400 flex items-center gap-3">
          <Sparkles className="h-5 w-5" />
          <span>{purchaseSuccess}</span>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setLocation('/develop?fromMarketplace=true')}
            className="ml-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
          >
            Start Development
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="bg-gray-800/50 border-gray-700 animate-pulse">
              <CardContent className="p-6 h-[300px]" />
            </Card>
          ))}
        </div>
      ) : scripts && scripts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => {
            const qualityInfo = getQualityLabel(script.quality);
            const affordable = canAfford(script.price);
            
            return (
              <Card 
                key={script.id}
                className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer ${
                  selectedScript?.id === script.id ? 'ring-2 ring-amber-500' : ''
                }`}
                onClick={() => setSelectedScript(script)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg text-white line-clamp-1">
                      {script.title}
                    </CardTitle>
                    <Badge className={`${genreColors[script.genre] || 'bg-gray-500/20 text-gray-400'} capitalize shrink-0`}>
                      {script.genre}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400 text-sm">
                    by {script.writerName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300 text-sm italic line-clamp-2">
                    "{script.logline}"
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Star className={`h-4 w-4 ${qualityInfo.color}`} />
                      <span className={qualityInfo.color}>{qualityInfo.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">{audienceLabels[script.targetAudience] || script.targetAudience}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FilmIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">{formatMoney(script.estimatedBudget)} budget</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className={`h-4 w-4 ${affordable ? 'text-green-400' : 'text-red-400'}`} />
                      <span className={affordable ? 'text-green-400' : 'text-red-400'}>
                        {formatMoney(script.price)}
                      </span>
                    </div>
                  </div>

                  <Button 
                    className={`w-full ${
                      affordable 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!affordable || purchaseMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      purchaseMutation.mutate(script.id);
                    }}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {purchaseMutation.isPending ? 'Purchasing...' : affordable ? 'Purchase Script' : 'Insufficient Funds'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No scripts available in the marketplace.</p>
            <p className="text-gray-500 text-sm mt-2">Check back later for new scripts!</p>
          </CardContent>
        </Card>
      )}

      {selectedScript && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedScript(null)}
        >
          <Card 
            className="bg-gray-900 border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl text-white">{selectedScript.title}</CardTitle>
                  <CardDescription className="text-gray-400 mt-1">
                    Written by {selectedScript.writerName}
                  </CardDescription>
                </div>
                <Badge className={`${genreColors[selectedScript.genre] || 'bg-gray-500/20 text-gray-400'} capitalize`}>
                  {selectedScript.genre}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">Logline</h3>
                <p className="text-gray-300 italic">"{selectedScript.logline}"</p>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-2">Synopsis</h3>
                <p className="text-gray-300">{selectedScript.synopsis}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span className="text-gray-400 text-sm">Script Quality</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">{selectedScript.quality}</span>
                    <span className={`text-sm ${getQualityLabel(selectedScript.quality).color}`}>
                      {getQualityLabel(selectedScript.quality).label}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FilmIcon className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-400 text-sm">Est. Production Budget</span>
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {formatMoney(selectedScript.estimatedBudget)}
                  </span>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-400 text-sm">Target Audience</span>
                  </div>
                  <span className="text-lg font-medium text-white">
                    {audienceLabels[selectedScript.targetAudience] || selectedScript.targetAudience}
                  </span>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    <span className="text-gray-400 text-sm">Script Price</span>
                  </div>
                  <span className={`text-2xl font-bold ${canAfford(selectedScript.price) ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(selectedScript.price)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setSelectedScript(null)}
                  className="flex-1 border-gray-600"
                >
                  Close
                </Button>
                <Button 
                  className={`flex-1 ${
                    canAfford(selectedScript.price)
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!canAfford(selectedScript.price) || purchaseMutation.isPending}
                  onClick={() => purchaseMutation.mutate(selectedScript.id)}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {purchaseMutation.isPending ? 'Purchasing...' : canAfford(selectedScript.price) ? 'Purchase Script' : 'Insufficient Funds'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
