import { Progress } from '@/components/ui/progress';

interface RatingDisplayProps {
  audienceScore: number;
  criticScore: number;
  voteCount?: number;
  size?: 'sm' | 'md' | 'lg';
  openingWeekend?: number;
}

function getCriticImage(score: number): string {
  if (score >= 80) return '/rt-certified-fresh.png';
  if (score >= 60) return '/rt-fresh.png';
  return '/rt-rotten.png';
}

function getAudienceImage(score: number): string {
  if (score >= 8) return '/rt-verified-hot.png';
  if (score >= 6) return '/rt-hot.png';
  return '/rt-stale.png';
}

export function RatingDisplay({ audienceScore, criticScore, voteCount = 12500, size = 'md', openingWeekend = 0 }: RatingDisplayProps) {
  // Convert audience score from /10 to percentage
  const audiencePercent = Math.round((audienceScore / 10) * 100);
  
  const criticImage = getCriticImage(criticScore);
  const audienceImage = getAudienceImage(audienceScore);
  
  // Scale vote count based on opening weekend box office
  // Audience formula: (openingWeekend / 5,000,000) * baseVoteCount
  // Critic formula: min(1500, (openingWeekend / 600,000,000) * 1500)
  const scaledVoteCount = openingWeekend > 0 
    ? Math.round((openingWeekend / 5000000) * voteCount)
    : voteCount;
  
  // Critic reviews: max 1500, scaled by box office ($600M = max cap)
  const criticReviews = Math.min(1500, Math.round((openingWeekend / 600000000) * 1500));
  
  // Format vote count
  const formatVoteCount = (count: number) => {
    if (count >= 10000) {
      return `${(count / 1000).toFixed(0)}000+ Ratings`;
    }
    return `${count.toLocaleString()} Reviews`;
  };

  return (
    <div className="flex items-center justify-center gap-12 py-4">
      {/* Critic Score */}
      <div data-testid="rating-critic" className="flex items-center gap-3">
        <img 
          src={criticImage} 
          alt="Critics Score"
          className="w-16 h-16 object-contain"
        />
        <div>
          <p className="text-2xl font-bold">{criticScore}%</p>
          <p className="text-xs font-medium">Tomatometer</p>
          <p className="text-xs text-muted-foreground">{criticReviews.toLocaleString()} Reviews</p>
        </div>
      </div>

      {/* Audience Score */}
      <div data-testid="rating-audience" className="flex items-center gap-3">
        <img 
          src={audienceImage}
          alt="Audience Score"
          className="w-16 h-16 object-contain"
        />
        <div>
          <p className="text-2xl font-bold">{audiencePercent}%</p>
          <p className="text-xs font-medium">Popcornmeter</p>
          <p className="text-xs text-muted-foreground">{formatVoteCount(scaledVoteCount)}</p>
        </div>
      </div>
    </div>
  );
}
