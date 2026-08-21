import { TrendingUp, TrendingDown, DollarSign, Film, Trophy, Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame, formatMoney } from '@/lib/gameState';
import { Skeleton } from '@/components/ui/skeleton';

export function FinancialSummary() {
  const { state } = useGame();

  if (state.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  const totalProduction = state.films.reduce((acc, f) => acc + f.totalBudget, 0);
  const totalBoxOffice = state.releasedFilms.reduce((acc, f) => acc + f.totalBoxOffice, 0);
  const avgRating = state.releasedFilms.length > 0
    ? state.releasedFilms.reduce((acc, f) => acc + f.audienceScore, 0) / state.releasedFilms.length
    : 0;

  const stats = [
    {
      label: 'Studio Budget',
      value: formatMoney(state.budget),
      icon: DollarSign,
      change: '+12.5%',
      positive: true,
    },
    {
      label: 'Total Box Office',
      value: formatMoney(totalBoxOffice),
      icon: TrendingUp,
      change: '+8.3%',
      positive: true,
    },
    {
      label: 'Active Projects',
      value: state.films.length.toString(),
      icon: Film,
      change: `${totalProduction > 0 ? formatMoney(totalProduction) + ' invested' : 'No active projects'}`,
      positive: true,
    },
    {
      label: 'Avg. Rating',
      value: avgRating > 0 ? avgRating.toFixed(1) : '-',
      icon: Star,
      change: state.releasedFilms.length > 0 ? `${state.releasedFilms.length} films released` : 'No releases yet',
      positive: avgRating >= 7,
    },
    {
      label: 'Awards Won',
      value: state.totalAwards.toString(),
      icon: Trophy,
      change: `Prestige Level ${state.prestigeLevel}`,
      positive: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
            <stat.icon className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl" data-testid={`text-stat-value-${index}`}>
              {stat.value}
            </div>
            <p className={`text-xs mt-1 flex items-center gap-1 ${stat.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stat.positive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {stat.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
